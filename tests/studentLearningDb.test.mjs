import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createLearningService } from '../server/learningService.js';
import { createStudentLearningService } from '../server/services/studentLearningService.js';

loadEnvFile();

const prisma = new PrismaClient();
const studentLearningService = createStudentLearningService(prisma);
const learningService = createLearningService(prisma);
const studentId = 'stu-chenyu';
const courseId = 'course-student-join-test';
const questionId = 'q-student-join-test';

async function cleanup() {
  await prisma.studentAnswer.deleteMany({ where: { questionId } });
  await prisma.studentCourseEnrollment.deleteMany({ where: { courseId } });
  await prisma.classroomSession.deleteMany({ where: { courseId } });
  await prisma.question.deleteMany({ where: { id: questionId } });
  await prisma.course.deleteMany({ where: { id: courseId } });
}

try {
  await cleanup();
  await prisma.course.create({
    data: {
      id: courseId,
      title: '学生自选课程测试',
      subject: '物理',
      grade: '高一',
      description: '用于验证学生端手动加入课程。',
      questions: {
        create: {
          id: questionId,
          type: '选择题',
          stage: '课后练习',
          difficulty: '基础',
          title: '合力为 6N，质量为 2kg，加速度是多少？',
          options: ['A. 3m/s²', 'B. 12m/s²'],
          answer: { value: 'A. 3m/s²' },
          analysis: '根据 F=ma，a=F/m=3m/s²。',
          knowledge: ['牛顿第二定律']
        }
      }
    }
  });

  const dashboard = await studentLearningService.getDashboard(studentId);
  assert.equal(dashboard.student.name, '陈雨');
  assert.equal(dashboard.student.className, '高一 3 班');
  assert.equal('teacher' in dashboard.student, false);

  const catalogBeforeJoin = await studentLearningService.listCourseCatalog(studentId);
  const catalogCourseBeforeJoin = catalogBeforeJoin.find((course) => course.id === courseId);
  assert.equal(catalogCourseBeforeJoin.source, 'available');
  assert.equal(catalogCourseBeforeJoin.joined, false);

  const joined = await studentLearningService.joinCourse(studentId, { courseId });
  assert.equal(joined.course.title, '学生自选课程测试');
  assert.equal(joined.course.source, 'joined');
  assert.ok(joined.enrollment.sessionId, 'join should create a personal practice session');

  const catalogAfterJoin = await studentLearningService.listCourseCatalog(studentId);
  const catalogCourseAfterJoin = catalogAfterJoin.find((course) => course.id === courseId);
  assert.equal(catalogCourseAfterJoin.source, 'joined');
  assert.equal(catalogCourseAfterJoin.joined, true);

  const course = await studentLearningService.getCourse(studentId, courseId);
  assert.equal(course.tasks.length, 1);
  assert.equal(course.tasks[0].id, joined.enrollment.sessionId);

  const task = await studentLearningService.getTask(studentId, joined.enrollment.sessionId);
  assert.equal(task.questions[0].id, questionId);

  await studentLearningService.saveAnswer(studentId, joined.enrollment.sessionId, {
    questionId,
    answer: { value: 'A. 3m/s²' },
    durationSeconds: 12
  });

  const records = await learningService.getQuestionAnswerRecords({
    studentId,
    courseId,
    page: 1,
    pageSize: 20
  });
  assert.equal(records.total, 1);
  assert.equal(records.records[0].studentName, '陈雨');
  assert.equal(records.records[0].questionTitle, '合力为 6N，质量为 2kg，加速度是多少？');
  assert.equal(records.records[0].isCorrect, true);

  console.log('student learning database contracts passed');
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
