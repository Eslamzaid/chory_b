const express = require("express");
const session = require("express-session");
const MemoryStore = require("memorystore")(session)
const cors = require("cors");
const morgan = require("morgan");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const { firCon, secCon } = require("./routes/routes");
require("dotenv").config();
const pool = require("./database");
const { getAllById, addHis, getIdByEmail } = require("./queires/queires");

app.use(express.json());
const corsOptions = {
  origin: "https://chory.onrender.com",
  methods: ["GET", "POST", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
// app.options("*", cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));
const oneDay = 1000 * 60 * 60 * 24;
app.use(
  session({
    secret: process.env.SECRET_SESSION_KEY,
    resave: false,
    saveUninitialized: true,
    name: "thisisASesssionAndWIlbeWorking",
    store: new MemoryStore({
      checkPeriod: 86400000 
    }),
    cookie: { maxAge: oneDay, sameSite: "none", secure: true },
  })
);

app.get("/", async (req, res) => {
  if (await req.session.user_id) {
    pool.query(getAllById, [await req.session.user_id], async (err, result) => {
      if (!err) {
        const email = await result.rows[0].email;
        res.status(200).json({
          message: "Welcome",
          success: true,
          email: await email,
          id: await req.session.user_id,
        });
        return;
      } else {
        throw err;
      }
    });
  } else {
    console.log(await req.session.user_id);
    res.json({ message: "Unauthenticated", success: false });
  }
});

app.use("/api", firCon);
app.use("/home", secCon);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://chory.onrender.com",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("join_room", (data) => {
    socket.join(data);
    console.log(`User with id: ${socket.id} joined room: ${data}`);
  });

  socket.on("send_message", async (data) => {
    const date = new Date();
    let currentDay = String(date.getDate()).padStart(2, "0");
    let currentMonth = String(date.getMonth() + 1).padStart(2, "0");
    let currentYear = date.getFullYear();

    pool.query(getIdByEmail, [await data.email], async (err, result) => {
      if (!err) {
        if (result.rowCount == 0) return;
        const id = await result.rows[0].user_id;
        pool.query(
          addHis,
          [
            data.id,
            `${currentDay}-${currentMonth}-${currentYear}`,
            data.time,
            data.message,
            data.author,
            id,
          ],
          (err, result) => {
            if (err) throw err;
          }
        );
      } else {
        throw err;
      }
    });
    socket.to(await data.room).emit("receive_message", data);
  });
});

server.listen(4000, () => {
  console.log("Server is running 4000");
});
