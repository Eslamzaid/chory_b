const { Router } = require("express");
const controller = require("../controllers/controllers");
const firCon = Router();
const secCon = Router();

//! before authentication
firCon.post("/login", controller.backUser);
firCon.post("/signUp", controller.addUser);

//! after authentication
secCon.get("/", controller.sendData);
secCon.post("/search", controller.searchUser);
secCon.post("/addUser", controller.requestUser);
secCon.post("/acceptUser", controller.acceptRequest);
secCon.post("/chats", controller.sendChats)
secCon.delete("/rejReq/:email", controller.deleteRequest);
secCon.post("/his", controller.getHistory)
secCon.delete("/delChat", controller.deleteChat)

module.exports = { firCon, secCon };
