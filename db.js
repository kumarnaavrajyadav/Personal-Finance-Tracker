const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err.message);
  } else {
    console.log("✅ Connected to PostgreSQL Database");
  }
});

module.exports = pool;
