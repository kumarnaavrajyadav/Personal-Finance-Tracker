require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "./")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// DB Health Check (visit /test after deploy to verify)
app.get("/test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ status: "✅ DB connected", time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "❌ DB error", error: err.message });
  }
});

const SECRET = process.env.JWT_SECRET || "secretkey"; 

// Multer Storage Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// =========================
// 🔒 AUTH MIDDLEWARE
// =========================
const auth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user_id = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// =========================
// 🔐 SIGNUP
// =========================
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id";

    db.query(sql, [name, email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "23505") { // PostgreSQL unique violation code
          return res.status(400).json({ message: "Email already exists" });
        }
        return res.status(500).json(err);
      }
      res.json({ message: "User registered successfully" });
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
});

// =========================
// 🔐 LOGIN
// =========================
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = $1", [email], async (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id, name: user.name }, SECRET, { expiresIn: "1d" });

    res.json({
      message: "Login successful",
      token,
      user_id: user.id,
      name: user.name,
      profile_picture: user.profile_picture
    });
  });
});

// =========================
// 📸 UPLOAD PROFILE IMAGE
// =========================
app.post("/upload-profile", auth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const imageUrl = `/uploads/${req.file.filename}`;
  const sql = "UPDATE users SET profile_picture = $1 WHERE id = $2";

  db.query(sql, [imageUrl, req.user_id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Profile picture updated", imageUrl });
  });
});


// =========================
// ➕ ADD TRANSACTION
// =========================
app.post("/transaction", auth, (req, res) => {
  const { description, amount, type, category, date } = req.body;

  const sql = `
    INSERT INTO transactions 
    (user_id, description, amount, type, category, date)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;

  db.query(sql, [req.user_id, description, amount, type, category, date], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Transaction added" });
  });
});

// =========================
// 📥 GET TRANSACTIONS
// =========================
app.get("/transactions", auth, (req, res) => {
  db.query(
    "SELECT * FROM transactions WHERE user_id=$1 ORDER BY date DESC",
    [req.user_id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result.rows);
    }
  );
});

// =========================
// 📝 UPDATE TRANSACTION
// =========================
app.put("/transaction/:id", auth, (req, res) => {
  const { description, amount, type, category, date } = req.body;
  const { id } = req.params;

  const sql = `
    UPDATE transactions 
    SET description=$1, amount=$2, type=$3, category=$4, date=$5
    WHERE id=$6 AND user_id=$7
  `;

  db.query(sql, [description, amount, type, category, date, id, req.user_id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.rowCount === 0) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Transaction updated" });
  });
});

// =========================
// 🗑️ DELETE TRANSACTION
// =========================
app.delete("/transaction/:id", auth, (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM transactions WHERE id=$1 AND user_id=$2", [id, req.user_id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.rowCount === 0) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Transaction deleted" });
  });
});


// =========================
// 🎯 SET BUDGET
// =========================
app.post("/budget", auth, (req, res) => {
  const { category, budget_limit, month, year } = req.body;

  const sql = `
    INSERT INTO budgets (user_id, category, budget_limit, month, year)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, category, month, year) 
    DO UPDATE SET budget_limit = EXCLUDED.budget_limit
  `;

  db.query(sql, [req.user_id, category, budget_limit, month, year], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Budget saved" });
  });
});

// =========================
// 🗑️ DELETE BUDGET
// =========================
app.delete("/budget/:category", auth, (req, res) => {
  const { category } = req.params;

  db.query(
    "DELETE FROM budgets WHERE category=$1 AND user_id=$2",
    [category, req.user_id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.rowCount === 0) return res.status(404).json({ message: "Budget not found" });
      res.json({ message: "Budget deleted" });
    }
  );
});

// =========================
// 📊 BUDGET VS SPENDING
// =========================
app.get("/budget", auth, (req, res) => {
  const sql = `
    SELECT 
      b.category,
      b.budget_limit,
      COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END), 0) AS spent
    FROM budgets b
    LEFT JOIN transactions t 
      ON b.user_id = t.user_id 
      AND b.category = t.category 
      AND EXTRACT(MONTH FROM t.date::date) = b.month 
      AND EXTRACT(YEAR FROM t.date::date) = b.year
    WHERE b.user_id = $1
    GROUP BY b.category, b.budget_limit
  `;

  db.query(sql, [req.user_id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result.rows);
  });
});

// =========================
// ⚙️ SETTINGS
// =========================
app.post("/settings", auth, (req, res) => {
  const { currency, theme, monthly_income } = req.body;

  const sql = `
    INSERT INTO settings (user_id, currency, theme, monthly_income)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      currency = EXCLUDED.currency, 
      theme = EXCLUDED.theme, 
      monthly_income = EXCLUDED.monthly_income
  `;

  db.query(
    sql,
    [req.user_id, currency, theme, monthly_income],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Settings updated" });
    }
  );
});

// =========================
// 🚀 START SERVER
// =========================
const PORT = process.env.PORT || 5001; 
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
