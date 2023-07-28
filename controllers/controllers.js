const quires = require("../queires/queires");
const validator = require("validator");
const pool = require("../database");
const { v4: uuidv4 } = require("uuid");

//! Before

const backUser = async (req, res) => {
  const { email, password } = req.body;
  if (
    email == null ||
    password == null ||
    email.length === 0 ||
    password.length === 0
  ) {
    res.status(404).json({ message: "Something is missing" });
    return;
  } else if (
    (await validator.isEmail(email)) &&
    (await validator.isLength(password, { min: 8, max: undefined }))
  ) {
    pool.query(quires.getUserLogin, [email, password], (err, result) => {
      if (err) throw err;
      if (result.rowCount == 0) {
        res
          .status(404)
          .json({ message: "Email or password is incorrect", success: false });
        return;
      }
      pool.query(quires.userId, [email], async (err, fin) => {
        if (err) throw err;
        req.session.regenerate(async function (err) {
          if (err) throw err;
          req.session.save(function (err) {
            if (err) return next(err);
            req.session.user_id = await fin.rows[0].user_id;
            res.status(200).json({
              message: "Welcome back!",
              success: true,
            });
          });
        });
        return;
      });
    });
  } else {
    res
      .status(400)
      .json({ message: "Something went wrong please check your inputs" });
  }
};

const addUser = async (req, res) => {
  const { email, password, name, username, phone, bio } = req.body;
  if (
    !email ||
    !password ||
    !name ||
    !username ||
    !phone ||
    !bio ||
    email.trim().length === 0 ||
    password.trim().length === 0 ||
    name.trim().length === 0 ||
    username.trim().length === 0 ||
    phone.trim().length === 0 ||
    bio.trim().length === 0
  ) {
    res.status(400).json({ message: "Please fill out all required fields" });
    return;
  }

  try {
    const first = await pool.query(quires.getUser, [email]);
    if (first.rowCount > 0) {
      res.status(409).json({
        message: "Email already exists, try logging in",
        success: false,
      });
      return;
    }

    if (
      (await validator.isEmail(email)) &&
      (await validator.isLength(password, {
        min: 8,
        max: 10,
      })) &&
      (await validator.isLength(name, { min: 2, max: 20 })) &&
      (await validator.isLength(username, {
        min: 4,
        max: 20,
      })) &&
      (await validator.isLength(phone, { min: 4, max: 10 })) &&
      (await validator.isLength(bio, { min: 15, max: 200 }))
    ) {
      pool.query(quires.AddUser, [email, password, name], async (err, fin) => {
        if (err) throw err;
        const { rows } = await pool.query(quires.userId, [email]);
        pool.query(
          quires.addUserData,
          [await rows[0].user_id, username, phone, bio],
          async (err, da) => {
            if (!err) {
              req.session.regenerate(async function (err) {
                if (err) throw err;
                req.session.user_id = await rows[0].user_id;
                req.session.save(function (err) {
                  if (err) return next(err);
                  res.status(201).send({
                    message: "User created successfully!",
                    success: true,
                    user_id: rows[0].user_id,
                  });
                });
              });
              return;
            }
            throw err;
          }
        );
      });
    } else {
      res.status(400).json({
        message: "Something went wrong, please check your inputs",
        success: false,
      });
      return;
    }
  } catch (err) {
    console.error("Error during addUser:", err);
    res.status(500).json({ message: "Something went wrong", success: false });
  }
};

