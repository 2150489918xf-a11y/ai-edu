import assert from 'node:assert/strict';
import {
  generateExamPaper,
  generateMindMap,
  getClassLearningAnalysis,
  getKnowledgeBaseMaterials,
  getParentLearningSummary,
  getStudentProfileList,
  saveExamPaper,
  getStudentProfile
} from '../src/data/mockApi.js';

const result = await getKnowledgeBaseMaterials();

assert.ok(Array.isArray(result.categories), 'categories should be an array');
assert.ok(result.categories.length >= 4, 'knowledge base should expose category filters');
assert.ok(Array.isArray(result.materials), 'materials should be an array');
assert.ok(result.materials.length >= 3, 'knowledge base should expose mock materials');
assert.ok(
  result.materials.some((item) => item.status === 'parsed'),
  'at least one material should be parsed'
);
assert.ok(
  result.materials.some((item) => item.status === 'parsing'),
  'at least one material should be parsing'
);

const mindMapResult = await generateMindMap('math-quadratic');

assert.equal(mindMapResult.courseId, 'math-quadratic', 'mind map result should preserve the course id');
assert.ok(Array.isArray(mindMapResult.steps), 'mind map generation should expose progress steps');
assert.ok(mindMapResult.steps.length >= 4, 'mind map generation should have enough staged steps');
assert.ok(mindMapResult.mindMap, 'mind map generation should return a mind map');
assert.ok(Array.isArray(mindMapResult.mindMap.nodes), 'mind map should expose nodes');
assert.ok(Array.isArray(mindMapResult.mindMap.links), 'mind map should expose links');
assert.equal(typeof mindMapResult.mindMap.markdown, 'string', 'mind map should expose renderable markdown');
assert.ok(
  mindMapResult.mindMap.markdown.includes('# 二次函数图像与性质'),
  'mind map markdown should include the root topic'
);
assert.ok(
  mindMapResult.mindMap.markdown.includes('## 一般式 y=ax²+bx+c'),
  'mind map markdown should include first-level branches'
);
assert.ok(
  mindMapResult.mindMap.nodes.some((node) => node.type === 'weak-point'),
  'mind map should include learning weak point nodes'
);

const analysisResult = await getClassLearningAnalysis('class-2026-physics-1');

assert.equal(analysisResult.classId, 'class-2026-physics-1', 'class analysis should preserve the class id');
assert.equal(analysisResult.className, '高一 3 班', 'class analysis should expose the target class');
assert.equal(analysisResult.lessonName, '牛顿第二定律', 'class analysis should expose the lesson');
assert.ok(analysisResult.avgAccuracy > 0, 'class analysis should expose average accuracy');
assert.ok(Array.isArray(analysisResult.questionStats), 'class analysis should expose question stats');
assert.ok(analysisResult.questionStats.length >= 1, 'class analysis should include at least one question stat');
assert.ok(
  analysisResult.questionStats[0].optionDistribution.some((item) => item.note === '正确'),
  'question stats should include option distribution notes'
);
assert.ok(Array.isArray(analysisResult.weakPoints), 'class analysis should expose weak points');
assert.ok(
  analysisResult.weakPoints.some((item) => item.id === 'kp-resultant-force'),
  'class analysis should include the resultant force weak point'
);
assert.equal(typeof analysisResult.aiAdvice, 'string', 'class analysis should expose AI advice');

const profileResult = await getStudentProfile('stu-liming');

assert.equal(profileResult.id, 'stu-liming', 'student profile should preserve the selected student id');
assert.equal(profileResult.name, '李明', 'student profile should expose Li Ming');
assert.ok(Array.isArray(profileResult.mastery), 'student profile should expose mastery');
assert.ok(
  profileResult.mastery.some((item) => item.knowledgeId === 'kp-resultant-force' && item.value === 54),
  'student profile should expose updated resultant force mastery'
);
assert.ok(Array.isArray(profileResult.weakPoints), 'student profile should expose weak points');
assert.ok(Array.isArray(profileResult.mistakeReasons), 'student profile should expose mistake reasons');
assert.ok(Array.isArray(profileResult.recommendedPractice), 'student profile should expose recommended practice');
assert.ok(
  profileResult.recommendedPractice.length >= 3,
  'student profile should include at least three recommended exercises'
);
assert.equal(typeof profileResult.aiConversationSummary, 'string', 'student profile should expose AI summary');

