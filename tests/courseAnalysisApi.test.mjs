import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createLearningApiApp } from '../server/app.js';

const calls = [];
const app = createLearningApiApp({
  learningService: {},
  courseAnalysisService: {
    async getCourseAnalysis(courseId, filters) { calls.push(['analysis', courseId, filters]); return { course: { id: courseId } }; },
    async getQuestionDetail(courseId, questionId, filters) { calls.push(['detail', courseId, questionId, filters]); return { question: { id: questionId } }; },
    async getReportContext(reportId) { calls.push(['context', reportId]); return { id: reportId }; }
  },
  aiCourseAnalysisService: {
    async streamReport(body, handlers) { calls.push(['stream', body]); handlers.onDelta('分析中'); handlers.onReport({ id: 'report-1' }); handlers.onDone({ provider: 'deepseek' }); }
  }
});
const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const analysis = await fetch(`${base}/api/v1/courses/course-1/analysis?classId=class-1&sessionId=session-1`).then((response) => response.json());
assert.equal(analysis.data.course.id, 'course-1');
assert.deepEqual(calls[0][2], { classId: 'class-1', sessionId: 'session-1' });

const detail = await fetch(`${base}/api/v1/courses/course-1/analysis/questions/q-1?classId=class-1`).then((response) => response.json());
assert.equal(detail.data.question.id, 'q-1');

const context = await fetch(`${base}/api/v1/course-analysis-reports/report-1/context`).then((response) => response.json());
assert.equal(context.data.id, 'report-1');

const stream = await fetch(`${base}/api/v1/courses/course-1/analysis/reports/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: 'class-1' }) }).then((response) => response.text());
assert.match(stream, /event: delta/);
assert.match(stream, /event: report/);
assert.match(stream, /event: done/);
assert.equal(calls.find((item) => item[0] === 'stream')[1].courseId, 'course-1');

await new Promise((resolve) => server.close(resolve));
console.log('course analysis API contracts passed');
