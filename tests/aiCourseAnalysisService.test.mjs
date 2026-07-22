import assert from 'node:assert/strict';
import { createAiCourseAnalysisService } from '../server/services/aiCourseAnalysisService.js';

const snapshot = { course: { title: '力与运动', subject: '物理', grade: '高一' }, scope: { type: 'course' }, summary: { accuracy: 55 }, questionStats: [{ id: 'q1', title: '受力题', accuracy: 20, answerCount: 5 }], source: { fingerprint: 'fp', answerCount: 5, questionCount: 1 } };
let saved = null;
const courseAnalysisService = {
  async getCourseAnalysis() { return snapshot; },
  async saveReport(courseId, filters, payload) { saved = { courseId, filters, payload }; return { id: 'report-1', ...payload }; }
};

const report = { summary: { conclusions: ['需要加强'] }, weakPoints: [{ name: '受力分析', evidence: '正确率低' }], teachingSuggestions: ['示范受力图'], practiceSuggestions: { difficulty: '基础', count: 5 } };
const providerText = `正在分析。\n:::course-analysis-report-start\n${JSON.stringify(report)}\n:::course-analysis-report-end`;
const body = `${providerText.split('').map((char) => `data: ${JSON.stringify({ choices: [{ delta: { content: char } }] })}\n\n`).join('')}data: [DONE]\n\n`;
const fetchImpl = async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
const deltas = [];
let emitted = null;
const service = createAiCourseAnalysisService({ courseAnalysisService, env: { DEEPSEEK_API_KEY: 'key', DEEPSEEK_MODEL: 'deepseek-chat' }, fetchImpl });
await service.streamReport({ courseId: 'course-1', prompt: '重点关注错因' }, { onDelta: (text) => deltas.push(text), onReport: (value) => { emitted = value; } });
assert.ok(deltas.join('').includes('正在分析'));
assert.equal(saved.payload.weakPoints[0].name, '受力分析');
assert.equal(emitted.id, 'report-1');

const missingKey = createAiCourseAnalysisService({ courseAnalysisService, env: {}, fetchImpl });
await assert.rejects(() => missingKey.streamReport({ courseId: 'course-1' }), /DEEPSEEK_API_KEY/);

let malformedSaved = false;
const malformed = createAiCourseAnalysisService({ courseAnalysisService: { ...courseAnalysisService, async saveReport() { malformedSaved = true; } }, env: { DEEPSEEK_API_KEY: 'key' }, fetchImpl: async () => new Response('data: {"choices":[{"delta":{"content":"无结构"}}]}\n\ndata: [DONE]\n\n') });
await assert.rejects(() => malformed.streamReport({ courseId: 'course-1' }), /结构化/);
assert.equal(malformedSaved, false);

console.log('AI course analysis service checks passed');
