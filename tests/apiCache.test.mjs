import assert from 'node:assert/strict';

import {
  cachedApiRequest,
  clearApiCacheNamespace,
  stableCacheKey
} from '../src/data/apiCache.js';

globalThis.sessionStorage = new Map();
globalThis.sessionStorage.getItem = globalThis.sessionStorage.get.bind(globalThis.sessionStorage);
globalThis.sessionStorage.setItem = globalThis.sessionStorage.set.bind(globalThis.sessionStorage);
globalThis.sessionStorage.removeItem = globalThis.sessionStorage.delete.bind(globalThis.sessionStorage);
globalThis.sessionStorage.key = (index) => [...globalThis.sessionStorage.keys()][index] || null;
Object.defineProperty(globalThis.sessionStorage, 'length', {
  get() {
    return globalThis.sessionStorage.size;
  }
});

try {
  assert.equal(stableCacheKey({ b: 2, a: 1 }), '{"a":1,"b":2}');

  let calls = 0;
  const first = await cachedApiRequest('cache-test', 'same-key', async () => {
    calls += 1;
    return { value: calls };
  });
  const second = await cachedApiRequest('cache-test', 'same-key', async () => {
    calls += 1;
    return { value: calls };
  });

  assert.deepEqual(first, { value: 1 });
  assert.deepEqual(second, { value: 1 });
  assert.equal(calls, 1);

  const forced = await cachedApiRequest('cache-test', 'same-key', async () => {
    calls += 1;
    return { value: calls };
  }, { force: true });
  assert.deepEqual(forced, { value: 2 });
  assert.equal(calls, 2);

  clearApiCacheNamespace('cache-test');
  const afterClear = await cachedApiRequest('cache-test', 'same-key', async () => {
    calls += 1;
    return { value: calls };
  });
  assert.deepEqual(afterClear, { value: 3 });
  assert.equal(calls, 3);

  console.log('api cache contracts passed');
} finally {
  clearApiCacheNamespace('cache-test');
  delete globalThis.sessionStorage;
}
