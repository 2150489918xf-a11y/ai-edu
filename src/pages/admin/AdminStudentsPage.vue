<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.vue';
import AdminPageState from '../../components/admin/AdminPageState.vue';
import AdminPagination from '../../components/admin/AdminPagination.vue';
import AdminResourceDrawer from '../../components/admin/AdminResourceDrawer.vue';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge.vue';
import {
  archiveAdminStudent,
  createAdminStudent,
  listAdminClasses,
  listAdminStudents,
  restoreAdminStudent,
  updateAdminStudent
} from '../../data/adminApiClient';

const rows = ref([]);
const classes = ref([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const keyword = ref('');
const status = ref('active');
const classId = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const drawerOpen = ref(false);
const editingId = ref('');
const confirmTarget = ref(null);
const form = ref({ name: '', username: '', password: 'student123', studentNo: '', classId: '' });

function resetForm() {
  editingId.value = '';
  form.value = { name: '', username: '', password: 'student123', studentNo: '', classId: classes.value[0]?.id || '' };
}

async function loadLookups(options = {}) {
  const result = await listAdminClasses({ status: 'active', pageSize: 100 }, options);
  classes.value = result.data;
}

async function loadRows(options = {}) {
  loading.value = true; error.value = '';
  try {
    const result = await listAdminStudents({ keyword: keyword.value, status: status.value, classId: classId.value, page: pagination.value.page, pageSize: pagination.value.pageSize }, options);
    rows.value = result.data;
    pagination.value = result.pagination;
  } catch (err) { error.value = err.message || '学生列表加载失败'; }
  finally { loading.value = false; }
}

async function initialize(options = {}) {
  try { await Promise.all([loadLookups(options), loadRows(options)]); }
  catch (err) { error.value = err.message || '学生管理数据加载失败'; loading.value = false; }
}

function search() { pagination.value.page = 1; loadRows({ force: true }); }
function changePage(page) { pagination.value.page = page; loadRows({ force: true }); }
function openCreate() { resetForm(); drawerOpen.value = true; }
function openEdit(row) {
  editingId.value = row.id;
  form.value = { name: row.name, username: row.username || '', password: '', studentNo: row.studentNo || '', classId: row.classId };
  drawerOpen.value = true;
}

async function saveStudent() {
  saving.value = true; error.value = ''; notice.value = '';
  try {
    if (editingId.value) {
      await updateAdminStudent(editingId.value, { name: form.value.name, studentNo: form.value.studentNo, classId: form.value.classId });
      notice.value = '学生档案已更新';
    } else {
      await createAdminStudent(form.value);
      notice.value = '学生账号与档案已创建';
    }
    drawerOpen.value = false; resetForm(); await loadRows({ force: true });
  } catch (err) { error.value = err.message || '学生保存失败'; }
  finally { saving.value = false; }
}

async function archiveStudent() {
  if (!confirmTarget.value) return;
  saving.value = true; error.value = '';
  try { await archiveAdminStudent(confirmTarget.value.id); notice.value = `已停用 ${confirmTarget.value.name}`; confirmTarget.value = null; await loadRows({ force: true }); }
  catch (err) { error.value = err.message || '学生停用失败'; }
  finally { saving.value = false; }
}

async function restoreStudent(row) {
  saving.value = true; error.value = '';
  try { await restoreAdminStudent(row.id); notice.value = `已恢复 ${row.name}`; await loadRows({ force: true }); }
  catch (err) { error.value = err.message || '学生恢复失败'; }
  finally { saving.value = false; }
}

function handleRefresh() { initialize({ force: true }); }
onMounted(() => { initialize(); window.addEventListener('admin:refresh', handleRefresh); });
onBeforeUnmount(() => window.removeEventListener('admin:refresh', handleRefresh));
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-header"><div><h2>学生档案与账号</h2><p>管理学生学号、登录账号和班级归属。</p></div><button class="admin-button" type="button" @click="openCreate"><span class="material-symbols-outlined">add</span>新增学生</button></header>
    <p v-if="notice" class="admin-notice">{{ notice }}</p><p v-if="error && !loading" class="admin-notice is-error">{{ error }}</p>
    <section class="admin-panel">
      <form class="admin-toolbar" @submit.prevent="search"><div class="admin-filters admin-student-filters">
        <label class="admin-search"><span class="material-symbols-outlined">search</span><input v-model="keyword" class="admin-input" placeholder="姓名、学号或账号" /></label>
        <select v-model="classId" class="admin-select" @change="search"><option value="">全部班级</option><option v-for="item in classes" :key="item.id" :value="item.id">{{ item.name }}</option></select>
        <select v-model="status" class="admin-select" @change="search"><option value="active">正常</option><option value="archived">已停用</option><option value="all">全部状态</option></select>
        <button class="admin-button secondary" type="submit">查询</button>
      </div></form>
      <AdminPageState :loading="loading" :error="error" :empty="!rows.length" empty-title="暂无学生" @retry="initialize({ force: true })">
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>学生</th><th>学号</th><th>登录账号</th><th>班级</th><th>练习次数</th><th>状态</th><th>操作</th></tr></thead>
          <tbody><tr v-for="row in rows" :key="row.id"><td><strong>{{ row.name }}</strong></td><td>{{ row.studentNo || '—' }}</td><td>{{ row.username || '未绑定' }}</td><td>{{ row.className || '—' }}</td><td>{{ row.practiceCount || 0 }}</td><td><AdminStatusBadge :status="row.status" /></td><td><div class="admin-table-actions"><button class="admin-button text" type="button" @click="openEdit(row)">编辑</button><button v-if="row.status === 'active'" class="admin-button text" type="button" @click="confirmTarget = row">停用</button><button v-else class="admin-button text" type="button" :disabled="saving" @click="restoreStudent(row)">恢复</button></div></td></tr></tbody>
        </table></div>
      </AdminPageState>
      <AdminPagination v-if="!loading" v-bind="pagination" @change="changePage" />
    </section>

    <AdminResourceDrawer :open="drawerOpen" :busy="saving" :title="editingId ? '编辑学生' : '新增学生'" description="学生账号用于登录学生端。" @close="drawerOpen = false">
      <form id="student-admin-form" class="admin-form" @submit.prevent="saveStudent"><div class="admin-form-grid">
        <div class="admin-field"><label>学生姓名</label><input v-model="form.name" class="admin-input" required /></div><div class="admin-field"><label>学号</label><input v-model="form.studentNo" class="admin-input" /></div>
        <div class="admin-field full"><label>所属班级</label><select v-model="form.classId" class="admin-select" required><option disabled value="">请选择班级</option><option v-for="item in classes" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
        <div v-if="!editingId" class="admin-field"><label>登录账号</label><input v-model="form.username" class="admin-input" required /></div><div v-if="!editingId" class="admin-field"><label>初始密码</label><input v-model="form.password" class="admin-input" required /></div>
      </div></form>
      <template #footer><button class="admin-button secondary" type="button" @click="drawerOpen = false">取消</button><button class="admin-button" type="submit" form="student-admin-form" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button></template>
    </AdminResourceDrawer>
    <AdminConfirmDialog :open="Boolean(confirmTarget)" :busy="saving" title="停用学生" :message="`停用后，${confirmTarget?.name || '该学生'} 将无法登录；答题、选课和学情数据会保留。`" confirm-text="确认停用" @close="confirmTarget = null" @confirm="archiveStudent" />
  </section>
</template>
