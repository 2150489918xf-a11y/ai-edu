import assert from 'node:assert/strict';

import {
  extractOutlineJsonBlock,
  normalizeOutlinePayload,
  stripOutlineJsonBlock
} from '../src/data/outlineAgentClient.js';

const response = [
  '已把实验探究环节改成更强调变量控制。',
  '',
  ':::outline-json',
  '{',
  '  "version": "v4",',
  '  "tags": [{ "text": "力与加速度", "tone": "success" }],',
  '  "sections": [',
  '    {',
  '      "id": "experiment",',
  '      "phase": "实验探究",',
  '      "time": "8-25 分钟",',
  '      "title": "力、质量与加速度关系",',
  '      "status": "optimized",',
  '      "active": true,',
  '      "cards": [',
  '        { "label": "关键内容", "content": "控制变量，对比小车在不同拉力和质量下的加速度。", "tone": "focus" },',
  '        { "label": "风险知识点", "content": "把单个力误当合力。", "tone": "warning" }',
  '      ]',
  '    }',
  '  ]',
  '}',
  ':::'
].join('\n');

const block = extractOutlineJsonBlock(response);
assert.ok(block.startsWith('{'), 'extractOutlineJsonBlock should return raw JSON content');
assert.ok(block.includes('"tone": "focus"'), 'extracted JSON should preserve card tone tokens');

const visible = stripOutlineJsonBlock(response);
assert.equal(visible, '已把实验探究环节改成更强调变量控制。');

const outline = normalizeOutlinePayload(JSON.parse(block));
assert.equal(outline.version, 'v4');
assert.deepEqual(outline.tags, [{ text: '力与加速度', tone: 'success' }]);
assert.equal(outline.sections[0].id, 'experiment');
assert.equal(outline.sections[0].status, 'optimized');
assert.equal(outline.sections[0].active, true);
assert.deepEqual(outline.sections[0].cards[0], {
  label: '关键内容',
  content: '控制变量，对比小车在不同拉力和质量下的加速度。',
  tone: 'focus'
});
assert.deepEqual(outline.sections[0].cards[1], {
  label: '风险知识点',
  content: '把单个力误当合力。',
  tone: 'warning'
});

assert.throws(
  () => normalizeOutlinePayload({ version: 'v1', sections: [] }),
  /sections/,
  'outline payload should require at least one section'
);

assert.throws(
  () => normalizeOutlinePayload({ version: 'v1', sections: [{ title: '缺字段', cards: [] }] }),
  /phase/,
  'outline sections should require phase and other display fields'
);

console.log('outline agent client parsing checks passed');
