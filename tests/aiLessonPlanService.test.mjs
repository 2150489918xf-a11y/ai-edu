import assert from 'node:assert/strict';

import { createAiLessonPlanService } from '../server/services/aiLessonPlanService.js';

const lessonPlan = {
  version: 'v1',
  meta: { grade: '高一', subject: '数学', duration: '40 分钟' },
  objectives: [{ title: '知识目标', content: '理解函数单调性。' }],
  materials: [{ label: '课程依据', value: '函数图像与表格。' }],
  focus: ['单调区间'],
  difficulties: ['图像判断'],
  steps: [{
    id: 'observe',
    title: '图像观察',
    time: '0-8 分钟',
    intent: '从图像变化引出单调性。',
    teacher: ['展示图像'],
    student: ['观察变化'],
    board: '单调递增 / 单调递减',
    check: '能说出区间'
  }],
  closing: [{ title: '题目联动', content: '进入题库练习。' }]
};

function createProviderStream(text) {
  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(0, 18) } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(18) } }] })}\n\n`,
    'data: [DONE]\n\n'
  ];
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    }
  });
}

const captured = {};
const service = createAiLessonPlanService({
  env: {
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_MODEL: 'deepseek-chat',
    DEEPSEEK_BASE_URL: 'https://deepseek.test'
  },
  fetchImpl: async (url, options) => {
    captured.url = url;
    captured.body = JSON.parse(options.body);
    return {
      ok: true,
      body: createProviderStream(`已生成。\n${JSON.stringify(lessonPlan)}`)
    };
  }
});

const events = [];
await service.streamLessonPlan({
  course: { id: 'course-1', title: '函数单调性', subject: '数学', grade: '高一' },
  prompt: '生成教案'
}, {
  onDelta: (text) => events.push(['delta', text]),
  onLessonPlan: (plan) => events.push(['lessonPlan', plan.steps[0].title]),
  onDone: (meta) => events.push(['done', meta.provider])
});

assert.equal(captured.url, 'https://deepseek.test/chat/completions');
assert.equal(captured.body.stream, true);
assert.ok(events.some((event) => event[0] === 'lessonPlan' && event[1] === '图像观察'));
assert.deepEqual(events.at(-1), ['done', 'deepseek']);

console.log('AI lesson plan service contracts passed');
