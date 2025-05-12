import { FastifyInstance } from 'fastify';
import { getCourseModel, CourseDocument } from './course.model';
import { Course } from './types';

export class CourseService {
  private courseModel;

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
  }

  async getAllCourses(): Promise<Course[]> {
    const courses = await this.courseModel.find();
    return courses.map(this.convertToCourse);
  }

  private convertToCourse(courseDoc: CourseDocument): Course {
    const course = courseDoc.toObject();
    return {
      ...course,
      id: course.id,
      isNew: course.isNew,
    };
  }
}