//! After
const sendData = async (req, res) => {
  let obj = [];
  let pro1;
  let pro2;

  const id = await req.session.user_id;
  try {
    const getRec = await pool.query(quires.getReceiverId, [id]);
    const getSen = await pool.query(quires.getSenderId, [id]);
    if (getRec.rowCount == 0 && getSen.rowCount == 0) {
      res.json({
        message: "Your list is empty!",
        success: false,
      });
    } else if (getRec.rowCount !== 0 && getSen.rowCount !== 0) {
      const addReceiver = getRec.rows.map(async (ele) => {
        const fin = await pool.query(quires.getAllById, [ele.sender_id]);
        const bioo = await pool.query(quires.getUserData, [ele.sender_id]);
        return obj.push({
          message: "You received this!",
          success: true,
          type: "receiver",
          email: fin.rows[0].email,
          name: fin.rows[0].name,
          bio: bioo.rows[0].bio,
        });
      });

      const getIt = getSen.rows.map(async (ele) => {
        const fin = await pool.query(quires.getAllById, [ele.receiver_id]);
        return obj.push({
          message: "You sended this",
          success: true,
          type: "sender",
          email: fin.rows[0].email,
          name: fin.rows[0].name,
        });
      });
      pro1 = await Promise.all(getIt);
      pro2 = await Promise.all(addReceiver);
      res.json(obj);
    } else if (getRec.rowCount == 0 && getSen.rowCount !== 0) {
      const getIt = getSen.rows.map(async (ele) => {
        const fin = await pool.query(quires.getAllById, [ele.receiver_id]);
        // const bioo = await pool.query(quires.getUserData, [ele.receiver_id]);
        return {
          message: "You sended this",
          success: true,
          type: "sender",
          email: fin.rows[0].email,
          name: fin.rows[0].name,
          // bio: bioo.rows[0].bio,
        };
      });
      obj = await Promise.all(getIt);
      res.json(obj);
    } else if (getRec.rowCount !== 0 && getSen.rowCount == 0) {
      const addReceiver = getRec.rows.map(async (ele) => {
        const fin = await pool.query(quires.getAllById, [ele.sender_id]);
        const bioo = await pool.query(quires.getUserData, [ele.sender_id]);
        return {
          message: "You received this!",
          success: true,
          type: "receiver",
          email: fin.rows[0].email,
          name: fin.rows[0].name,
          bio: bioo.rows[0].bio,
        };
      });
      obj = await Promise.all(addReceiver);

      res.json(obj);
    }
  } catch (error) {
    throw error;
  }
};

const searchUser = async (req, res) => {
  const email = req.body.email;
  const session_id = await req.session.user_id;
  if (await validator.isEmail(email)) {
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(email)) {
      res.json({ message: "Please enter a proper email.", success: false });
      return;
    }
    pool.query(quires.getUser, [email], async (err, result) => {
      if (!err) {
        pool.query(quires.searchUser, [email], async (err, result) => {
          if (!err) {
            if (result.rowCount == 0) {
              res
                .status(404)
                .json({ message: "User not found", success: false });
              return;
            }
            if ((await result.rows[0].user_id) == (await req.session.user_id)) {
              res.json({
                message: "You can't search for your self",
                success: false,
              });
              return;
            }
            const id = await result.rows[0].user_id;
            try {
              const fromSender = await pool.query(quires.getAllByIds, [
                id,
                session_id,
              ]);
              if (fromSender.rowCount > 0) {
                res.json({
                  message: "There is already a connection",
                  success: false,
                });
                return;
              }
            } catch (error) {
              throw error;
            }
            pool.query(quires.getUserData, [await id], async (err, fin) => {
              if (err) throw err;
              const { phone, bio, color } = await fin.rows[0];
              result.rows[0]["phone"] = phone;
              result.rows[0]["bio"] = bio;
              result.rows[0]["color"] = color;
              res.json(result.rows);
              return;
            });
          } else throw err;
        });
      }
    });
  } else {
    res.json({ message: "Please type a proper email", success: false });
  }
};

const requestUser = async (req, res) => {
  const { email } = req.body;
  const id = await req.session.user_id;
  try {
    if (await validator.isEmail(email)) {
      pool.query(quires.getIdByEmail, [email], async (err, result) => {
        if (err) throw err;

        const receiverId = await result.rows[0].user_id;
        // checking
        const check2 = await pool.query(quires.checkExistingWaitingFriendReq, [
          id,
          receiverId,
        ]);
        if (check2.rowCount > 0) {
          res.json({
            message: "You already have a friend request from this user",
            success: false,
          });
          return;
        }
        const check1 = await pool.query(quires.checkExistingFriendRequest, [
          id,
          receiverId,
        ]);
        if (check1.rowCount > 0) {
          res.json({
            message: "You can't send more than one request!",
            success: false,
          });
          return;
        }
        pool.query(
          quires.addFriendRequest,
          [id, receiverId, "sent"],
          (err, result) => {
            if (err) throw err;
            res.json({
              message: "Request send successfully! (waiting for response)",
              success: true,
            });
          }
        );
      });
    }
  } catch (error) {
    throw error;
  }
};

const deleteRequest = async (req, res) => {
  const { email } = req.params;
  const id = req.session.user_id;
  const userId = await pool.query(quires.getIdByEmail, [email]);
  pool.query(quires.deleteRequest, [userId.rows[0].user_id, id], (err) => {
    if (err) throw err;
    res.json({ message: "Deleted successfully" });
    return;
  });
};

