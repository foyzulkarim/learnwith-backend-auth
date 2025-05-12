import { FastifyReply, FastifyRequest } from 'fastify';
import { CourseService } from './course.service';

export class CourseController {
  constructor(private courseService: CourseService) {}

  async getAllCoursesHandler(_request: FastifyRequest, reply: FastifyReply) {
    const courses = await this.courseService.getAllCourses();
    reply.send(courses);
  }
}
