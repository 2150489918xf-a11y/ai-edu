import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('../src/pages/MindMapGeneratePage.vue', import.meta.url), 'utf8');
const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');

assert.ok(
  viteSource.includes('/api/mindmap-agent'),
  'vite dev server should expose the mind map agent proxy endpoint'
);

assert.ok(
  viteSource.includes('DEEPSEEK_API_KEY'),
  'deepseek api key should be read from server-side env'
);

assert.ok(
  !pageSource.includes('sk-'),
  'front-end source should not contain an API key'
);

assert.ok(
  pageSource.includes('/api/mindmap-agent'),
  'mind map page should call the local agent endpoint'
);

assert.ok(
  pageSource.includes('agentMessages'),
  'mind map page should keep full agent conversation history'
);

assert.ok(
  pageSource.includes('currentMarkdown'),
  'agent request should include the current mind map markdown'
);

assert.ok(
  viteSource.includes(':::mindmap'),
  'agent system prompt should require mind map updates inside :::mindmap blocks'
);

assert.ok(
  !viteSource.includes("Model response is not valid mind map markdown"),
  'agent proxy should allow normal chat replies without rejecting non-markdown responses'
);

assert.ok(
  pageSource.includes('extractMindMapBlock'),
  'mind map page should extract markdown from :::mindmap blocks'
);

assert.ok(
  pageSource.includes('stripMindMapBlock'),
  'mind map page should hide :::mindmap blocks from chat bubbles'
);

assert.ok(
  pageSource.includes('result.content || result.markdown'),
  'mind map page should read normal agent content before falling back to legacy markdown'
);

assert.ok(
  gitignore.includes('.env'),
  'env files should be ignored so API keys are not committed'
);

console.log('mind map agent integration checks passed');
