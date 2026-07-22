import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedDemoQuestionBanks } from '../prisma/seedDemoQuestionBanks.js';

function createRecordingPrisma(courseIds) {
  const calls = {
    questionBank: [],
    knowledgePoint: [],
    question: [],
    questionKnowledgePoint: [],
    knowledgeRelation: []
  };
  const model = (name) => ({
    async upsert(args) {
      calls[name].push(args);
      return args.create;
    }
  });
  const prisma = {
    calls,
    course: {
      async findMany() {
        return courseIds.map((id) => ({ id }));
      }
    },
    questionBank: model('questionBank'),
    knowledgePoint: model('knowledgePoint'),
    question: model('question'),
    questionKnowledgePoint: model('questionKnowledgePoint'),
    knowledgeRelation: model('knowledgeRelation'),
    async $transaction(callback) {
      return callback(prisma);
    }
  };
  return prisma;
}

const courseIds = [
  'course-newton-2',
  'dev-course-motion',
  'dev-course-force-composition',
  'dev-course-function-basic',
  'dev-course-quadratic',
  'dev-course-triangle',
  'dev-course-amount',
  'dev-course-redox',
  'dev-course-relative-clause',
  'dev-course-reading',
  'dev-course-modern-prose',
  'dev-course-classical'
];
const prisma = createRecordingPrisma(courseIds);
const summary = await seedDemoQuestionBanks(prisma);

assert.deepEqual(summary, {
  banks: 15,
  questions: 180,
  knowledgePoints: 90,
  questionKnowledgeLinks: 255,
  relations: 75,
  linkedCourses: 12
});
assert.equal(prisma.calls.questionBank.length, 15);
assert.equal(prisma.calls.knowledgePoint.length, 90);
assert.equal(prisma.calls.question.length, 180);
assert.equal(prisma.calls.questionKnowledgePoint.length, 255);
assert.equal(prisma.calls.knowledgeRelation.length, 75);

for (const call of prisma.calls.questionBank) {
  assert.match(call.where.id, /^demo-bank-/);
  assert.equal(call.update.deletedAt, null);
  assert.equal(call.update.status, 'active');
}
for (const call of prisma.calls.question) {
  assert.match(call.where.id, /^demo-q-/);
  assert.ok(courseIds.includes(call.create.courseId));
  assert.equal(call.update.deletedAt, null);
  assert.equal(call.update.status, 'active');
}
for (const call of prisma.calls.knowledgeRelation) {
  assert.match(call.where.id, /^demo-rel-/);
  assert.equal(call.create.manualLocked, true);
}

const source = readFileSync(new URL('../prisma/seedDemoQuestionBanks.js', import.meta.url), 'utf8');
assert.ok(!source.includes('deleteMany'), '演示数据脚本禁止调用 deleteMany');
assert.ok(!source.includes('.delete('), '演示数据脚本禁止调用 delete');

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.scripts['db:demo-question-banks'], 'node prisma/seedDemoQuestionBanks.js');
assert.equal(
  pkg.scripts['test:demo-question-banks'],
  'node tests/demoQuestionBankCatalog.test.mjs && node tests/demoQuestionBankSeed.test.mjs'
);

console.log('demo question bank seed test passed: deterministic upserts without deletes');
