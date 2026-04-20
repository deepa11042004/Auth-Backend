const courseService = require('../services/courseService');

async function getPublishedCourses(req, res, next) {
  try {
    const usePagination = req.query.page !== undefined || req.query.limit !== undefined;

    const result = await courseService.getPublishedCourses({
      page: req.query.page,
      limit: req.query.limit,
    });

    if (usePagination) {
      return res.status(200).json(result);
    }

    return res.status(200).json(result.courses);
  } catch (err) {
    return next(err);
  }
}

async function getCourseBySlug(req, res, next) {
  try {
    const course = await courseService.getPublishedCourseDetailBySlug(req.params.slug);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    return res.status(200).json(course);
  } catch (err) {
    return next(err);
  }
}

async function createCourse(req, res, next) {
  try {
    const result = await courseService.createCourse(req.body || {}, req.user || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getPublishedCourses,
  getCourseBySlug,
  createCourse,
};
