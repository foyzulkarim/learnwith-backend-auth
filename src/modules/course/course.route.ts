import { FastifyInstance } from 'fastify';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';

export default async function courseRoutes(fastify: FastifyInstance) {
  const courseService = new CourseService(fastify);
  const courseController = new CourseController(courseService);

  // Get courses
  fastify.get('/', courseController.getAllCoursesHandler.bind(courseController));
  fastify.get('/categories', courseController.getCategoriesHandler.bind(courseController));
  fastify.get('/:courseId', courseController.getCourseByIdHandler.bind(courseController));
  fastify.get(
    '/:courseId/lessons',
    courseController.getCourseLessonsHandler.bind(courseController),
  );

  // Course CRUD
  fastify.post('/', courseController.createCourseHandler.bind(courseController));
  fastify.post('/save', courseController.saveCourseHandler.bind(courseController));
  fastify.patch('/:courseId', courseController.updateCourseHandler.bind(courseController));
  fastify.delete('/:courseId', courseController.deleteCourseHandler.bind(courseController));

  // Module CRUD
  fastify.get(
    '/:courseId/modules',
    courseController.getCourseModulesHandler.bind(courseController),
  );
  fastify.post('/modules', courseController.createModuleHandler.bind(courseController));
  fastify.patch('/modules/:moduleId', courseController.updateModuleHandler.bind(courseController));
  fastify.delete('/modules/:moduleId', courseController.deleteModuleHandler.bind(courseController));

  // Lesson CRUD
  fastify.post('/lessons', courseController.createLessonHandler.bind(courseController));
  fastify.patch('/lessons/:lessonId', courseController.updateLessonHandler.bind(courseController));
  fastify.delete('/lessons/:lessonId', courseController.deleteLessonHandler.bind(courseController));
}
