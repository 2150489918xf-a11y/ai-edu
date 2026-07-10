import assert from 'node:assert/strict';

import { createAiStudentTutorService } from '../server/services/aiStudentTutorService.js';

const capturedRequests = [];

async function fakeFetch(url, options) {
  capturedRequests.push({ url, options, body: JSON.parse(options.body) });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"先分析受力"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"，再代入 F=ma。"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' }
  });
}

const service = createAiStudentTutorService({
  env: {
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_BASE_URL: 'https://deepseek.test',
    DEEPSEEK_MODEL: 'deepseek-chat'
  },
  fetchImpl: fakeFetch
});

const deltas = [];
let doneMeta = null;

await service.streamChat({
  studentId: 'stu-1',
  taskId: 'session-newton-001',
  course: {
    id: 'course-newton-2',
    title: '牛顿第二定律',
    subject: '物理',
    grade: '高一'
  },
  question: {
    id: 'q-choice',
    type: 'choice',
    title: '物体受合力 6N，质量 2kg，加速度是多少？',
    options: ['A. 2m/s²', 'B. 3m/s²'],
    studentAnswer: { value: 'B. 3m/s²' }
  },
  message: '为什么选 B？'
}, {
  onDelta: (text) => deltas.push(text),
  onDone: (meta) => {
    doneMeta = meta;
  }
});

assert.equal(capturedRequests.length, 1);
assert.equal(capturedRequests[0].url, 'https://deepseek.test/chat/completions');
assert.equal(capturedRequests[0].body.model, 'deepseek-chat');
assert.equal(capturedRequests[0].body.stream, true);
assert.equal(capturedRequests[0].body.messages[0].role, 'system');
assert.ok(capturedRequests[0].body.messages[0].content.includes('学生学习助手'));
assert.ok(capturedRequests[0].body.messages[0].content.includes('引导学生'));
assert.ok(capturedRequests[0].body.messages[1].content.includes('牛顿第二定律'));
assert.ok(capturedRequests[0].body.messages[1].content.includes('物体受合力 6N'));
assert.ok(capturedRequests[0].body.messages[1].content.includes('为什么选 B？'));
assert.deepEqual(deltas, ['先分析受力', '，再代入 F=ma。']);
assert.deepEqual(doneMeta, { provider: 'deepseek', model: 'deepseek-chat' });

console.log('AI student tutor service contracts passed');
