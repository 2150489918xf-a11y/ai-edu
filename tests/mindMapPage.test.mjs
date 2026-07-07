import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/MindMapGeneratePage.vue', import.meta.url), 'utf8');

assert.ok(
  !source.includes('font-size: 0;'),
  'mind map page should not hide Material Symbols glyphs'
);

assert.ok(
  source.includes('displayMarkdown'),
  'mind map renderer should use editable display markdown'
);

assert.ok(
  source.includes('mind-edit-panel'),
  'mind map page should include a manual edit panel'
);

assert.ok(
  source.includes('node-edit-panel'),
  'mind map page should include a visual node edit panel'
);

assert.ok(
  !source.includes('mind-source-summary'),
  'mind map source sidebar should not show Evidence coverage'
);

assert.ok(
  source.indexOf('node-edit-panel') > source.indexOf('mind-sources') &&
    source.indexOf('node-edit-panel') < source.indexOf('mind-canvas-panel'),
  'node edit panel should be placed in the left source sidebar'
);

assert.ok(
  source.includes('addChildBranch'),
  'mind map page should support adding child branches from the selected node'
);

assert.ok(
  source.includes('addSiblingBranch'),
  'mind map page should support adding sibling branches from the selected node'
);

assert.ok(
  source.includes('renameSelectedBranch'),
  'mind map page should support renaming the selected node'
);

assert.ok(
  source.includes('deleteSelectedBranch'),
  'mind map page should support deleting the selected node'
);

assert.ok(
  source.includes('.mind-agent-feed article.user'),
  'mind map agent should style user messages separately'
);

assert.ok(
  source.includes('grid-template-columns: minmax(0, 1fr) 28px'),
  'mind map agent user messages should place avatar on the right'
);

assert.ok(
  source.includes('openMindMapEditor') && source.includes('mind-edit-toggle'),
  'mind map page should expose a manual edit action'
);

assert.ok(
  !source.includes("message.content.startsWith('#')"),
  'mind map agent chat should display cleaned assistant text instead of detecting raw markdown headings'
);

assert.ok(
  source.includes('streamAgentReply'),
  'mind map agent should stream assistant replies into the chat bubble'
);

assert.ok(
  source.includes('agentTypingTimer'),
  'mind map agent streaming should clean up its typing timer'
);

assert.ok(
  source.includes('isStreaming: true'),
  'mind map agent should create a streaming assistant message placeholder'
);

assert.ok(
  source.includes('align-self: start'),
  'mind map user avatar and bubble should be top-aligned like assistant messages'
);

assert.ok(
  !source.includes('max-height: 54px'),
  'mind map agent chat bubbles should grow with long replies instead of clipping content'
);

assert.ok(
  source.includes('white-space: pre-wrap'),
  'mind map agent chat bubbles should preserve line breaks and wrap long text'
);

assert.ok(
  source.includes('.mind-agent-feed article.assistant p'),
  'mind map agent assistant bubbles should have their own visible background style'
);

assert.ok(
  source.includes('overflow-y: auto'),
  'mind map source sidebar should allow vertical overflow so node edit actions are not clipped'
);

assert.ok(
  source.includes('scrollbar-width: none'),
  'mind map source sidebar should hide its scrollbar while still allowing content access'
);

assert.ok(
  source.includes('padding-bottom: 28px'),
  'mind map node edit panel should keep bottom actions clear of the viewport edge'
);

console.log('mind map page contract checks passed');
