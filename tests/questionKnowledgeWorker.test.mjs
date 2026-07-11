import assert from 'node:assert/strict';

import { createQuestionKnowledgeWorker } from '../server/services/questionKnowledgeWorker.js';

let calls = 0;
let release;
const graphService = {
  async processNextPendingExtraction() {
    calls += 1;
    return new Promise((resolve) => {
      release = resolve;
    });
  }
};

const worker = createQuestionKnowledgeWorker({ graphService, intervalMs: 20 });
const first = worker.runOnce();
const second = worker.runOnce();
await Promise.resolve();
assert.equal(calls, 1, 'concurrent runOnce calls must share one active job');

let stopped = false;
const stopPromise = worker.stop().then(() => {
  stopped = true;
});
await Promise.resolve();
assert.equal(stopped, false, 'stop must wait for the active job');

release({ questionId: 'q1', status: 'ready' });
const [firstResult, secondResult] = await Promise.all([first, second]);
await stopPromise;
assert.deepEqual(firstResult, { questionId: 'q1', status: 'ready' });
assert.deepEqual(secondResult, firstResult);
assert.equal(stopped, true);

console.log('question knowledge worker tests passed');
