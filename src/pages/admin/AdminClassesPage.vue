<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.vue';
import AdminPageState from '../../components/admin/AdminPageState.vue';
import AdminPagination from '../../components/admin/AdminPagination.vue';
import AdminResourceDrawer from '../../components/admin/AdminResourceDrawer.vue';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge.vue';
import { archiveAdminClass, createAdminClass, listAdminClasses, listAdminTeachers, restoreAdminClass, updateAdminClass } from '../../data/adminApiClient';

const rows = ref([]); const teachers = ref([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const keyword = ref(''); const status = ref('active'); const loading = ref(true); const saving = ref(false); const error = ref(''); const notice = ref('');
const drawerOpen = ref(false); const editingId = ref(''); const confirmTarget = ref(null);
const form = ref({ name: '', grade: '高一', subject: '', teacherId: '' });

function resetForm() { editingId.value = ''; form.value = { name: '', grade: '高一', subject: '', teacherId: '' }; }
async function loadLookups(options = {}) { teachers.value = (await listAdminTeachers({ status: 'active', pageSize: 100 }, options)).data; }
async function loadRows(options = {}) {
  loading.value = true; error.value = '';
  try { const result = await listAdminClasses({ keyword: keyword.value, status: status.value, page: pagination.value.page, pageSize: pagination.value.pageSize }, options); rows.value = result.data; pagination.value = result.pagination; }
  catch (err) { error.value = err.message || '班级列表加载失败'; } finally { loading.value = false; }
}
async function initialize(options = {}) { try { await Promise.all([loadLookups(options), loadRows(options)]); } catch (err) { error.value = err.message || '班级管理数据加载失败'; loading.value = false; } }
function search() { pagination.value.page = 1; loadRows({ force: true }); }
function changePage(page) { pagination.value.page = page; loadRows({ force: true }); }
function openCreate() { resetForm(); drawerOpen.value = true; }
function openEdit(row) { editingId.value = row.id; form.value = { name: row.name, grade: row.grade, subject: row.subject, teacherId: row.teacherId || '' }; drawerOpen.value = true; }
async function saveClass() {
  saving.value = true; error.value = ''; notice.value = '';
  try { if (editingId.value) { await updateAdminClass(editingId.value, form.value); notice.value = '班级信息已更新'; } else { await createAdminClass(form.value); notice.value = '班级已创建'; } drawerOpen.value = false; resetForm(); await loadRows({ force: true }); }
  catch (err) { error.value = err.message || '班级保存失败'; } finally { saving.value = false; }
}
async function archiveClass() {
  if (!confirmTarget.value) return; saving.value = true; error.value = '';
  try { await archiveAdminClass(confirmTarget.value.id); notice.value = `已停用 ${confirmTarget.value.name}`; confirmTarget.value = null; await loadRows({ force: true }); }
  catch (err) { error.value = err.message || '班级停用失败'; confirmTarget.value = null; } finally { saving.value = false; }
}
async function restoreClass(row) { saving.value = true; error.value = ''; try { await restoreAdminClass(row.id); notice.value = `已恢复 ${row.name}`; await loadRows({ force: true }); } catch (err) { error.value = err.message || '班级恢复失败'; } finally { saving.value = false; } }
function handleRefresh() { initialize({ force: true }); }
onMounted(() => { initialize(); window.addEventListener('admin:refresh', handleRefresh); });
onBeforeUnmount(() => window.removeEventListener('admin:refresh', handleRefresh));
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-header"><div><h2>教学班管理</h2><p>维护班级年级、学科和负责人。</p></div><button class="admin-button" type="button" @click="openCreate"><span class="material-symbols-outlined">add</span>新建班级</button></header>
    <p v-if="notice" class="admin-notice">{{ notice }}</p><p v-if="error && !loading" class="admin-notice is-error">{{ error }}</p>
    <section class="admin-panel">
      <form class="admin-toolbar" @submit.prevent="search"><div class="admin-filters"><label class="admin-search"><span class="material-symbols-outlined">search</span><input v-model="keyword" class="admin-input" placeholder="班级名称、年级或学科" /></label><select v-model="status" class="admin-select" @change="search"><option value="active">正常</option><option value="archived">已停用</option><option value="all">全部状态</option></select><button class="admin-button secondary" type="submit">查询</button></div></form>
      <AdminPageState :loading="loading" :error="error" :empty="!rows.length" empty-title="暂无班级" @retry="initialize({ force: true })">
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>班级名称</th><th>年级</th><th>学科</th><th>负责人</th><th>学生</th><th>课堂</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="row in rows" :key="row.id"><td><strong>{{ row.name }}</strong></td><td>{{ row.grade }}</td><td>{{ row.subject }}</td><td>{{ row.teacherName || '未指定' }}</td><td>{{ row.studentCount }}</td><td>{{ row.sessionCount }}</td><td><AdminStatusBadge :status="row.status" /></td><td><div class="admin-table-actions"><button class="admin-button text" type="button" @click="openEdit(row)">编辑</button><button v-if="row.status === 'active'" class="admin-button text" type="button" @click="confirmTarget = row">停用</button><button v-else class="admin-button text" type="button" :disabled="saving" @click="restoreClass(row)">恢复</button></div></td></tr>
        </tbody></table></div>
      </AdminPageState><AdminPagination v-if="!loading" v-bind="pagination" @change="changePage" />
    </section>
    <AdminResourceDrawer :open="drawerOpen" :busy="saving" :title="editingId ? '编辑班级' : '新建班级'" description="负责人可后续调整。" @close="drawerOpen = false">
      <form id="class-admin-form" class="admin-form" @submit.prevent="saveClass"><div class="admin-form-grid"><div class="admin-field full"><label>班级名称</label><input v-model="form.name" class="admin-input" required /></div><div class="admin-field"><label>年级</label><input v-model="form.grade" class="admin-input" required /></div><div class="admin-field"><label>学科</label><input v-model="form.subject" class="admin-input" required /></div><div class="admin-field full"><label>负责人</label><select v-model="form.teacherId" class="admin-select"><option value="">暂不指定</option><option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.name }}</option></select></div></div></form>
      <template #footer><button class="admin-button secondary" type="button" @click="drawerOpen = false">取消</button><button class="admin-button" type="submit" form="class-admin-form" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button></template>
    </AdminResourceDrawer>
    <AdminConfirmDialog :open="Boolean(confirmTarget)" :busy="saving" title="停用班级" :message="`只有没有正常学生和有效课堂的班级才能停用。即将检查 ${confirmTarget?.name || '该班级'}。`" confirm-text="检查并停用" @close="confirmTarget = null" @confirm="archiveClass" />
  </section>
</template>
