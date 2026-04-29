require('dotenv').config();
const app = require('./src/app');
const bsercDB = require('./src/config/db');
const { ensureRegistrationTable } = require('./src/models/Registration');

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET environment variable');
      process.exit(1);
    }

    const bsercConnection = await bsercDB.getConnection();
    await bsercConnection.ping();
    bsercConnection.release();

    console.log('MySQL Connected (bserc_core_db)');

    await ensureRegistrationTable(bsercDB);
    console.log('Registration table ensured');

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
