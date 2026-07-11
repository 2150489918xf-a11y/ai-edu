import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createQuestionBankService } from '../server/services/questionBankService.js';
import { createQuestionKnowledgeGraphService } from '../server/services/questionKnowledgeGraphService.js';

loadEnvFile();

const prisma = new PrismaClient();
const suffix = Date.now();
let createdBankId = '';
let q1;
let q2;

const graphService = createQuestionKnowledgeGraphService(prisma);
const questionBankService = createQuestionBankService(prisma, {
  questionKnowledgeGraphService: graphService
});

try {
  const bank = await questionBankService.createBank({
    title: `Incremental graph ${suffix}`,
    subject: 'Physics',
    grade: 'Grade 10'
  });
  createdBankId = bank.id;

  q1 = await questionBankService.createQuestion(bank.id, {
    type: 'single_choice',
    difficulty: 'basic',
    title: '由合外力求加速度',
    options: ['A', 'B'],
    answer: 'A',
    knowledge: ['合外力', '加速度']
  });
  q2 = await questionBankService.createQuestion(bank.id, {
    type: 'blank',
    difficulty: 'basic',
    title: '牛顿第二定律表达式',
    answer: 'F=ma',
    knowledge: ['牛顿第二定律', '合外力']
  });

  const graph = await graphService.getGraph(bank.id);
  assert.equal(graph.nodes.filter((node) => node.label === '合外力').length, 1);
  assert.equal(graph.stats.questionCount, 2);
  assert.equal(graph.stats.analyzedCount, 2);
  assert.equal(graph.nodes.find((node) => node.label === '合外力')?.questionCount, 2);
  assert.equal(graph.edges.filter((edge) => edge.type === 'co_occurrence').length, 2);

  await questionBankService.archiveQuestion(q1.id);
  const afterDelete = await graphService.getGraph(bank.id);
  assert.equal(afterDelete.stats.questionCount, 1);
  assert.ok(!afterDelete.nodes.some((node) => node.label === '加速度'));
  assert.equal(
    await prisma.knowledgeRelationEvidence.count({ where: { questionId: q1.id } }),
    0
  );

  await questionBankService.updateQuestion(q2.id, {
    title: '牛顿第二定律与质量',
    knowledge: ['牛顿第二定律', '质量']
  });
  const afterUpdate = await graphService.getGraph(bank.id);
  assert.ok(afterUpdate.nodes.some((node) => node.label === '质量'));
  assert.ok(!afterUpdate.nodes.some((node) => node.label === '合外力'));
  assert.equal(afterUpdate.stats.questionCount, 1);

  console.log('question knowledge graph database tests passed');
} finally {
  if (createdBankId) {
    await prisma.question.deleteMany({ where: { bankId: createdBankId } });
    await prisma.questionBank.deleteMany({ where: { id: createdBankId } });
  }
  await prisma.$disconnect();
}
