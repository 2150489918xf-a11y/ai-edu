import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const router = read('../src/router.js');
const layout = read('../src/layouts/AdminLayout.vue');
const drawer = read('../src/components/admin/AdminResourceDrawer.vue');
const dialog = read('../src/components/admin/AdminConfirmDialog.vue');
const pagination = read('../src/components/admin/AdminPagination.vue');

for (const path of ['overview', 'teachers', 'students', 'classes', 'courses', 'enrollments']) {
  assert.ok(router.includes(`path: '${path}'`), `admin child route ${path} should exist`);
}
assert.ok(router.includes("redirect: '/admin/overview'"));
assert.ok(layout.includes('<RouterView'));
assert.ok(layout.includes('admin-nav'));
assert.ok(layout.includes('router-link-active'));
assert.ok(layout.includes('menuOpen'));
assert.ok(layout.includes("router.replace('/admin/login')"));
assert.ok(layout.includes('退出登录'));
assert.ok(drawer.includes('role="dialog"'));
assert.ok(drawer.includes("@keydown.esc"));
assert.ok(dialog.includes('role="alertdialog"'));
assert.ok(dialog.includes('确认操作'));
assert.ok(pagination.includes("emit('change'"));

console.log('admin layout contracts passed');
