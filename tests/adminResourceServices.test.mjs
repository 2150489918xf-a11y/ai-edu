import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { loadEnvFile } from '../server/env.js';
import { createClassService } from '../server/services/classService.js';
import { createCourseService } from '../server/services/courseService.js';
import { createStudentService } from '../server/services/studentService.js';

loadEnvFile();

const prisma = new PrismaClient();
const classService = createClassService(prisma);
const courseService = createCourseService(prisma);
const studentService = createStudentService(prisma);
const suffix = Date.now();
const username = `admin-student-${suffix}`;
let sourceClass;
let targetClass;
let student;
let course;

try {
  const teacher = await prisma.teacher.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } });
  assert.ok(teacher, '测试需要至少一名有效教师');

  sourceClass = await classService.createClass({
    name: `教务测试源班 ${suffix}`,
    grade: '高一',
    subject: '物理',
    teacherId: teacher.id
  });
  targetClass = await classService.createClass({
    name: `教务测试目标班 ${suffix}`,
    grade: '高一',
    subject: '物理',
    teacherId: teacher.id
  });
  assert.equal(sourceClass.teacherId, teacher.id);
  assert.equal(sourceClass.teacherName, teacher.name);

  student = await studentService.createStudent({
    name: `教务测试学生 ${suffix}`,
    username,
    password: 'student123',
    classId: sourceClass.id,
    studentNo: `ADM-${suffix}`
  });
  assert.equal(student.username, username);
  assert.ok(student.userId, '创建学生时应同时创建登录账号');
  const foundByUsername = await studentService.listStudents({ keyword: username, status: 'active' });
  assert.equal(foundByUsername.total, 1, '学生列表应支持按登录账号查询');

  student = await studentService.updateStudent(student.id, { classId: targetClass.id });
  assert.equal(student.classId, targetClass.id);

  await assert.rejects(
    () => classService.archiveClass(targetClass.id),
    (error) => error.statusCode === 409 && error.code === 'CLASS_NOT_EMPTY'
  );

  student = await studentService.archiveStudent(student.id);
  assert.equal(student.status, 'archived');
  assert.equal((await prisma.user.findUnique({ where: { id: student.userId } })).status, 'archived');

  student = await studentService.restoreStudent(student.id);
  assert.equal(student.status, 'active');
  assert.equal((await prisma.user.findUnique({ where: { id: student.userId } })).status, 'active');

  course = await courseService.createCourse({
    title: `教务课程 ${suffix}`,
    subject: '物理',
    grade: '高一',
    teacherId: teacher.id,
    description: '验证教务端课程教师分配'
  });
  assert.equal(course.teacherId, teacher.id);
  assert.equal(course.teacher, teacher.name);

  course = await courseService.updateCourse(course.id, { teacherId: teacher.id, duration: '50 分钟' });
  assert.equal(course.teacherId, teacher.id);
  assert.equal(course.duration, '50 分钟');

  console.log('admin resource service contracts passed');
} finally {
  if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } });
  if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } });
  await prisma.user.deleteMany({ where: { username } });
  if (sourceClass?.id || targetClass?.id) {
    await prisma.class.deleteMany({ where: { id: { in: [sourceClass?.id, targetClass?.id].filter(Boolean) } } });
  }
  await prisma.$disconnect();
}
