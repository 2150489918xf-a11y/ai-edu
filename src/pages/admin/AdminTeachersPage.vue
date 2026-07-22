<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.vue';
import AdminPageState from '../../components/admin/AdminPageState.vue';
import AdminPagination from '../../components/admin/AdminPagination.vue';
import AdminResourceDrawer from '../../components/admin/AdminResourceDrawer.vue';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge.vue';
import {
  archiveAdminTeacher,
  createAdminTeacher,
  listAdminTeachers,
  restoreAdminTeacher,
  updateAdminTeacher
} from '../../data/adminApiClient';

const rows = ref([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const keyword = ref('');
const status = ref('active');
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const drawerOpen = ref(false);
const editingId = ref('');
const confirmTarget = ref(null);
const form = ref({ name: '', username: '', password: 'teacher123', phone: '', email: '' });

function resetForm() {
  form.value = { name: '', username: '', password: 'teacher123', phone: '', email: '' };
  editingId.value = '';
}

async function loadRows(options = {}) {
  loading.value = true;
  error.value = '';
  try {
    const result = await listAdminTeachers({ keyword: keyword.value, status: status.value, page: pagination.value.page, pageSize: pagination.value.pageSize }, options);
    rows.value = result.data;
    pagination.value = result.pagination;
  } catch (err) {
    error.value = err.message || '教师列表加载失败';
  } finally {
    loading.value = false;
  }
}

function search() { pagination.value.page = 1; loadRows({ force: true }); }
function changePage(page) { pagination.value.page = page; loadRows({ force: true }); }
function openCreate() { resetForm(); drawerOpen.value = true; }
function openEdit(row) {
  editingId.value = row.id;
  form.value = { name: row.name, username: row.username, password: '', phone: row.phone || '', email: row.email || '' };
  drawerOpen.value = true;
}

async function saveTeacher() {
  saving.value = true; error.value = ''; notice.value = '';
  try {
    if (editingId.value) {
      await updateAdminTeacher(editingId.value, { name: form.value.name, phone: form.value.phone, email: form.value.email });
      notice.value = '教师信息已更新';
    } else {
      await createAdminTeacher(form.value);
      notice.value = '教师账号已创建';
    }
    drawerOpen.value = false;
    resetForm();
    await loadRows({ force: true });
  } catch (err) { error.value = err.message || '教师保存失败'; }
  finally { saving.value = false; }
}

async function archiveTeacher() {
  if (!confirmTarget.value) return;
  saving.value = true; error.value = '';
  try {
    await archiveAdminTeacher(confirmTarget.value.id);
    notice.value = `已停用 ${confirmTarget.value.name}`;
    confirmTarget.value = null;
    await loadRows({ force: true });
  } catch (err) { error.value = err.message || '教师停用失败'; }
  finally { saving.value = false; }
}

async function restoreTeacher(row) {
  saving.value = true; error.value = '';
  try { await restoreAdminTeacher(row.id); notice.value = `已恢复 ${row.name}`; await loadRows({ force: true }); }
  catch (err) { error.value = err.message || '教师恢复失败'; }
  finally { saving.value = false; }
}

function handleRefresh() { loadRows({ force: true }); }
onMounted(() => { loadRows(); window.addEventListener('admin:refresh', handleRefresh); });
onBeforeUnmount(() => window.removeEventListener('admin:refresh', handleRefresh));
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-header">
      <div><h2>教师账号与档案</h2><p>管理教师登录账号、联系方式和任教数量。</p></div>
      <button class="admin-button" type="button" @click="openCreate"><span class="material-symbols-outlined">add</span>新增教师</button>
    </header>
    <p v-if="notice" class="admin-notice">{{ notice }}</p>
    <p v-if="error && !loading" class="admin-notice is-error">{{ error }}</p>

    <section class="admin-panel">
      <form class="admin-toolbar" @submit.prevent="search">
        <div class="admin-filters">
          <label class="admin-search"><span class="material-symbols-outlined">search</span><input v-model="keyword" class="admin-input" placeholder="姓名、账号、手机号或邮箱" /></label>
          <select v-model="status" class="admin-select" @change="search"><option value="active">正常</option><option value="archived">已停用</option><option value="all">全部状态</option></select>
          <button class="admin-button secondary" type="submit">查询</button>
        </div>
      </form>
      <AdminPageState :loading="loading" :error="error" :empty="!rows.length" empty-title="暂无教师" @retry="loadRows({ force: true })">
        <div class="admin-table-wrap">
          <table class="admin-table"><thead><tr><th>教师</th><th>账号</th><th>联系方式</th><th>任教数据</th><th>状态</th><th>操作</th></tr></thead>
            <tbody><tr v-for="row in rows" :key="row.id">
              <td><strong>{{ row.name }}</strong></td><td>{{ row.username || '—' }}</td><td>{{ row.phone || row.email || '未填写' }}</td><td>{{ row.classCount }} 个班 · {{ row.courseCount }} 门课</td><td><AdminStatusBadge :status="row.status" /></td>
              <td><div class="admin-table-actions"><button class="admin-button text" type="button" @click="openEdit(row)">编辑</button><button v-if="row.status === 'active'" class="admin-button text" type="button" @click="confirmTarget = row">停用</button><button v-else class="admin-button text" type="button" :disabled="saving" @click="restoreTeacher(row)">恢复</button></div></td>
            </tr></tbody>
          </table>
        </div>
      </AdminPageState>
      <AdminPagination v-if="!loading" v-bind="pagination" @change="changePage" />
    </section>

    <AdminResourceDrawer :open="drawerOpen" :busy="saving" :title="editingId ? '编辑教师' : '新增教师'" description="教师账号用于登录教师工作台。" @close="drawerOpen = false">
      <form id="teacher-admin-form" class="admin-form" @submit.prevent="saveTeacher"><div class="admin-form-grid">
        <div class="admin-field"><label>教师姓名</label><input v-model="form.name" class="admin-input" required /></div>
        <div class="admin-field"><label>登录账号</label><input v-model="form.username" class="admin-input" :disabled="Boolean(editingId)" required /></div>
        <div v-if="!editingId" class="admin-field full"><label>初始密码</label><input v-model="form.password" class="admin-input" required /><small>教师首次登录后可由系统管理员重置。</small></div>
        <div class="admin-field"><label>手机号</label><input v-model="form.phone" class="admin-input" /></div>
        <div class="admin-field"><label>邮箱</label><input v-model="form.email" class="admin-input" type="email" /></div>
      </div></form>
      <template #footer><button class="admin-button secondary" type="button" @click="drawerOpen = false">取消</button><button class="admin-button" type="submit" form="teacher-admin-form" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button></template>
    </AdminResourceDrawer>
    <AdminConfirmDialog :open="Boolean(confirmTarget)" :busy="saving" title="停用教师" :message="`停用后，${confirmTarget?.name || '该教师'} 将无法登录，但历史课程和教学数据会保留。`" confirm-text="确认停用" @close="confirmTarget = null" @confirm="archiveTeacher" />
  </section>
</template>
