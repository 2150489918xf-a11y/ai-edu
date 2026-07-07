import assert from 'node:assert/strict';
import { generatedPaper } from '../src/data/teachingMockData.js';
import { buildExamPaperLayout } from '../src/utils/examPaper.js';

const layout = buildExamPaperLayout(generatedPaper);

assert.equal(layout.title, '牛顿第二定律随堂测', 'layout should preserve the paper title');
assert.equal(layout.examInfo.fullScore, 100, 'layout should expose a full score');
assert.equal(layout.examInfo.durationMinutes, 20, 'layout should expose duration minutes');
assert.equal(layout.examInfo.subject, '高一物理', 'layout should expose subject');

assert.deepEqual(
  layout.scoreTable.map((item) => item.label),
  ['单选题', '判断题', '填空题', '多选题', '计算题', '情境题', '总分'],
  'score table should include question types and total'
);
assert.equal(layout.scoreTable.at(-1).score, 100, 'score table total should be 100');

assert.deepEqual(
  layout.sections.map((section) => section.heading),
  [
    '一、单项选择题',
    '二、判断题',
    '三、填空题',
    '四、多项选择题',
    '五、计算题',
    '六、情境分析题'
  ],
  'sections should follow formal exam ordering'
);

const singleChoice = layout.sections.find((section) => section.type === '单选题');
assert.equal(singleChoice.questions.length, 4, 'single-choice section should include four questions');
assert.equal(singleChoice.pointsPerQuestion, 5, 'single-choice questions should be 5 points each');
assert.equal(singleChoice.totalPoints, 20, 'single-choice total should be 20 points');
assert.deepEqual(
  singleChoice.questions[0].options,
  ['A. 3 m/s²', 'B. 4 m/s²', 'C. 6 m/s²', 'D. 12 m/s²'],
  'single-choice questions should expose real options'
);

const writtenSections = layout.sections.filter((section) => section.answerLines > 0);
assert.ok(
  writtenSections.every((section) => ['填空题', '计算题', '情境题'].includes(section.type)),
  'only written-response sections should expose answer lines'
);

assert.ok(Array.isArray(layout.pages), 'layout should expose printable pages');
assert.ok(layout.pages.length >= 2, 'formal exam layout should split long papers into pages');
assert.deepEqual(
  layout.pages.map((page) => page.pageNumber),
  [1, 2],
  'pages should expose stable page numbers'
);
assert.ok(
  layout.pages.every((page) => page.sections.length >= 1),
  'each page should contain at least one section'
);

console.log('exam paper layout contract passed');
