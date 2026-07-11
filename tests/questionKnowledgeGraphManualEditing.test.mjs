import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createQuestionBankService } from '../server/services/questionBankService.js';
import { createQuestionKnowledgeGraphService } from '../server/services/questionKnowledgeGraphService.js';

loadEnvFile();

const prisma = new PrismaClient();
const graphService = createQuestionKnowledgeGraphService(prisma);
const bankService = createQuestionBankService(prisma, { questionKnowledgeGraphService: graphService });
let bankId = '';

try {
  const bank = await bankService.createBank({
    title: `Manual graph ${Date.now()}`,
    subject: 'Physics',
    grade: 'Grade 10'
  });
  bankId = bank.id;
  const question = await bankService.createQuestion(bank.id, {
    type: 'single_choice',
    difficulty: 'basic',
    title: '牛顿第二定律基础题',
    options: ['A', 'B'],
    answer: 'A',
    knowledge: ['牛顿第二定律', '合外力']
  });
  const initial = await graphService.getGraph(bank.id);
  const target = initial.nodes.find((node) => node.label === '牛顿第二定律');
  assert.ok(target);

  const manual = await graphService.createKnowledgePoint(bank.id, {
    name: '动力学建模',
    category: '方法',
    questionIds: [question.id],
    graphRevision: initial.revision
  });
  assert.equal(manual.source, 'manual');
  assert.equal(manual.manualLocked, true);

  await assert.rejects(
    () => graphService.updateKnowledgePoint(bank.id, manual.id, {
      name: '过期修改',
      graphRevision: initial.revision
    }),
    (error) => error.statusCode === 409 && error.code === 'GRAPH_REVISION_CONFLICT'
  );

  const edited = await graphService.updateKnowledgePoint(bank.id, manual.id, {
    name: '动力学模型',
    aliases: ['建模'],
    graphRevision: manual.graphRevision
  });
  assert.equal(edited.name, '动力学模型');
  assert.deepEqual(edited.aliases, ['建模']);

  const relation = await graphService.createRelation(bank.id, {
    sourcePointId: edited.id,
    targetPointId: target.id,
    type: 'prerequisite',
    label: '前置',
    graphRevision: edited.graphRevision
  });
  assert.equal(relation.source, 'manual');
  assert.equal(relation.manualLocked, true);

  const duplicate = await graphService.createKnowledgePoint(bank.id, {
    name: '牛二定律',
    aliases: ['Newton II'],
    questionIds: [question.id],
    graphRevision: relation.graphRevision
  });
  const merged = await graphService.mergeKnowledgePoint(bank.id, duplicate.id, {
    targetPointId: target.id,
    graphRevision: duplicate.graphRevision
  });
  assert.equal(merged.mergedIntoId, target.id);
  const archivedSource = await prisma.knowledgePoint.findUnique({ where: { id: duplicate.id } });
  assert.equal(archivedSource.status, 'archived');
  assert.equal(archivedSource.mergedIntoId, target.id);

  const layout = await graphService.saveLayout(bank.id, {
    graphRevision: merged.graphRevision,
    nodes: [{ knowledgePointId: target.id, x: 120, y: 80, pinned: true }]
  });
  const withLayout = await graphService.getGraph(bank.id);
  assert.deepEqual(withLayout.nodes.find((node) => node.id === target.id)?.position, {
    x: 120,
    y: 80,
    pinned: true
  });
  assert.equal(withLayout.revision, layout.graphRevision);

  console.log('question knowledge graph manual editing tests passed');
} finally {
  if (bankId) {
    await prisma.question.deleteMany({ where: { bankId } });
    await prisma.questionBank.deleteMany({ where: { id: bankId } });
  }
  await prisma.$disconnect();
}
