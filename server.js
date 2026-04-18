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

const SECRET = "secretkey"; 

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
    const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";

    db.query(sql, [name, email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
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

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result[0];
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
  const sql = "UPDATE users SET profile_picture = ? WHERE id = ?";

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
    VALUES (?, ?, ?, ?, ?, ?)
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
    "SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC",
    [req.user_id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
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
    SET description=?, amount=?, type=?, category=?, date=?
    WHERE id=? AND user_id=?
  `;

  db.query(sql, [description, amount, type, category, date, id, req.user_id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Transaction updated" });
  });
});

// =========================
// 🗑️ DELETE TRANSACTION
// =========================
app.delete("/transaction/:id", auth, (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM transactions WHERE id=? AND user_id=?", [id, req.user_id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Transaction not found" });
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
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE budget_limit = VALUES(budget_limit)
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
    "DELETE FROM budgets WHERE category=? AND user_id=?",
    [category, req.user_id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) return res.status(404).json({ message: "Budget not found" });
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
      AND MONTH(t.date) = b.month 
      AND YEAR(t.date) = b.year
    WHERE b.user_id = ?
    GROUP BY b.category, b.budget_limit
  `;

  db.query(sql, [req.user_id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// =========================
// ⚙️ SETTINGS
// =========================
app.post("/settings", auth, (req, res) => {
  const { currency, theme, monthly_income } = req.body;

  const sql = `
    INSERT INTO settings (user_id, currency, theme, monthly_income)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    currency=?, theme=?, monthly_income=?
  `;

  db.query(
    sql,
    [req.user_id, currency, theme, monthly_income, currency, theme, monthly_income],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Settings updated" });
    }
  );
});

// =========================
// 🚀 START SERVER
// =========================
const PORT = 5001; // Standardized on 5001 for Mac compatibility
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
