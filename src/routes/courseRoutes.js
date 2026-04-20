const express = require('express');
const courseController = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const roles = require('../constants/roles');

const router = express.Router();

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get published courses list
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
 *     summary: Get full course details by slug
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
 *     summary: Create a course (instructor/admin/super_admin)
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

module.exports = router;
