import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createClassService } from '../server/services/classService.js';
import { createStudentService } from '../server/services/studentService.js';

loadEnvFile();

const prisma = new PrismaClient();
const classService = createClassService(prisma);
const studentService = createStudentService(prisma);
const suffix = Date.now();
let createdClass;
let targetClass;
let createdStudent;

try {
  createdClass = await classService.createClass({
    name: `高一 CRUD ${suffix} 班`,
    grade: '高一',
    subject: '物理'
  });
  assert.equal(createdClass.status, 'active');
  assert.equal(createdClass.deletedAt, null);

  targetClass = await classService.createClass({
    name: `高一 CRUD ${suffix} 转入班`,
    grade: '高一',
    subject: '物理'
  });

  const classList = await classService.listClasses({ keyword: String(suffix), status: 'active', page: 1, pageSize: 20 });
  assert.equal(classList.total, 2);

  const classDetail = await classService.getClass(createdClass.id);
  assert.equal(classDetail.name, createdClass.name);

  const classUpdated = await classService.updateClass(createdClass.id, { name: `${createdClass.name} 更新` });
  assert.equal(classUpdated.name, `${createdClass.name} 更新`);

  createdStudent = await studentService.createStudent({
    name: `学生 ${suffix}`,
    classId: createdClass.id,
    studentNo: `S${suffix}`
  });
  assert.equal(createdStudent.status, 'active');
  assert.equal(createdStudent.classId, createdClass.id);

  const studentList = await studentService.listStudents({ classId: createdClass.id, page: 1, pageSize: 20 });
  assert.equal(studentList.total, 1);
  assert.equal(studentList.students[0].id, createdStudent.id);

  const studentUpdated = await studentService.updateStudent(createdStudent.id, {
    name: `学生 ${suffix} 更新`,
    studentNo: `S${suffix}-2`
  });
  assert.equal(studentUpdated.name, `学生 ${suffix} 更新`);
  assert.equal(studentUpdated.studentNo, `S${suffix}-2`);

  const transferred = await studentService.transferStudent(createdStudent.id, { classId: targetClass.id });
  assert.equal(transferred.classId, targetClass.id);
  assert.equal(transferred.className, targetClass.name);

  const archivedStudent = await studentService.archiveStudent(createdStudent.id);
  assert.equal(archivedStudent.status, 'archived');
  assert.ok(archivedStudent.deletedAt);

  const hiddenStudents = await studentService.listStudents({ keyword: String(suffix), status: 'active', page: 1, pageSize: 20 });
  assert.equal(hiddenStudents.total, 0);

  const archivedStudents = await studentService.listStudents({ keyword: String(suffix), status: 'archived', page: 1, pageSize: 20 });
  assert.equal(archivedStudents.total, 1);

  const restoredStudent = await studentService.restoreStudent(createdStudent.id);
  assert.equal(restoredStudent.status, 'active');
  assert.equal(restoredStudent.deletedAt, null);

  const archivedClass = await classService.archiveClass(createdClass.id);
  assert.equal(archivedClass.status, 'archived');
  assert.ok(archivedClass.deletedAt);

  const hiddenClasses = await classService.listClasses({ keyword: String(suffix), status: 'active', page: 1, pageSize: 20 });
  assert.equal(hiddenClasses.total, 1, 'active list should only show the target transfer class');

  const restoredClass = await classService.restoreClass(createdClass.id);
  assert.equal(restoredClass.status, 'active');
  assert.equal(restoredClass.deletedAt, null);

  await prisma.student.delete({ where: { id: createdStudent.id } });
  await prisma.class.delete({ where: { id: createdClass.id } });
  await prisma.class.delete({ where: { id: targetClass.id } });

  console.log('class and student CRUD database contracts passed');
} finally {
  await prisma.$disconnect();
}
