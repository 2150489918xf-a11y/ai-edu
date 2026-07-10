import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('../src/pages/QuestionGeneratePage.vue', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../src/components/AiChat.vue', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../server/services/aiQuestionService.js', import.meta.url), 'utf8');

assert.ok(
  pageSource.includes('chatLoading') && pageSource.includes('candidateLoading'),
  'question generate page should split chat loading from candidate panel loading'
);

assert.ok(
  !pageSource.includes('v-if="aiLoading" class="generation-loading"'),
  'candidate panel should not switch to the large loading state for every chat request'
);

assert.ok(
  pageSource.includes('candidateQuestions: candidateQuestions.value') &&
    pageSource.includes('editingQuestionId'),
  'AI request should include current candidates and the selected editing question context'
);

assert.ok(
  pageSource.includes('streamAiQuestions') &&
    pageSource.includes('handleStreamQuestion') &&
    pageSource.includes('generateAiQuestions'),
  'page should prefer streaming generation while retaining non-stream fallback'
);

assert.ok(
  pageSource.includes('replaceEditingQuestion') &&
    pageSource.includes('startEditingQuestion'),
  'page should support replacing an existing candidate question through AI editing'
);

assert.ok(
  !pageSource.includes('class="teacher-prompt"'),
  'left settings panel should not keep a separate free-text teacher prompt textarea'
);

assert.ok(
  chatSource.includes('height: 100%') &&
    chatSource.includes('min-height: 0') &&
    chatSource.includes('flex-shrink: 0'),
  'AI chat panel should keep the input composer pinned while messages scroll'
);

assert.ok(
  chatSource.includes('showThinking') &&
    pageSource.includes(':show-thinking="false"'),
  'question generate page should hide the reusable chat thinking bubble because streaming uses the live assistant bubble'
);

assert.ok(
  serviceSource.includes('candidateQuestions') &&
    serviceSource.includes('editingQuestion'),
  'AI question service should pass candidate and editing context to the model'
);

console.log('question generate page interaction contracts passed');
