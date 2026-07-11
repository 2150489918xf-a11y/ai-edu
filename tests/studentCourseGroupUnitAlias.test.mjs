import assert from 'node:assert/strict';

import { createStudentLearningService } from '../server/services/studentLearningService.js';

const student = {
  id: 'stu-chenyu',
  name: '陈雨',
  studentNo: 'S001',
  classId: 'class-1',
  status: 'active',
  class: {
    id: 'class-1',
    name: '高一 3 班',
    grade: '高一',
    subject: '数学',
    teacher: { id: 'teacher-1', name: '张老师' }
  }
};

const group = {
  id: 'group-math-grade1',
  title: '高一数学',
  subject: '数学',
  grade: '高一',
  description: '',
  teacher: { id: 'teacher-1', name: '张老师' },
  units: [
    {
      id: 'dev-course-quadratic',
      title: '二次函数',
      subject: '数学',
      grade: '高一',
      description: '',
      questions: [{ id: 'q-1', status: 'active' }]
    }
  ]
};

const session = {
  id: 'session-quadratic',
  classId: 'class-1',
  courseId: 'dev-course-quadratic',
  title: '二次函数练习',
  status: 'active',
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  endedAt: null,
  course: {
    id: 'dev-course-quadratic',
    title: '二次函数',
    subject: '数学',
    grade: '高一',
    description: '',
    teacher: { id: 'teacher-1', name: '张老师' },
    group,
    questions: [{ id: 'q-1', type: 'choice', title: '题目', options: ['A'], status: 'active' }]
  },
  answers: [],
  sessionQuestions: []
};

const prisma = {
  student: {
    async findFirst() {
      return student;
    }
  },
  classroomSession: {
    async findMany() {
      return [session];
    }
  },
  studentCourseEnrollment: {
    async findMany() {
      return [];
    }
  },
  studentCourseGroupEnrollment: {
    async findMany() {
      return [];
    }
  },
  course: {
    async findFirst(query) {
      assert.equal(query.where.id, 'dev-course-quadratic');
      return { id: 'dev-course-quadratic', groupId: 'group-math-grade1' };
    }
  }
};

const service = createStudentLearningService(prisma);
const detail = await service.getCourseGroup('stu-chenyu', 'dev-course-quadratic');

assert.equal(detail.id, 'group-math-grade1');
assert.equal(detail.units[0].id, 'dev-course-quadratic');
assert.equal(detail.tasks[0].id, 'session-quadratic');

console.log('student course group unit alias contracts passed');
