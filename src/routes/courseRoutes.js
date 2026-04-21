const express = require('express');
const courseController = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');
const authAdmin = require('../middleware/authAdmin');
const roleMiddleware = require('../middleware/roleMiddleware');
const { uploadCourseThumbnail } = require('../middleware/courseThumbnailUpload');
const roles = require('../constants/roles');

const router = express.Router();

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get courses list from LMS courses table
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: Courses fetched successfully
 */
router.get('/courses', courseController.getPublishedCourses);

/**
 * @openapi
 * /api/courses/{slug}:
 *   get:
 *     tags: [Courses]
 *     summary: Get course details by slug from LMS courses table
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course detail fetched successfully
 *       404:
 *         description: Course not found
 */
router.get('/courses/:slug', courseController.getCourseBySlug);

/**
 * @openapi
 * /api/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course record in LMS courses table
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Course created
 *       403:
 *         description: Forbidden
 */
router.post(
  '/courses',
  authMiddleware,
  roleMiddleware(roles.INSTRUCTOR, roles.ADMIN, roles.SUPER_ADMIN),
  courseController.createCourse
);

/**
 * @openapi
 * /api/admin/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course record in LMS courses table (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Course created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 */
router.post('/admin/courses', authAdmin, uploadCourseThumbnail, courseController.createAdminCourse);

module.exports = router;
