require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// quick test on startup
pool.query('SELECT 1')
  .then(() => console.log('✅ DB connected'))
  .catch(err => console.error('❌ DB error:', err.message));

// Quick debug (important)
console.log("DATABASE_URL:", process.env.DATABASE_URL);

module.exports = pool;

