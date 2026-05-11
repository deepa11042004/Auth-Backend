const swaggerJSDoc = require('swagger-jsdoc');

const PORT = Number(process.env.PORT) || 5000;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'BSERC Common Auth Backend API',
      version: '1.0.0',
      description:
        'Common backend APIs for BSERC website, Android app, and iOS app.',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication and user account endpoints',
      },
      {
        name: 'Workshops',
        description: 'Workshop registration endpoints',
      },
      {
        name: 'Mentors',
        description: 'Mentor registration and profile endpoints',
      },
      {
        name: 'Advisory',
        description: 'Advisory board application and moderation endpoints',
      },
      {
        name: 'Internships',
        description: 'Summer internship application and payment endpoints',
      },
      {
        name: 'Summer School',
        description: 'Summer school student registration endpoints',
      },
      {
        name: 'Institutional Registrations',
        description: 'Institutional registration form submission endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
