const pool = require('./db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        profile_picture TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;
    `, ['Navraj', 'navraj@gmail.com', hashedPassword]);

    console.log("✅ Tables + user (with hashed password) ready");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

