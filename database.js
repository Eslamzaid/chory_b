const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.SECRET_HOST,
  user: process.env.SECRET_USER,
  database: process.env.SECRET_DB,
  password: process.env.SECRET_PASS,
  port: process.env.SECRET_POST,
});

module.exports = pool;
