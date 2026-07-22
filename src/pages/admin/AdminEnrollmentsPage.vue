<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AdminPageState from '../../components/admin/AdminPageState.vue';
import AdminPagination from '../../components/admin/AdminPagination.vue';
import AdminResourceDrawer from '../../components/admin/AdminResourceDrawer.vue';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge.vue';
import {
  assignStudentCourse,
  getStudentEnrollments,
  listAdminClasses,
  listAdminCourses,
  listAdminStudents,
  removeStudentCourse
} from '../../data/adminApiClient';

const students = ref([]);
const classes = ref([]);
const courses = ref([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const keyword = ref('');
const classId = ref('');
const loading = ref(true);
const detailLoading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const drawerOpen = ref(false);
const selectedStudent = ref(null);
const enrollmentDetail = ref(null);

const assignedCourseIds = computed(() => new Set([
  ...(enrollmentDetail.value?.classCourses || []).map((item) => item.courseId),
  ...(enrollmentDetail.value?.enrollments || []).map((item) => item.courseId)
]));
const availableCourses = computed(() => courses.value.filter((course) => course.status === 'active' && !assignedCourseIds.value.has(course.id)));

async function loadLookups(options = {}) {
  const [classList, courseList] = await Promise.all([
    listAdminClasses({ status: 'active', pageSize: 100 }, options),
    listAdminCourses({ status: 'active', pageSize: 100 }, options)
  ]);
  classes.value = classList.data;
  courses.value = courseList.data;
}

async function loadStudents(options = {}) {
  loading.value = true; error.value = '';
  try {
    const result = await listAdminStudents({ keyword: keyword.value, classId: classId.value, status: 'active', page: pagination.value.page, pageSize: pagination.value.pageSize }, options);
    students.value = result.data;
    pagination.value = result.pagination;
  } catch (err) { error.value = err.message || '学生列表加载失败'; }
  finally { loading.value = false; }
}

async function initialize(options = {}) {
  try { await Promise.all([loadLookups(options), loadStudents(options)]); }
  catch (err) { error.value = err.message || '课程分配数据加载失败'; loading.value = false; }
}

function search() { pagination.value.page = 1; loadStudents({ force: true }); }
function changePage(page) { pagination.value.page = page; loadStudents({ force: true }); }

async function openStudent(row) {
  selectedStudent.value = row;
  drawerOpen.value = true;
  detailLoading.value = true;
  error.value = '';
  try { enrollmentDetail.value = await getStudentEnrollments(row.id, { force: true }); }
  catch (err) { error.value = err.message || '学生课程加载失败'; }
  finally { detailLoading.value = false; }
}

async function refreshDetail() {
  if (!selectedStudent.value) return;
  enrollmentDetail.value = await getStudentEnrollments(selectedStudent.value.id, { force: true });
}

async function assignCourse(course) {
  if (!selectedStudent.value) return;
  saving.value = true; error.value = ''; notice.value = '';
  try { await assignStudentCourse(selectedStudent.value.id, course.id); notice.value = `已给 ${selectedStudent.value.name} 分配《${course.title}》`; await refreshDetail(); }
  catch (err) { error.value = err.message || '课程分配失败'; }
  finally { saving.value = false; }
}

async function removeCourse(course) {
  if (!selectedStudent.value) return;
  saving.value = true; error.value = ''; notice.value = '';
  try { await removeStudentCourse(selectedStudent.value.id, course.id); notice.value = `已从 ${selectedStudent.value.name} 移除《${course.title}》`; await refreshDetail(); }
  catch (err) { error.value = err.message || '课程移除失败'; }
  finally { saving.value = false; }
}

function closeDrawer() { drawerOpen.value = false; selectedStudent.value = null; enrollmentDetail.value = null; }
function handleRefresh() { initialize({ force: true }); if (selectedStudent.value) refreshDetail(); }
onMounted(() => { initialize(); window.addEventListener('admin:refresh', handleRefresh); });
onBeforeUnmount(() => window.removeEventListener('admin:refresh', handleRefresh));
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-header"><div><h2>学生课程分配</h2><p>从学生列表进入详情，查看班级课程并维护个人课程。</p></div></header>
    <p v-if="notice" class="admin-notice">{{ notice }}</p><p v-if="error && !loading" class="admin-notice is-error">{{ error }}</p>
    <section class="admin-panel">
      <form class="admin-toolbar" @submit.prevent="search"><div class="admin-filters"><label class="admin-search"><span class="material-symbols-outlined">search</span><input v-model="keyword" class="admin-input" placeholder="姓名、学号或账号" /></label><select v-model="classId" class="admin-select" @change="search"><option value="">全部班级</option><option v-for="item in classes" :key="item.id" :value="item.id">{{ item.name }}</option></select><button class="admin-button secondary" type="submit">查询</button></div></form>
      <AdminPageState :loading="loading" :error="error" :empty="!students.length" empty-title="暂无可分配学生" @retry="initialize({ force: true })">
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>学生</th><th>学号</th><th>班级</th><th>练习次数</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="row in students" :key="row.id"><td><strong>{{ row.name }}</strong></td><td>{{ row.studentNo || '—' }}</td><td>{{ row.className }}</td><td>{{ row.practiceCount || 0 }}</td><td><AdminStatusBadge :status="row.status" /></td><td><div class="admin-table-actions"><button class="admin-button text" type="button" @click="openStudent(row)">管理课程</button></div></td></tr>
        </tbody></table></div>
      </AdminPageState><AdminPagination v-if="!loading" v-bind="pagination" @change="changePage" />
    </section>

    <AdminResourceDrawer :open="drawerOpen" :busy="saving" :title="`${selectedStudent?.name || '学生'}的课程`" :description="selectedStudent?.className || ''" @close="closeDrawer">
      <AdminPageState :loading="detailLoading" :error="error" :empty="false" @retry="refreshDetail">
        <div class="admin-enrollment-sections">
          <section><header><div><h3>班级课程</h3><p>由班级课堂统一发布，不能在这里移除。</p></div><span>{{ enrollmentDetail?.classCourses?.length || 0 }}</span></header><div class="admin-course-list">
            <article v-for="item in enrollmentDetail?.classCourses || []" :key="item.id" class="admin-course-item"><div><strong>{{ item.course?.title }}</strong><span>{{ item.course?.subject }} · {{ item.course?.grade }} · {{ item.course?.teacher }}</span></div><em>班级分配</em></article><p v-if="!(enrollmentDetail?.classCourses || []).length" class="admin-empty-line">暂无班级课程</p>
          </div></section>
          <section><header><div><h3>个人课程</h3><p>由教务单独分配给该学生。</p></div><span>{{ enrollmentDetail?.enrollments?.length || 0 }}</span></header><div class="admin-course-list">
            <article v-for="item in enrollmentDetail?.enrollments || []" :key="item.id" class="admin-course-item"><div><strong>{{ item.course?.title }}</strong><span>{{ item.course?.subject }} · {{ item.course?.grade }} · {{ item.course?.teacher }}</span></div><button class="admin-button text" type="button" :disabled="saving" @click="removeCourse(item.course)">移除</button></article><p v-if="!(enrollmentDetail?.enrollments || []).length" class="admin-empty-line">暂无个人课程</p>
          </div></section>
          <section><header><div><h3>可分配课程</h3><p>仅显示正常且尚未加入的课程。</p></div><span>{{ availableCourses.length }}</span></header><div class="admin-course-list available">
            <article v-for="course in availableCourses" :key="course.id" class="admin-course-item"><div><strong>{{ course.title }}</strong><span>{{ course.subject }} · {{ course.grade }} · {{ course.teacher || '未指定教师' }}</span></div><button class="admin-button secondary" type="button" :disabled="saving" @click="assignCourse(course)">分配</button></article><p v-if="!availableCourses.length" class="admin-empty-line">没有其他可分配课程</p>
          </div></section>
        </div>
      </AdminPageState>
    </AdminResourceDrawer>
  </section>
</template>

<style scoped>
.admin-enrollment-sections { display: grid; gap: 1.5rem; }
.admin-enrollment-sections section { display: grid; gap: .75rem; }
.admin-enrollment-sections section > header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
.admin-enrollment-sections h3 { margin: 0; font-size: .9375rem; }
.admin-enrollment-sections header p { margin: .25rem 0 0; color: var(--admin-muted); font-size: .75rem; }
.admin-enrollment-sections header > span { color: var(--admin-muted); font-size: .75rem; }
.admin-course-list { display: grid; gap: .5rem; }
.admin-course-list.available { max-height: 22rem; overflow-y: auto; }
.admin-course-item { display: flex; min-height: 4rem; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid var(--admin-border); border-radius: .5rem; padding: .75rem; }
.admin-course-item div { display: grid; min-width: 0; gap: .25rem; }
.admin-course-item strong, .admin-course-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-course-item strong { font-size: .8125rem; }.admin-course-item span { color: var(--admin-muted); font-size: .75rem; }.admin-course-item em { color: var(--admin-accent); font-size: .75rem; font-style: normal; }
.admin-empty-line { margin: 0; border: 1px dashed var(--admin-border); border-radius: .5rem; color: var(--admin-muted); padding: 1rem; font-size: .8125rem; text-align: center; }
</style>
