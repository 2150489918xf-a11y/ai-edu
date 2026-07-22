import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles/admin-system.css', import.meta.url), 'utf8');

assert.ok(!styles.includes('gradient('), 'admin system should not use decorative gradients');
assert.ok(!styles.includes('backdrop-filter'), 'admin system should not use glass surfaces');
assert.match(
  styles,
  /\.admin-system-shell,\s*\.admin-drawer-layer,\s*\.admin-dialog-layer\s*\{[^}]*--admin-border:/s,
  'teleported drawers and dialogs must inherit the complete admin theme variables'
);
assert.match(styles, /\.admin-workspace\s*\{[^}]*overflow-x:\s*hidden/s);
assert.match(styles, /\.admin-table-wrap\s*\{[^}]*overflow-x:\s*auto/s);
assert.ok(styles.includes('min-height: 2.75rem'));
assert.ok(styles.includes('@media (max-width: 1023px)'));
assert.ok(styles.includes('@media (max-width: 767px)'));
assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.admin-resource-drawer\s*\{\s*width:\s*100%/);
assert.ok(styles.includes('@media (prefers-reduced-motion: reduce)'));

console.log('admin responsive style contracts passed');
