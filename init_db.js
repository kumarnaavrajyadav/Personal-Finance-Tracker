const pool = require('./db');

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      INSERT INTO users (name, email, password)
      VALUES ('Navraj', 'navraj@gmail.com', '123456')
      ON CONFLICT (email) DO NOTHING;
    `);

    console.log("✅ Tables + user ready");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
