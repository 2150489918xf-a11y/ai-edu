import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createLearningService } from '../server/learningService.js';

loadEnvFile();

const prisma = new PrismaClient();
const service = createLearningService(prisma);

try {
  const classes = await service.getClasses({ subject: '物理' });
  assert.ok(classes.some((item) => item.id === 'class-2026-physics-1'), 'seed should include physics class');

  const list = await service.getStudents({ className: '高一 3 班', page: 1, pageSize: 20 });
  assert.ok(list.classes.includes('高一 3 班'), 'student list should include class filters');
  assert.ok(list.students.some((item) => item.id === 'stu-liming'), 'student list should include Li Ming');

  const summary = await service.getClassLearningSummary('class-2026-physics-1');
  assert.equal(summary.lessonName, '牛顿第二定律');
  assert.ok(summary.questionStats.length >= 1, 'class summary should include question stats');

  const profile = await service.getStudentProfile('stu-liming');
  assert.equal(profile.name, '李明');
  assert.ok(profile.mastery.some((item) => item.knowledgeId === 'kp-resultant-force'));

  const parentSummary = await service.getParentSummary('stu-liming');
  assert.equal(parentSummary.studentName, '李明');
  assert.equal(parentSummary.rank, undefined);

  const records = await service.getQuestionAnswerRecords({ studentId: 'stu-liming', page: 1, pageSize: 20 });
  assert.ok(records.records.length >= 1, 'answer records should be seeded for Li Ming');

  console.log('backend learning database contracts passed');
} finally {
  await prisma.$disconnect();
}
