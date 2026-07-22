<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog.vue';
import AdminPageState from '../../components/admin/AdminPageState.vue';
import AdminPagination from '../../components/admin/AdminPagination.vue';
import AdminResourceDrawer from '../../components/admin/AdminResourceDrawer.vue';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge.vue';
import { archiveAdminCourse, createAdminCourse, listAdminCourses, listAdminTeachers, restoreAdminCourse, updateAdminCourse } from '../../data/adminApiClient';

const rows = ref([]); const teachers = ref([]); const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const keyword = ref(''); const status = ref('active'); const subject = ref(''); const grade = ref('');
const loading = ref(true); const saving = ref(false); const error = ref(''); const notice = ref(''); const drawerOpen = ref(false); const editingId = ref(''); const confirmTarget = ref(null);
const form = ref({ title: '', subject: '', grade: '高一', teacherId: '', duration: '45 分钟', description: '' });

function resetForm() { editingId.value = ''; form.value = { title: '', subject: '', grade: '高一', teacherId: '', duration: '45 分钟', description: '' }; }
async function loadLookups(options = {}) { teachers.value = (await listAdminTeachers({ status: 'active', pageSize: 100 }, options)).data; }
async function loadRows(options = {}) {
  loading.value = true; error.value = '';
  try { const result = await listAdminCourses({ keyword: keyword.value, status: status.value, subject: subject.value, grade: grade.value, page: pagination.value.page, pageSize: pagination.value.pageSize }, options); rows.value = result.data; pagination.value = result.pagination; }
  catch (err) { error.value = err.message || '课程列表加载失败'; } finally { loading.value = false; }
}
async function initialize(options = {}) { try { await Promise.all([loadLookups(options), loadRows(options)]); } catch (err) { error.value = err.message || '课程管理数据加载失败'; loading.value = false; } }
function search() { pagination.value.page = 1; loadRows({ force: true }); }
function changePage(page) { pagination.value.page = page; loadRows({ force: true }); }
function openCreate() { resetForm(); drawerOpen.value = true; }
function openEdit(row) { editingId.value = row.id; form.value = { title: row.title, subject: row.subject, grade: row.grade, teacherId: row.teacherId || '', duration: row.duration || '45 分钟', description: row.description || '' }; drawerOpen.value = true; }
async function saveCourse() {
  saving.value = true; error.value = ''; notice.value = '';
  try { if (editingId.value) { await updateAdminCourse(editingId.value, form.value); notice.value = '课程信息已更新'; } else { await createAdminCourse(form.value); notice.value = '课程已创建'; } drawerOpen.value = false; resetForm(); await loadRows({ force: true }); }
  catch (err) { error.value = err.message || '课程保存失败'; } finally { saving.value = false; }
}
async function archiveCourse() {
  if (!confirmTarget.value) return; saving.value = true; error.value = '';
  try { await archiveAdminCourse(confirmTarget.value.id); notice.value = `已停用《${confirmTarget.value.title}》`; confirmTarget.value = null; await loadRows({ force: true }); }
  catch (err) { error.value = err.message || '课程停用失败'; } finally { saving.value = false; }
}
async function restoreCourse(row) { saving.value = true; error.value = ''; try { await restoreAdminCourse(row.id); notice.value = `已恢复《${row.title}》`; await loadRows({ force: true }); } catch (err) { error.value = err.message || '课程恢复失败'; } finally { saving.value = false; } }
function handleRefresh() { initialize({ force: true }); }
onMounted(() => { initialize(); window.addEventListener('admin:refresh', handleRefresh); });
onBeforeUnmount(() => window.removeEventListener('admin:refresh', handleRefresh));
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-header"><div><h2>课程基础信息</h2><p>维护课程名称、学科、年级和任课教师。</p></div><button class="admin-button" type="button" @click="openCreate"><span class="material-symbols-outlined">add</span>新建课程</button></header>
    <p v-if="notice" class="admin-notice">{{ notice }}</p><p v-if="error && !loading" class="admin-notice is-error">{{ error }}</p>
    <section class="admin-panel">
      <form class="admin-toolbar" @submit.prevent="search"><div class="admin-filters"><label class="admin-search"><span class="material-symbols-outlined">search</span><input v-model="keyword" class="admin-input" placeholder="课程名称、学科或年级" /></label><input v-model="subject" class="admin-input" placeholder="学科" @keydown.enter="search" /><input v-model="grade" class="admin-input" placeholder="年级" @keydown.enter="search" /><select v-model="status" class="admin-select" @change="search"><option value="active">正常</option><option value="archived">已停用</option><option value="all">全部状态</option></select><button class="admin-button secondary" type="submit">查询</button></div></form>
      <AdminPageState :loading="loading" :error="error" :empty="!rows.length" empty-title="暂无课程" @retry="initialize({ force: true })">
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>课程</th><th>学科</th><th>年级</th><th>任课教师</th><th>课时</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="row in rows" :key="row.id"><td><strong>{{ row.title }}</strong><br /><small>{{ row.description || '暂无简介' }}</small></td><td>{{ row.subject }}</td><td>{{ row.grade }}</td><td>{{ row.teacher || '未指定' }}</td><td>{{ row.duration || '—' }}</td><td><AdminStatusBadge :status="row.status" /></td><td><div class="admin-table-actions"><button class="admin-button text" type="button" @click="openEdit(row)">编辑</button><button v-if="row.status === 'active'" class="admin-button text" type="button" @click="confirmTarget = row">停用</button><button v-else class="admin-button text" type="button" :disabled="saving" @click="restoreCourse(row)">恢复</button></div></td></tr>
        </tbody></table></div>
      </AdminPageState><AdminPagination v-if="!loading" v-bind="pagination" @change="changePage" />
    </section>
    <AdminResourceDrawer :open="drawerOpen" :busy="saving" :title="editingId ? '编辑课程' : '新建课程'" description="这里只维护课程基础信息，不修改已经生成的教学内容。" @close="drawerOpen = false">
      <form id="course-admin-form" class="admin-form" @submit.prevent="saveCourse"><div class="admin-form-grid"><div class="admin-field full"><label>课程名称</label><input v-model="form.title" class="admin-input" required /></div><div class="admin-field"><label>学科</label><input v-model="form.subject" class="admin-input" required /></div><div class="admin-field"><label>年级</label><input v-model="form.grade" class="admin-input" required /></div><div class="admin-field"><label>任课教师</label><select v-model="form.teacherId" class="admin-select"><option value="">暂不指定</option><option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.name }}</option></select></div><div class="admin-field"><label>课时长度</label><input v-model="form.duration" class="admin-input" /></div><div class="admin-field full"><label>课程简介</label><textarea v-model="form.description" class="admin-textarea" /></div></div></form>
      <template #footer><button class="admin-button secondary" type="button" @click="drawerOpen = false">取消</button><button class="admin-button" type="submit" form="course-admin-form" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button></template>
    </AdminResourceDrawer>
    <AdminConfirmDialog :open="Boolean(confirmTarget)" :busy="saving" title="停用课程" :message="`停用《${confirmTarget?.title || '该课程'}》后不能继续分配，但课件、题目、答题和分析数据都会保留。`" confirm-text="确认停用" @close="confirmTarget = null" @confirm="archiveCourse" />
  </section>
</template>

<style scoped>.admin-table small { display: inline-block; max-width: 26rem; overflow: hidden; color: var(--admin-muted); text-overflow: ellipsis; white-space: nowrap; }</style>
