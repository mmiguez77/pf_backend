/* -------------------- Dependencias ---------------------- */
const express = require("express");
const { Server: HttpServer } = require("http");
const { Server: IOServer } = require("socket.io");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");
const morgan = require("morgan");
const logger = require("./helpers/winston.js");
const config = require("./config/index.js");
const passport = require("passport");
//const handlebars = require("express-handlebars");
require('./passport/passport.js');

/* -------------------- Rutas ---------------------- */
const router = require("./routes/productos.routes.js");
const routerMsg = require("./routes/mensajes.routes.js");
const usersRoutes = require("./routes/users.routes.js");
const cartRoutes = require("./routes/cart.routes.js");

/* -------------------- Controllers ---------------------- */
const Mensaje = require("./controllers/Mensaje.js");
const Producto = require("./controllers/Producto.js");
const msg = new Mensaje();
const prodClass = new Producto();

/* -------------------- Configuracion Server ---------------------- */
const app = express();
const httpServer = new HttpServer(app);
const io = new IOServer(httpServer);

/* -------------------- Middlewares ---------------------- */
app.use(cookieParser());
app.use(
  session({
    secret: "secreto",
    rolling: true,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(express.static("./src/public"));
app.use(flash());
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  res.locals.session = req.session;
  next();
});

/* -------------------- Ejs ---------------------- */
app.set("views", "./src/views");
app.set("view engine", "ejs");


// /* -------------------- Handlebars ---------------------- */
// app.set('view engine', 'hbs');
// app.engine('hbs', handlebars({
//         extname: 'hbs',
//         defaultLayout: 'index',
//         layoutsDir: __dirname + '/views/layouts',
//         partialsDir: __dirname + '/views/partials',
//     })
// );


/* -------------------- Endpoints ---------------------- */
app.use("/api/productos", router);
app.use("/api/cart", cartRoutes );
app.use("/mensajes", routerMsg);
app.use("/user", usersRoutes);
app.get("/", function (req, res) {
  res.render("index");
});

/* -------------------- Web Sockets ---------------------- */

let toChat = [];

io.on("connection", (socket) => {
  logger.info.info(
    `Cliente ID:${socket.id} inició conexión a traves de Socket`
  );
  io.sockets.emit("new-message-server", toChat);

  socket.on("new-message", async (data) => {
    const message = await data;
    toChat.push(data);
    msg.addMsg({ message });
    io.sockets.emit("new-message-server", toChat);
  });

  socket.on("messageAdmin", async (data) => {
    const msgAdmin = await data;
    let name = await msgAdmin.author.nombre;
    let msg = await msgAdmin.text;
    let mensajeAlAdmin = `El usuario: ${name} | Envia el siguiente mensaje: ${msg}`;
    twilioSms(mensajeAlAdmin);
  });

  socket.on("new-producto", async (data) => {
    const producto = await data;
    prodClass.addBySocket({ producto });
    io.sockets.emit("new-prod-server", producto);
  });
});

/* -------------------- Servidor ---------------------- */
const PORT = config.PORT;

const server = httpServer.listen(PORT, () => {
  logger.info.info(
    `Se inició servidor en Puerto ${PORT} - PID WORKER: ${process.pid}`
  );
});
server.on("error", (error) =>
  logger.error.error(`Error al iniciar servidor ${error}`)
);
