import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  createStreamingLessonPlanParser,
  extractLessonPlanJsonBlock,
  getLessonPlanAssistantText,
  normalizeLessonPlanPayload,
  parseLessonPlanFromAiText,
  streamLessonPlan,
  stripLessonPlanJsonBlock
} from '../src/data/lessonPlanAgentClient.js';

const lessonPlan = {
  version: 'v1',
  meta: {
    grade: '高一',
    subject: '物理',
    textbook: '人教版 2019 · 必修 1',
    duration: '45 分钟'
  },
  objectives: [
    { title: '物理观念', content: '理解 F=ma 的物理意义。' }
  ],
  materials: [
    { label: '教材依据', value: '4.3 牛顿第二定律' }
  ],
  focus: ['F=ma 公式含义'],
  difficulties: ['合力方向判断'],
  steps: [
    {
      id: 'intro',
      title: '情境导入',
      time: "0-5'",
      intent: '用购物车情境引出问题。',
      teacher: ['展示情境'],
      student: ['观察现象'],
      board: '加速度可能与哪些因素有关？',
      check: '能说出力和质量。'
    }
  ],
  closing: [
    { title: '课件联动', content: '后续可生成 PPT。' }
  ]
};

const wrapped = [
  '已生成第一版教案。',
  ':::lesson-plan-json',
  JSON.stringify(lessonPlan),
  ':::'
].join('\n');

assert.equal(extractLessonPlanJsonBlock(wrapped), JSON.stringify(lessonPlan));
assert.equal(stripLessonPlanJsonBlock(wrapped), '已生成第一版教案。');
assert.equal(parseLessonPlanFromAiText(wrapped).steps[0].title, '情境导入');

const rawJsonReply = [
  '已按当前课程重新生成教案。',
  JSON.stringify(lessonPlan, null, 2)
].join('\n');
assert.equal(parseLessonPlanFromAiText(rawJsonReply).meta.subject, '物理');
assert.equal(stripLessonPlanJsonBlock(rawJsonReply), '已按当前课程重新生成教案。');
assert.equal(getLessonPlanAssistantText(`${rawJsonReply.slice(0, 60)}\n"teacher": [`), '已按当前课程重新生成教案。');

const normalized = normalizeLessonPlanPayload(lessonPlan);
assert.equal(normalized.meta.grade, '高一');
assert.equal(normalized.objectives[0].title, '物理观念');
assert.equal(normalized.steps[0].id, 'intro');
assert.equal(normalized.steps[0].status, 'done');

const parser = createStreamingLessonPlanParser();
const parsedEvents = [
  ...parser.push(':::lesson-meta\n{"grade":"高一","subject":"物理"}\n:::'),
  ...parser.push(':::lesson-section-start\n{"id":"experiment","title":"实验探究","time":"8-25","intent":"探究关系","teacher":["组织实验"],"student":["记录数据"],"board":"a-F 图像","check":"能解释图像"}\n:::lesson-section-end')
];
assert.deepEqual(parsedEvents.map((event) => event.type), ['meta', 'section']);
assert.equal(parsedEvents[1].section.title, '实验探究');

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  assert.equal(req.method, 'POST');
  assert.equal(url.pathname, '/api/v1/courses/course-1/lesson-plan/generate-stream');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  sendSse(res, 'delta', { text: '正在生成教学目标。' });
  sendSse(res, 'meta', { meta: lessonPlan.meta });
  sendSse(res, 'section', { section: lessonPlan.steps[0] });
  sendSse(res, 'lessonPlan', { lessonPlan });
  sendSse(res, 'done', { provider: 'deepseek', model: 'deepseek-chat' });
  res.end();
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
globalThis.__EDUAI_API_BASE_URL__ = `http://127.0.0.1:${address.port}/api/v1`;

try {
  const events = [];
  await streamLessonPlan('course-1', { prompt: '生成教案' }, {
    onDelta: (text) => events.push(['delta', text]),
    onMeta: (meta) => events.push(['meta', meta.grade]),
    onSection: (section) => events.push(['section', section.title]),
    onLessonPlan: (plan) => events.push(['lessonPlan', plan.steps.length]),
    onDone: (meta) => events.push(['done', meta.provider])
  });
  assert.deepEqual(events, [
    ['delta', '正在生成教学目标。'],
    ['meta', '高一'],
    ['section', '情境导入'],
    ['lessonPlan', 1],
    ['done', 'deepseek']
  ]);
  console.log('lesson plan agent client contracts passed');
} finally {
  delete globalThis.__EDUAI_API_BASE_URL__;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
