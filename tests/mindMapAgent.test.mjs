import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('../src/pages/MindMapGeneratePage.vue', import.meta.url), 'utf8');
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../server/app.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../server/services/aiMindMapService.js', import.meta.url), 'utf8');

assert.ok(
  !pageSource.includes('sk-'),
  'front-end source should not contain an API key'
);

assert.ok(
  pageSource.includes('generateCourseMindMap'),
  'mind map page should call the course mind map backend endpoint'
);

assert.ok(
  !pageSource.includes("from '../data/mockApi'") && !pageSource.includes('generateMindMap(courseId.value)'),
  'mind map generation button should not call mock mind map data'
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
  appSource.includes('mindmap\\/generate') || appSource.includes('/mindmap/generate'),
  'backend API should expose a persisted course mind map generation route'
);

assert.ok(
  serviceSource.includes(':::mindmap'),
  'server-side agent system prompt should require mind map updates inside :::mindmap blocks'
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
  pageSource.includes('loadPersistedCourseMindMap') && pageSource.includes('courseDetail.value?.mindmap'),
  'mind map page should restore the persisted course mind map on reload'
);

assert.ok(
  pageSource.includes('buildCourseMindMapPrompt') && pageSource.includes('agentMessages.value'),
  'AI generation button should add course basics into the agent conversation before requesting generation'
);

assert.ok(
  pageSource.includes('ensureCoursePersisted') && pageSource.includes('createCourse'),
  'mind map page should materialize mock courses in the backend before AI generation'
);

assert.ok(
  pageSource.includes('listKnowledgeMaterials') && pageSource.includes('saveReferencedMaterials'),
  'mind map page should allow teachers to select referenced knowledge materials'
);

assert.ok(
  pageSource.includes('referencedMaterials') && pageSource.includes('selectedMaterialIds'),
  'mind map page should render course referenced material cards from persisted selection'
);

assert.ok(
  gitignore.includes('.env'),
  'env files should be ignored so API keys are not committed'
);

console.log('mind map agent integration checks passed');
