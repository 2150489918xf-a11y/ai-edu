import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createCourseService } from '../server/services/courseService.js';

loadEnvFile();

const prisma = new PrismaClient();
const service = createCourseService(prisma);
const title = `课程 CRUD 测试 ${Date.now()}`;

try {
  const created = await service.createCourse({
    title,
    subject: '物理',
    grade: '高一',
    description: '用于验证课程 CRUD'
  });
  assert.equal(created.title, title);
  assert.equal(created.status, 'active');
  assert.equal(created.deletedAt, null);

  const activeList = await service.listCourses({ keyword: title, status: 'active', page: 1, pageSize: 20 });
  assert.equal(activeList.total, 1);
  assert.equal(activeList.courses[0].id, created.id);

  const detail = await service.getCourse(created.id);
  assert.equal(detail.title, title);

  const updated = await service.updateCourse(created.id, {
    title: `${title} 更新`,
    description: '已更新'
  });
  assert.equal(updated.title, `${title} 更新`);
  assert.equal(updated.description, '已更新');

  const archived = await service.archiveCourse(created.id);
  assert.equal(archived.status, 'archived');
  assert.ok(archived.deletedAt, 'archived course should set deletedAt');

  const hiddenList = await service.listCourses({ keyword: title, status: 'active', page: 1, pageSize: 20 });
  assert.equal(hiddenList.total, 0, 'active list should hide archived courses');

  const archivedList = await service.listCourses({ keyword: title, status: 'archived', page: 1, pageSize: 20 });
  assert.equal(archivedList.total, 1, 'archived list should expose archived courses');

  const restored = await service.restoreCourse(created.id);
  assert.equal(restored.status, 'active');
  assert.equal(restored.deletedAt, null);

  await prisma.course.delete({ where: { id: created.id } });

  console.log('course CRUD database contracts passed');
} finally {
  await prisma.$disconnect();
}