const profileListResult = await getStudentProfileList({ className: '高一 3 班' });

assert.ok(Array.isArray(profileListResult.classes), 'student profile list should expose class filters');
assert.ok(
  profileListResult.classes.some((item) => item === '高一 3 班'),
  'student profile list should include the target class filter'
);
assert.ok(Array.isArray(profileListResult.students), 'student profile list should expose students');
assert.ok(profileListResult.students.length >= 2, 'student profile list should include multiple students');
assert.ok(
  profileListResult.students.every((student) => student.className === '高一 3 班'),
  'student profile list should filter by class'
);
assert.ok(
  profileListResult.students.some((student) => student.id === 'stu-liming' && student.lowestMastery?.name === '合外力计算'),
  'student profile list should expose Li Ming summary and lowest mastery'
);
assert.ok(
  profileListResult.students.every((student) => typeof student.avgMastery === 'number'),
  'student profile list should expose average mastery for cards'
);

const parentSummaryResult = await getParentLearningSummary('stu-liming');

assert.equal(typeof parentSummaryResult.weeklyStatus, 'string', 'parent summary should expose weekly status');
assert.ok(Array.isArray(parentSummaryResult.mastered), 'parent summary should expose mastered items');
assert.ok(Array.isArray(parentSummaryResult.needsAttention), 'parent summary should expose attention items');
assert.equal(parentSummaryResult.rank, undefined, 'parent summary should not expose class ranking');
assert.equal(parentSummaryResult.classmates, undefined, 'parent summary should not expose classmates');

const paperResult = await generateExamPaper('newton-laws-bank', {
  type: '随堂测',
  totalQuestions: 10,
  difficultyRatio: { basic: 4, medium: 4, advanced: 2 },
  knowledgePoints: ['牛顿第二定律', '合外力', '加速度方向', '受力分析'],
  priority: '优先覆盖班级薄弱点'
});

assert.equal(paperResult.bankId, 'newton-laws-bank', 'paper generation should preserve the bank id');
assert.equal(paperResult.config.type, '随堂测', 'paper generation should preserve requested type');
assert.ok(paperResult.paper, 'paper generation should return a paper');
assert.equal(paperResult.paper.id, 'paper-newton-001', 'paper should use the Newton mock paper');
assert.equal(paperResult.paper.title, '牛顿第二定律随堂测', 'paper should expose the Newton paper title');
assert.equal(paperResult.paper.totalQuestions, 10, 'paper should expose 10 questions');
assert.equal(paperResult.paper.questions.length, 10, 'paper should include 10 preview questions');
assert.ok(
  paperResult.paper.questions.some((question) => question.knowledgePoint === '合外力'),
  'paper should include resultant-force questions'
);
assert.ok(
  paperResult.paper.knowledgeCoverage.some((item) => item.name === '牛顿第二定律' && item.coverage >= 90),
  'paper should include Newton law coverage'
);
assert.ok(
  paperResult.paper.qualityChecks.every((item) => item.passed === true),
  'paper quality checks should all pass in the mock result'
);

const savePaperResult = await saveExamPaper(paperResult.paper.id);

assert.equal(savePaperResult.paperId, 'paper-newton-001', 'paper save should preserve paper id');
assert.equal(savePaperResult.status, 'saved', 'paper save should return saved status');
assert.ok(savePaperResult.message.includes('试卷已保存'), 'paper save should return user-facing success message');

console.log('mockApi knowledge base, mind map, learning analysis, and paper contracts passed');
