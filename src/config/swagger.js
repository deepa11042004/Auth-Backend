const swaggerJSDoc = require('swagger-jsdoc');

const PORT = Number(process.env.PORT) || 5000;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'BSERC Common Auth Backend API',
      version: '1.0.0',
      description:
        'Common backend APIs for BSERC website, LMS portal, Android app, and iOS app.',
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
        name: 'Courses',
        description: 'LMS course, curriculum, and enrollment endpoints',
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
        name: 'Internships',
        description: 'Summer internship application and payment endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
