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

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the running process or change PORT in .env.`);
      } else {
        console.error('Server listen error:', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();
