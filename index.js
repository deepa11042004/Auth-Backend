require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRouter = require('./routes/auth');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Auth routes
app.use('/auth', authRouter);

// Test route
app.get('/', (req, res) => {
  res.send('API is running');
});

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
    console.error('MySQL connection error:', err);
    process.exit(1);
  }
}

start();
