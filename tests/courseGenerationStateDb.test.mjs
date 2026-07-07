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
    title: `Generated course state ${suffix}`,
    subject: 'Physics',
    grade: 'Grade 10',
    duration: '45 minutes',
    goal: 'Generate courseware from saved metadata.',
    knowledge: ['F=ma']
  });

  assert.equal(created.hasOutline, false);
  assert.equal(created.progress, 18);
  assert.equal(created.materialUploaded, false);
  assert.equal(created.materialName, null);
  assert.equal(created.outline, null);

  const updated = await service.updateCourse(created.id, {
    hasOutline: true,
    progress: 58,
    materialUploaded: true,
    materialName: 'newton-source.pdf',
    outline: {
      version: 'v1',
      tags: ['F=ma'],
      sections: [{ title: 'Experiment exploration', time: '8-25 min' }]
    }
  });

  assert.equal(updated.hasOutline, true);
  assert.equal(updated.progress, 58);
  assert.equal(updated.materialUploaded, true);
  assert.equal(updated.materialName, 'newton-source.pdf');
  assert.equal(updated.outline.version, 'v1');
  assert.equal(updated.outline.sections[0].title, 'Experiment exploration');

  const detail = await service.getCourse(created.id);
  assert.equal(detail.hasOutline, true);
  assert.equal(detail.progress, 58);
  assert.equal(detail.materialUploaded, true);
  assert.equal(detail.materialName, 'newton-source.pdf');
  assert.equal(detail.outline.version, 'v1');

  await prisma.course.delete({ where: { id: created.id } });

  console.log('course generation state database contracts passed');
} finally {
  await prisma.$disconnect();
}
