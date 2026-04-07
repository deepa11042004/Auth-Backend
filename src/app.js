require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const workshopRoutes = require('./routes/workshopRoutes');
const workshopListRoutes = require('./routes/workshopListRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const internshipRoutes = require('./routes/internshipRoutes');
const summerSchoolRoutes = require('./routes/summerSchoolRoutes');
const errorHandler = require('./middleware/errorHandler');
const swaggerSpec = require('./config/swagger');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/auth', authRoutes);
app.use('/api', courseRoutes);
app.use('/api', workshopRoutes);
app.use('/api', workshopListRoutes);
app.use('/api', mentorRoutes);
app.use('/api', internshipRoutes);
app.use('/api', summerSchoolRoutes);

app.use(errorHandler);

module.exports = app;
