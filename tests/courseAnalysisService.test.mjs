import assert from 'node:assert/strict';
import { createCourseAnalysisService } from '../server/services/courseAnalysisService.js';

const now = new Date('2026-07-22T08:00:00Z');
const questions = [
  { id: 'q-weak', courseId: 'course-1', title: '薄弱题', type: 'choice', difficulty: '中等', options: ['A', 'B'], answer: { value: 'A' }, analysis: '先分析条件', knowledge: ['受力'], weakPoint: '受力分析', status: 'active', deletedAt: null, createdAt: now, updatedAt: now },
  { id: 'q-good', courseId: 'course-1', title: '掌握题', type: 'blank', difficulty: '基础', options: [], answer: { value: '2' }, analysis: '', knowledge: ['计算'], weakPoint: null, status: 'active', deletedAt: null, createdAt: now, updatedAt: now }
];

function answer(id, sessionId, studentId, question, value, isCorrect, durationSeconds, minute) {
  return { id, sessionId, studentId, questionId: question.id, question, student: { id: studentId, name: `学生${studentId}` }, answer: { value }, isCorrect, score: isCorrect ? 1 : 0, durationSeconds, submittedAt: new Date(`2026-07-22T08:${minute}:00Z`) };
}

const sessions = [
  {
    id: 's-1', courseId: 'course-1', classId: 'c-1', title: '一班课堂', status: 'completed', startedAt: now,
    class: { id: 'c-1', name: '高一（1）班' },
    sessionQuestions: questions.map((question, index) => ({ sortOrder: index, question })),
    answers: [
      answer('a1', 's-1', '1', questions[0], 'B', false, 40, '01'),
      answer('a2', 's-1', '2', questions[0], 'A', true, 20, '02'),
      answer('a3', 's-1', '1', questions[1], '2', true, 10, '03')
    ]
  },
  {
    id: 's-2', courseId: 'course-1', classId: 'c-2', title: '二班课堂', status: 'completed', startedAt: now,
    class: { id: 'c-2', name: '高一（2）班' },
    sessionQuestions: questions.map((question, index) => ({ sortOrder: index, question })),
    answers: [
      answer('a4', 's-2', '3', questions[0], 'B', false, 30, '04'),
      answer('a5', 's-2', '3', questions[1], '2', true, 20, '05')
    ]
  },
  {
    id: 'personal', courseId: 'course-1', classId: 'c-1', title: '个人练习', status: 'ai_personal_practice', startedAt: now,
    class: { id: 'c-1', name: '高一（1）班' }, sessionQuestions: [],
    answers: [answer('a6', 'personal', '1', questions[0], 'A', true, 1, '06')]
  }
];

let report = null;
const prisma = {
  course: {
    async findFirst({ where }) {
      if (where.id !== 'course-1') return null;
      return { id: 'course-1', title: '力与运动', subject: '物理', grade: '高一', status: 'active', deletedAt: null, questions, sessions };
    }
  },
  courseAnalysisReport: {
    async findUnique() { return report; },
    async findFirst({ where }) { return report?.id === where.id ? { ...report, course: { id: 'course-1', title: '力与运动', subject: '物理', grade: '高一' } } : null; },
    async upsert({ create, update }) { report = { id: 'report-1', ...create, ...update }; return report; }
  }
};

const service = createCourseAnalysisService(prisma);
const all = await service.getCourseAnalysis('course-1');
assert.equal(all.summary.answerCount, 5);
assert.equal(all.summary.participantCount, 3);
assert.equal(all.summary.accuracy, 60);
assert.equal(all.summary.averageTimeSeconds, 24);
assert.equal(all.summary.weakQuestionCount, 1);
assert.equal(all.questionStats[0].id, 'q-weak');
assert.equal(all.filters.classes.length, 2);
assert.ok(all.source.fingerprint);

const classOnly = await service.getCourseAnalysis('course-1', { classId: 'c-1' });
assert.equal(classOnly.summary.answerCount, 3);
assert.equal(classOnly.filters.sessions.length, 1);

await assert.rejects(() => service.getCourseAnalysis('course-1', { sessionId: 'missing' }), /课堂场次/);

const detail = await service.getQuestionDetail('course-1', 'q-weak');
assert.equal(detail.answerDistribution.find((item) => item.value === 'B').count, 2);
assert.equal(detail.wrongStudents.length, 2);
assert.equal(detail.submissions.length, 3);

const saved = await service.saveReport('course-1', {}, {
  source: all.source,
  summary: { conclusions: ['整体需加强'] }, weakPoints: [{ name: '受力分析' }],
  teachingSuggestions: ['复盘'], practiceSuggestions: { difficulty: '基础' }, rawText: '报告', provider: 'deepseek', model: 'deepseek-chat'
});
assert.equal(saved.id, 'report-1');
assert.equal((await service.getCourseAnalysis('course-1')).latestReport.isStale, false);

sessions[0].answers.push(answer('a7', 's-1', '2', questions[1], '0', false, 12, '07'));
assert.equal((await service.getCourseAnalysis('course-1')).latestReport.isStale, true);

const context = await service.getReportContext('report-1');
assert.equal(context.course.title, '力与运动');
assert.equal(context.weakPoints[0].name, '受力分析');

console.log('course analysis service checks passed');
