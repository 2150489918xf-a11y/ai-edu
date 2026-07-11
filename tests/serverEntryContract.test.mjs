import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');

assert.ok(source.includes('process.env.SERVER_HOST'), 'server entry should allow host binding through SERVER_HOST');
assert.ok(source.includes("process.env.SERVER_HOST || '0.0.0.0'"));
assert.ok(source.includes('server.listen(port, host'));

console.log('server entry contracts passed');