const acceptRequest = async (req, res) => {
  const id = await req.session.user_id;
  const { email } = req.body;
  const friendId = await pool.query(quires.getIdByEmail, [email]);
  req.session.friendId = await friendId.rows[0].user_id;
  pool.query(
    quires.checkRoomExits,
    [id, await friendId.rows[0].user_id],
    async (err, result) => {
      if (err) throw err;
      if (result.rowCount > 0) {
        res.json({
          message: "already have as a connection",
          success: false,
        });
      } else {
        pool.query(
          quires.updateStateFri,
          [await friendId.rows[0].user_id, id],
          (err) => {
            if (err) throw err;
          }
        );
        pool.query(
          quires.addRoom,
          [id, uuidv4(), await friendId.rows[0].user_id],
          async (err) => {
            if (err) throw err;
          }
        );
        pool.query(
          quires.addIntoList,
          [id, await friendId.rows[0].user_id],
          async (err, result) => {
            if (err) throw err;
          }
        );
        pool.query(
          quires.deleteRequest,
          [friendId.rows[0].user_id, id],
          (err) => {
            if (err) throw err;
            res.json({ message: "Connection!", success: true });
            return;
          }
        );
      }
    }
  );
};

const sendChats = async (req, res) => {
  const id = await req.session.user_id;
  try {
    const fromSender = await pool.query(quires.getAllByIds2, [id]);
    if (fromSender.rowCount > 0) {
      const rows = fromSender.rows;
      const responseData = [];
      for (const row of rows) {
        if (id == (await row.user_id)) {
          const data = await pool.query(quires.getAllById, [row.friendl_id]);
          const roomId = await pool.query(quires.getIdRoom, [
            id,
            row.friendl_id,
          ]);
          const bioo = await pool.query(quires.getUserData, [row.friendl_id]);
          responseData.push({
            message: "User accepted",
            success: true,
            name: await data.rows[0].name,
            email: await data.rows[0].email,
            room: roomId.rowCount == 0 ? 0 : await roomId.rows[0].roomn,
            bio: await bioo.rows[0].bio,
          });
        } else if (id == row.friendl_id) {
          const data = await pool.query(quires.getAllById, [row.user_id]);
          const roomId = await pool.query(quires.getIdRoom, [row.user_id, id]);
          const bioo = await pool.query(quires.getUserData, [row.user_id]);
          responseData.push({
            message: "You accepted this",
            success: true,
            name: await data.rows[0].name,
            email: await data.rows[0].email,
            room: roomId.rowCount == 0 ? 0 : await roomId.rows[0].roomn,
            bio: await bioo.rows[0].bio,
            phone: await bioo.rows[0].phone,
            username: await bioo.rows[0].username,
          });
        } else {
          responseData.push({
            message: "You don't have any connections",
            success: false,
          });
        }
      }
      res.json(responseData);
    } else {
      res.json({ message: "You don't have any connections!", success: false });
    }
  } catch (error) {
    throw error;
  }
};

const convertTime24to12 = (time24h) => {
  let time = time24h
    .toString()
    .match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time24h];

  if (time.length > 1) {
    time = time.slice(1, -1);
    time[5] = +time[0] < 12 ? " am" : " pm";
    time[0] = +time[0] % 12 || 12;
  }
  return time.join("");
};

const getHistory = async (req, res) => {
  const id = await req.session.user_id;
  const { email } = await req.body;
  pool.query(quires.getIdByEmail, [email], async (err, result) => {
    if (err) throw err;
    const friendId = await result.rows[0].user_id;
    pool.query(quires.getHis, [id, friendId], async (err, result) => {
      if (err) throw err;
      pool.query(quires.getIdRoomBoth, [id, friendId], async (err, result2) => {
        if (err) throw err;
        const room = await result2.rows[0].roomn;
        const pastMessages = [];
        result.rows.map((ele) => {
          pastMessages.push({
            author: ele.author,
            message: ele.message,
            time: convertTime24to12(ele.time),
            id: id,
            room: room,
          });
        });
        res.json(pastMessages);
      });
    });
  });
};

const deleteChat = async (req, res) => {
  const id = await req.session.user_id;
  const { email } = await req.body;

  pool.query(quires.getIdByEmail, [email], async (err, result) => {
    if (err) throw err;
    const friendId = await result.rows[0].user_id;
    pool.query(quires.delFromFri, [id, friendId], (err) => {
      if (err) throw err;
    });
    pool.query(quires.delFromCon, [id, friendId], (err) => {
      if (err) throw err;
    });
    pool.query(quires.delFromHis, [id, friendId], (err) => {
      if (err) throw err;
    });
    res.json({ message: "User deleted successfully!" });
    return;
  });
};

module.exports = {
  backUser,
  addUser,
  searchUser,
  requestUser,
  sendData,
  deleteRequest,
  acceptRequest,
  sendChats,
  getHistory,
  deleteChat,
};
