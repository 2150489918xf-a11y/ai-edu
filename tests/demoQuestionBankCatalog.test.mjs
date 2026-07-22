import assert from 'node:assert/strict';
import { demoQuestionBankCatalog } from '../prisma/demoQuestionBankCatalog.js';

const EXPECTED_SUBJECTS = ['物理', '数学', '化学', '英语', '语文'];
const SUPPORTED_TYPES = new Set(['single_choice', 'fill_blank']);
const ids = new Set();

assert.equal(demoQuestionBankCatalog.length, 15, '应提供 15 个新增演示题库');
assert.deepEqual(
  [...new Set(demoQuestionBankCatalog.map((bank) => bank.subject))].sort(),
  [...EXPECTED_SUBJECTS].sort(),
  '题库应覆盖五个学科'
);

for (const bank of demoQuestionBankCatalog) {
  assert.match(bank.id, /^demo-bank-[a-z0-9-]+$/);
  assert.ok(bank.title.trim());
  assert.ok(bank.description.trim());
  assert.equal(bank.grade, '高一');
  assert.ok(bank.courseId?.trim(), `${bank.id} 应映射现有课程`);
  assert.equal(bank.knowledgePoints.length, 6, `${bank.id} 应包含 6 个知识点`);
  assert.equal(bank.relations.length, 5, `${bank.id} 应包含 5 条知识关系`);
  assert.equal(bank.questions.length, 12, `${bank.id} 应包含 12 道题`);

  const pointKeys = new Set(bank.knowledgePoints.map((point) => point.key));
  assert.equal(pointKeys.size, 6, `${bank.id} 知识点 key 不可重复`);

  for (const point of bank.knowledgePoints) {
    assert.match(point.key, /^[a-z0-9-]+$/);
    assert.ok(point.name.trim());
    assert.ok(['基础概念', '核心规律', '方法策略', '综合应用'].includes(point.category));
  }

  for (const relation of bank.relations) {
    assert.ok(pointKeys.has(relation.source), `${bank.id} 关系起点无效`);
    assert.ok(pointKeys.has(relation.target), `${bank.id} 关系终点无效`);
    assert.notEqual(relation.source, relation.target);
    assert.ok(relation.label.trim());
  }

  const types = new Set();
  for (const [index, question] of bank.questions.entries()) {
    const expectedId = `demo-q-${bank.id.slice('demo-bank-'.length)}-${index + 1}`;
    assert.equal(question.id, expectedId);
    assert.ok(!ids.has(question.id), `题目 ID 重复：${question.id}`);
    ids.add(question.id);
    assert.ok(SUPPORTED_TYPES.has(question.type), `${question.id} 题型不受支持`);
    types.add(question.type);
    assert.ok(['基础', '中等', '提高'].includes(question.difficulty));
    assert.ok(question.title.trim());
    assert.ok(question.analysis.trim());
    assert.ok(String(question.answer?.value || '').trim());
    assert.ok(Array.isArray(question.knowledgeKeys) && question.knowledgeKeys.length >= 1);
    assert.ok(question.knowledgeKeys.every((key) => pointKeys.has(key)), `${question.id} 引用了无效知识点`);
    if (question.type === 'single_choice') {
      assert.equal(question.options.length, 4, `${question.id} 应有四个选项`);
    } else {
      assert.deepEqual(question.options, []);
    }
  }
  assert.ok(types.has('single_choice'), `${bank.id} 缺少选择题`);
  assert.ok(types.has('fill_blank'), `${bank.id} 缺少填空题`);
}

assert.equal(ids.size, 180);
console.log('demo question bank catalog test passed: 15 banks, 180 questions, 90 knowledge points');
