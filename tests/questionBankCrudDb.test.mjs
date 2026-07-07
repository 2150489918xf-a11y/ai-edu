import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

import { loadEnvFile } from '../server/env.js';
import { createQuestionBankService } from '../server/services/questionBankService.js';

loadEnvFile();

const prisma = new PrismaClient();
const service = createQuestionBankService(prisma);
const suffix = Date.now();

try {
  const bank = await service.createBank({
    title: `Newton bank ${suffix}`,
    subject: 'Physics',
    grade: 'Grade 10',
    usage: 'pre-class / in-class / after-class',
    description: 'Questions about Newton laws.',
    tags: ['Newton Second Law', 'force analysis']
  });

  assert.equal(bank.status, 'active');
  assert.equal(bank.count, 0);
  assert.deepEqual(bank.tags, ['Newton Second Law', 'force analysis']);

  const question = await service.createQuestion(bank.id, {
    type: 'single-choice',
    stage: 'in-class',
    difficulty: 'basic',
    title: 'What is acceleration when F=6N and m=2kg?',
    options: ['1 m/s^2', '2 m/s^2', '3 m/s^2', '12 m/s^2'],
    answer: '3 m/s^2',
    analysis: 'a = F / m = 3 m/s^2',
    accuracy: 76,
    knowledge: ['F=ma']
  });

  assert.equal(question.bankId, bank.id);
  assert.equal(question.status, 'active');
  assert.deepEqual(question.options, ['1 m/s^2', '2 m/s^2', '3 m/s^2', '12 m/s^2']);

  const detail = await service.getBank(bank.id);
  assert.equal(detail.count, 1);
  assert.equal(detail.questions[0].id, question.id);

  const updated = await service.updateQuestion(question.id, {
    title: 'Updated F=ma question',
    accuracy: 80
  });
  assert.equal(updated.title, 'Updated F=ma question');
  assert.equal(updated.accuracy, 80);

  const archived = await service.archiveQuestion(question.id);
  assert.equal(archived.status, 'archived');

  const afterArchive = await service.getBank(bank.id);
  assert.equal(afterArchive.count, 0);

  await service.archiveBank(bank.id);

  const activeList = await service.listBanks({ keyword: `Newton bank ${suffix}`, status: 'active' });
  assert.equal(activeList.total, 0);

  await prisma.question.deleteMany({ where: { bankId: bank.id } });
  await prisma.questionBank.delete({ where: { id: bank.id } });

  console.log('question bank CRUD database contracts passed');
} finally {
  await prisma.$disconnect();
}
