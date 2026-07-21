import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
const arrowRule = css.match(/\.arrow\s*\{([\s\S]*?)\}/)?.[1] || '';

assert.match(arrowRule, /display:\s*(?:inline-)?flex/, 'quick-start text and arrow should use a horizontal flex row');
assert.match(arrowRule, /align-items:\s*center/, 'quick-start text and arrow should be vertically aligned');
assert.match(arrowRule, /justify-content:\s*center/, 'quick-start contents should stay centered in the button');
assert.match(arrowRule, /white-space:\s*nowrap/, 'quick-start text should not wrap above the arrow');

console.log('home quick-start layout contract passed');
