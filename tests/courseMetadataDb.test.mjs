import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createCourseService } from '../server/services/courseService.js';

loadEnvFile();

const prisma = new PrismaClient();
const service = createCourseService(prisma);
const suffix = Date.now();

try {
  const created = await service.createCourse({
    title: `Course metadata ${suffix}`,
    subject: 'Physics',
    grade: 'Grade 10',
    duration: '45 minutes',
    goal: 'Understand the quantitative relation between force, mass, and acceleration.',
    description: 'A new course around F=ma.',
    knowledge: ['F=ma', 'net force calculation', 'acceleration direction']
  });

  assert.equal(created.duration, '45 minutes');
  assert.equal(created.goal, 'Understand the quantitative relation between force, mass, and acceleration.');
  assert.deepEqual(created.knowledge, ['F=ma', 'net force calculation', 'acceleration direction']);

  const detail = await service.getCourse(created.id);
  assert.equal(detail.duration, '45 minutes');
  assert.equal(detail.goal, 'Understand the quantitative relation between force, mass, and acceleration.');
  assert.deepEqual(detail.knowledge, ['F=ma', 'net force calculation', 'acceleration direction']);

  const updated = await service.updateCourse(created.id, {
    duration: '40 minutes',
    goal: 'Interpret F=ma with experiment data.',
    knowledge: ['experiment exploration', 'F=ma']
  });

  assert.equal(updated.duration, '40 minutes');
  assert.equal(updated.goal, 'Interpret F=ma with experiment data.');
  assert.deepEqual(updated.knowledge, ['experiment exploration', 'F=ma']);

  await prisma.course.delete({ where: { id: created.id } });

  console.log('course metadata database contracts passed');
} finally {
  await prisma.$disconnect();
}
