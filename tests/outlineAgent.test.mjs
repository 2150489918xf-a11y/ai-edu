import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('../src/pages/WorkspacePage.vue', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/data/outlineAgentClient.js', import.meta.url), 'utf8');
const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

assert.ok(
  viteSource.includes('/api/outline-agent'),
  'vite dev server should expose the outline agent proxy endpoint'
);

assert.ok(
  viteSource.includes('DEEPSEEK_API_KEY'),
  'outline agent should reuse the server-side DeepSeek API key'
);

assert.ok(
  viteSource.includes('DEEPSEEK_MODEL'),
  'outline agent should reuse the configured DeepSeek model'
);

assert.ok(
  viteSource.includes(':::outline-json'),
  'outline agent system prompt should require updates inside :::outline-json blocks'
);

assert.ok(
  viteSource.includes('"tone"'),
  'outline agent system prompt should describe tone tokens for UI colors'
);

assert.ok(
  viteSource.includes('3-6'),
  'outline agent system prompt should allow a flexible 3-6 section outline'
);

assert.ok(
  pageSource.includes('requestOutlineAgent'),
  'workspace page should call the outline agent client'
);

assert.ok(
  pageSource.includes('sendOutlineAgentMessage(text);'),
  'workspace chat sends should route user messages through the real outline agent'
);

assert.ok(
  pageSource.includes('sendOutlineAgentMessage(') && pageSource.includes('3-6 个教学环节'),
  'workspace outline generation button should ask the real agent for a flexible section count'
);

assert.ok(
  !pageSource.includes('markOutlineGenerated'),
  'workspace outline generation should not use the old mock outline generator'
);

assert.ok(
  !pageSource.includes('我会优先保持 4 段教学节奏'),
  'workspace chat should not use the old hard-coded outline adjustment reply'
);

assert.ok(
  !pageSource.includes('可以的，我会把这个要求纳入大纲生成'),
  'workspace chat should not use the old hard-coded pre-outline reply'
);

assert.ok(
  !pageSource.includes('正在连接 DeepSeek'),
  'workspace chat should not render a separate DeepSeek connection placeholder bubble'
);

assert.ok(
  !pageSource.includes('四段式大纲') && !pageSource.includes('四段式推进'),
  'workspace page copy should not force a four-section outline'
);

assert.ok(
  !pageSource.includes('情境导入</strong>') &&
    !pageSource.includes('实验探究</strong>') &&
    !pageSource.includes('概念建构</strong>') &&
    !pageSource.includes('课堂检测</strong>'),
  'workspace preview should not hard-code the four old section labels'
);

assert.ok(
  clientSource.includes('/api/outline-agent'),
  'outline agent client should call the local outline agent endpoint'
);

assert.ok(
  pageSource.includes('extractOutlineJsonBlock'),
  'workspace page should extract structured outline JSON from agent replies'
);

assert.ok(
  pageSource.includes('stripOutlineJsonBlock'),
  'workspace page should hide structured outline JSON blocks from chat bubbles'
);

assert.ok(
  !pageSource.includes('sk-'),
  'front-end source should not contain an API key'
);

console.log('outline agent integration checks passed');
