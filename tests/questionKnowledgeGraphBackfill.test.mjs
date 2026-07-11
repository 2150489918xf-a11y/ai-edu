import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { backfillQuestionBankKnowledgeGraph } from '../prisma/backfillQuestionBankKnowledgeGraph.js';

const seedSource = readFileSync(new URL('../prisma/seed.js', import.meta.url), 'utf8');
const devDataSource = readFileSync(new URL('../prisma/devData.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

for (const [name, source] of [['seed', seedSource], ['devData', devDataSource]]) {
  assert.ok(
    source.includes('backfillQuestionBankKnowledgeGraph'),
    `${name} must run the shared question-bank graph backfill`
  );
}
assert.equal(
  packageJson.scripts['db:backfill-question-graph'],
  'node prisma/backfillQuestionBankKnowledgeGraph.js'
);
assert.ok(packageJson.scripts['test:knowledge-graph']?.includes('questionKnowledgeGraphBackfill.test.mjs'));

loadEnvFile();

const prisma = new PrismaClient();
const suffix = Date.now();
const ids = {
  bank: `backfill-bank-${suffix}`,
  course: `backfill-course-${suffix}`,
  coursePoint: `backfill-course-point-${suffix}`,
  q1: `backfill-q1-${suffix}`,
  q2: `backfill-q2-${suffix}`,
  q3: `backfill-q3-${suffix}`
};

try {
  await prisma.questionBank.create({
    data: { id: ids.bank, title: 'Backfill bank', subject: 'Physics', grade: 'Grade 10' }
  });
  await prisma.course.create({
    data: { id: ids.course, title: 'Backfill course', subject: 'Physics', grade: 'Grade 10' }
  });
  await prisma.knowledgePoint.create({
    data: { id: ids.coursePoint, courseId: ids.course, name: '合外力' }
  });
  await prisma.question.createMany({
    data: [
      {
        id: ids.q1,
        bankId: ids.bank,
        type: 'single_choice',
        difficulty: 'basic',
        title: '已有 JSON 标签',
        answer: 'A',
        knowledge: ['牛顿第二定律', '合外力']
      },
      {
        id: ids.q2,
        bankId: ids.bank,
        courseId: ids.course,
        type: 'blank',
        difficulty: 'basic',
        title: '只有课程知识点关联',
        answer: '6N',
        knowledge: []
      },
      {
        id: ids.q3,
        bankId: ids.bank,
        type: 'blank',
        difficulty: 'basic',
        title: '没有知识点来源',
        answer: '待解析',
        knowledge: []
      }
    ]
  });
  await prisma.questionKnowledgePoint.create({
    data: { questionId: ids.q2, knowledgePointId: ids.coursePoint }
  });

  const dryRun = await backfillQuestionBankKnowledgeGraph(prisma, { dryRun: true, bankId: ids.bank });
  assert.equal(dryRun.createdBankPoints, 2);
  assert.equal(await prisma.knowledgePoint.count({ where: { bankId: ids.bank } }), 0);

  const result = await backfillQuestionBankKnowledgeGraph(prisma, { bankId: ids.bank });
  assert.equal(result.createdBankPoints, 2);
  assert.equal(result.linkedQuestions, 2);
  assert.equal(result.queuedQuestions, 1);
  assert.equal(await prisma.knowledgePoint.count({ where: { bankId: ids.bank } }), 2);
  assert.equal(
    await prisma.questionKnowledgeExtraction.count({
      where: { questionId: ids.q3, status: 'pending' }
    }),
    1
  );

  console.log('question knowledge graph backfill tests passed');
} finally {
  await prisma.question.deleteMany({ where: { id: { in: [ids.q1, ids.q2, ids.q3] } } });
  await prisma.questionBank.deleteMany({ where: { id: ids.bank } });
  await prisma.course.deleteMany({ where: { id: ids.course } });
  await prisma.$disconnect();
}
