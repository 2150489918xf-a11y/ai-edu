import assert from 'node:assert/strict';

import { requestOutlineAgent } from '../src/data/outlineAgentClient.js';

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    async json() {
      return {
        error: {
          code: 'NOT_FOUND',
          message: '接口不存在'
        }
      };
    }
  });

  await assert.rejects(
    () => requestOutlineAgent({}),
    (error) => {
      assert.equal(error.message, '接口不存在');
      assert.notEqual(error.message, '[object Object]');
      return true;
    }
  );

  console.log('outline agent client error formatting checks passed');
} finally {
  globalThis.fetch = originalFetch;
}
