require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/config/db');

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET environment variable');
      process.exit(1);
    }

    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('MySQL Connected');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();
