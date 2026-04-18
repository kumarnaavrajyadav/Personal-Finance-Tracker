const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "127.0.0.1", // Changed from localhost to 127.0.0.1 for stability on Mac
  user: "root",
  password: "Navraj@#123",
  database: "finance_tracker"
});

db.connect(err => {
  if (err) {
    console.error("DB Connection Failed:", err);
  } else {
    console.log("✅ Connected to MySQL Database");
  }
});

module.exports = db;
