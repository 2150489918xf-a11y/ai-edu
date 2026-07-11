<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { logout } from '../../data/authApiClient';
import {
  archiveAdminTeacher,
  assignStudentCourse,
  createAdminTeacher,
  getAdminSummary,
  getStudentEnrollments,
  listAdminClasses,
  listAdminCourses,
  listAdminStudents,
  listAdminTeachers,
  removeStudentCourse,
  updateAdminTeacher
} from '../../data/adminApiClient';

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const summary = ref({});
const teachers = ref([]);
const classes = ref([]);
const students = ref([]);
const courses = ref([]);
const selectedStudentId = ref('');
const enrollmentDetail = ref(null);
const teacherKeyword = ref('');
const studentKeyword = ref('');
const classFilter = ref('');
const editingTeacherId = ref('');
const teacherForm = ref({
  name: '',
  username: '',
  password: 'teacher123',
  phone: '',
  email: ''
});

const selectedStudent = computed(() => students.value.find((student) => student.id === selectedStudentId.value) || null);
const assignedCourseIds = computed(() => new Set([
  ...(enrollmentDetail.value?.classCourses || []).map((item) => item.courseId),
  ...(enrollmentDetail.value?.enrollments || []).map((item) => item.courseId)
]));
const availableCourses = computed(() => courses.value.filter((course) => !assignedCourseIds.value.has(course.id)));
const summaryItems = computed(() => [
  { label: '教师', value: summary.value.teacherCount || 0, icon: 'co_present' },
  { label: '班级', value: summary.value.classCount || 0, icon: 'groups' },
  { label: '学生', value: summary.value.studentCount || 0, icon: 'school' },
  { label: '课程', value: summary.value.courseCount || 0, icon: 'menu_book' },
  { label: '个人分配', value: summary.value.enrollmentCount || 0, icon: 'rule' }
]);

function resetTeacherForm() {
  editingTeacherId.value = '';
  teacherForm.value = {
    name: '',
    username: '',
    password: 'teacher123',
    phone: '',
    email: ''
  };
}

function editTeacher(teacher) {
  editingTeacherId.value = teacher.id;
  teacherForm.value = {
    name: teacher.name,
    username: teacher.username,
    password: '',
    phone: teacher.phone || '',
    email: teacher.email || ''
  };
}

async function loadBaseData(options = {}) {
  loading.value = true;
  error.value = '';
  try {
    const [summaryData, teacherList, classList, studentList, courseList] = await Promise.all([
      getAdminSummary(options),
      listAdminTeachers({ status: 'active', keyword: teacherKeyword.value, pageSize: 50 }, options),
      listAdminClasses({ status: 'active', pageSize: 80 }, options),
      listAdminStudents({ status: 'active', keyword: studentKeyword.value, classId: classFilter.value, pageSize: 80 }, options),
      listAdminCourses({ status: 'active', pageSize: 100 }, options)
    ]);
    summary.value = summaryData;
    teachers.value = teacherList.data;
    classes.value = classList.data;
    students.value = studentList.data;
    courses.value = courseList.data;
    if (!selectedStudentId.value && students.value.length) {
      selectedStudentId.value = students.value[0].id;
    }
    if (selectedStudentId.value) {
      await loadStudentEnrollments(selectedStudentId.value, options);
    }
  } catch (err) {
    error.value = err.message || '教务数据加载失败';
  } finally {
    loading.value = false;
  }
}

async function loadStudentEnrollments(studentId, options = {}) {
  if (!studentId) return;
  selectedStudentId.value = studentId;
  enrollmentDetail.value = await getStudentEnrollments(studentId, options);
}

async function saveTeacher() {
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    if (editingTeacherId.value) {
      await updateAdminTeacher(editingTeacherId.value, {
        name: teacherForm.value.name,
        phone: teacherForm.value.phone,
        email: teacherForm.value.email
      });
      notice.value = '教师信息已更新';
    } else {
      await createAdminTeacher(teacherForm.value);
      notice.value = '教师账号已创建';
    }
    resetTeacherForm();
    await loadBaseData({ force: true });
  } catch (err) {
    error.value = err.message || '教师保存失败';
  } finally {
    saving.value = false;
  }
}

async function archiveTeacher(teacher) {
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    await archiveAdminTeacher(teacher.id);
    notice.value = `已停用 ${teacher.name}`;
    await loadBaseData({ force: true });
  } catch (err) {
    error.value = err.message || '教师停用失败';
  } finally {
    saving.value = false;
  }
}

async function assignCourse(course) {
  if (!selectedStudentId.value) return;
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    await assignStudentCourse(selectedStudentId.value, course.id);
    notice.value = `已给 ${selectedStudent.value?.name || '学生'} 分配《${course.title}》`;
    await loadBaseData({ force: true });
  } catch (err) {
    error.value = err.message || '课程分配失败';
  } finally {
    saving.value = false;
  }
}

async function removeCourse(course) {
  if (!selectedStudentId.value) return;
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    await removeStudentCourse(selectedStudentId.value, course.id);
    notice.value = `已移除《${course.title}》`;
    await loadBaseData({ force: true });
  } catch (err) {
    error.value = err.message || '课程移除失败';
  } finally {
    saving.value = false;
  }
}

function handleLogout() {
  logout();
  router.replace('/admin/login');
}

onMounted(loadBaseData);
</script>

<template>
  <main class="admin-shell">
    <header class="admin-topbar">
      <div>
        <span class="small-chip">教务处</span>
        <h1>教学组织管理台</h1>
        <p>独立管理教师、班级、学生与课程分配，不接入教师端和学生端导航。</p>
      </div>
      <div class="topbar-actions">
        <button type="button" :disabled="loading" @click="loadBaseData({ force: true })">
          <span class="material-symbols-outlined">refresh</span>
          刷新
        </button>
        <button type="button" class="logout-btn" @click="handleLogout">
          <span class="material-symbols-outlined">logout</span>
          退出登录
        </button>
      </div>
    </header>

    <section class="summary-strip" aria-label="教务统计">
      <article v-for="item in summaryItems" :key="item.label">
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <div>
          <strong>{{ item.value }}</strong>
          <small>{{ item.label }}</small>
        </div>
      </article>
    </section>

    <p v-if="error" class="admin-alert error">{{ error }}</p>
    <p v-else-if="notice" class="admin-alert success">{{ notice }}</p>

    <section class="admin-layout">
      <div class="left-stack">
        <section class="admin-panel teacher-panel">
          <header>
            <div>
              <span class="small-chip">教师管理</span>
              <h2>教师账号与任教关系</h2>
            </div>
            <label class="search-box">
              <span class="material-symbols-outlined">search</span>
              <input v-model="teacherKeyword" placeholder="搜索教师" @keydown.enter="loadBaseData({ force: true })" />
            </label>
          </header>

          <form class="teacher-form" @submit.prevent="saveTeacher">
            <input v-model="teacherForm.name" placeholder="教师姓名" required />
            <input v-model="teacherForm.username" :disabled="Boolean(editingTeacherId)" placeholder="登录账号" required />
            <input v-if="!editingTeacherId" v-model="teacherForm.password" placeholder="初始密码" />
            <input v-model="teacherForm.phone" placeholder="手机号" />
            <input v-model="teacherForm.email" placeholder="邮箱" />
            <div class="form-actions">
              <button type="submit" :disabled="saving">
                <span class="material-symbols-outlined">{{ editingTeacherId ? 'save' : 'add' }}</span>
                {{ editingTeacherId ? '保存' : '新增教师' }}
              </button>
              <button v-if="editingTeacherId" type="button" class="ghost-btn" @click="resetTeacherForm">取消</button>
            </div>
          </form>

          <div class="teacher-list">
            <article v-for="teacher in teachers" :key="teacher.id" class="teacher-row">
              <div>
                <strong>{{ teacher.name }}</strong>
                <span>{{ teacher.username }} · {{ teacher.phone || '未填手机号' }}</span>
              </div>
              <em>{{ teacher.classCount }} 班 · {{ teacher.courseCount }} 课</em>
              <div class="row-actions">
                <button type="button" class="icon-btn" title="编辑教师" @click="editTeacher(teacher)">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <button type="button" class="icon-btn danger" title="停用教师" @click="archiveTeacher(teacher)">
                  <span class="material-symbols-outlined">person_off</span>
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="admin-panel roster-panel">
          <header>
            <div>
              <span class="small-chip">学生管理</span>
              <h2>选择学生后分配课程</h2>
            </div>
            <div class="filter-group">
              <select v-model="classFilter" @change="loadBaseData({ force: true })">
                <option value="">全部班级</option>
                <option v-for="item in classes" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select>
              <label class="search-box">
                <span class="material-symbols-outlined">search</span>
                <input v-model="studentKeyword" placeholder="搜索学生" @keydown.enter="loadBaseData({ force: true })" />
              </label>
            </div>
          </header>

          <div class="student-table">
            <button
              v-for="student in students"
              :key="student.id"
              type="button"
              class="student-row"
              :class="{ active: student.id === selectedStudentId }"
              @click="loadStudentEnrollments(student.id, { force: true })"
            >
              <strong>{{ student.name }}</strong>
              <span>{{ student.className }} · {{ student.studentNo || student.id }}</span>
              <em>{{ student.status }}</em>
            </button>
          </div>
        </section>
      </div>

      <aside class="admin-panel assignment-panel">
        <header>
          <div>
            <span class="small-chip">课程分配</span>
            <h2>{{ selectedStudent?.name || '选择学生' }}</h2>
            <p>{{ selectedStudent?.className || '从左侧学生列表中选择一个学生' }}</p>
          </div>
        </header>

        <div class="assignment-section">
          <h3>班级课程</h3>
          <article v-for="item in enrollmentDetail?.classCourses || []" :key="item.id" class="course-row locked">
            <div>
              <strong>{{ item.course?.title }}</strong>
              <span>{{ item.course?.subject }} · {{ item.course?.grade }} · {{ item.course?.teacher }}</span>
            </div>
            <em>班级分配</em>
          </article>
          <p v-if="!(enrollmentDetail?.classCourses || []).length" class="empty-text">当前班级暂未发布课程。</p>
        </div>

        <div class="assignment-section">
          <h3>个人分配</h3>
          <article v-for="item in enrollmentDetail?.enrollments || []" :key="item.id" class="course-row">
            <div>
              <strong>{{ item.course?.title }}</strong>
              <span>{{ item.course?.subject }} · {{ item.course?.grade }} · {{ item.course?.teacher }}</span>
            </div>
            <button type="button" class="icon-btn danger" :disabled="saving" title="移除课程" @click="removeCourse(item.course)">
              <span class="material-symbols-outlined">remove_circle</span>
            </button>
          </article>
          <p v-if="!(enrollmentDetail?.enrollments || []).length" class="empty-text">暂无单独分配课程。</p>
        </div>

        <div class="assignment-section">
          <h3>可分配课程</h3>
          <div class="available-list">
            <article v-for="course in availableCourses" :key="course.id" class="course-row">
              <div>
                <strong>{{ course.title }}</strong>
                <span>{{ course.subject }} · {{ course.grade }}</span>
              </div>
              <button type="button" :disabled="saving || !selectedStudentId" @click="assignCourse(course)">
                <span class="material-symbols-outlined">add</span>
                分配
              </button>
            </article>
          </div>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.admin-shell {
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  background:
    radial-gradient(circle at 9% 9%, rgba(81, 201, 135, .2), transparent 30%),
    radial-gradient(circle at 96% 8%, rgba(71, 126, 231, .14), transparent 28%),
    var(--wash);
  color: var(--ink);
  padding: 20px;
}

.admin-topbar,
.summary-strip,
.admin-layout {
  width: min(1360px, 100%);
  margin: 0 auto;
}

.admin-topbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding: 8px 0 16px;
}

.admin-topbar h1 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 34px;
  line-height: 1.15;
}

.admin-topbar p,
.assignment-panel header p,
.teacher-row span,
.student-row span,
.course-row span,
.empty-text {
  color: var(--muted);
}

.admin-topbar p {
  margin-top: 8px;
  line-height: 1.6;
}

.topbar-actions,
.form-actions,
.row-actions,
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-actions button,
.teacher-form button,
.course-row button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  background: var(--deep);
  color: #80f3a8;
  padding: 0 14px;
  font-weight: 800;
}

.topbar-actions .logout-btn,
.teacher-form .ghost-btn {
  background: rgba(16, 55, 35, .08);
  color: var(--deep);
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.summary-strip article,
.admin-panel,
.admin-alert {
  border: 1px solid rgba(255, 255, 255, .78);
  background: rgba(255, 255, 255, .74);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.summary-strip article {
  display: flex;
  min-height: 82px;
  align-items: center;
  gap: 12px;
  border-radius: 14px;
  padding: 14px;
}

.summary-strip .material-symbols-outlined {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
  background: var(--mint);
  color: var(--green);
}

.summary-strip strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 24px;
}

.summary-strip small {
  color: var(--muted);
  font-weight: 800;
}

.admin-alert {
  width: min(1360px, 100%);
  margin: 12px auto 0;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 800;
}

.admin-alert.error {
  color: #b42318;
}

.admin-alert.success {
  color: var(--green);
}

.admin-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, .75fr);
  gap: 14px;
  padding: 14px 0 36px;
}

.left-stack {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.admin-panel {
  min-width: 0;
  border-radius: 16px;
  padding: 16px;
}

.admin-panel header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.admin-panel h2 {
  margin-top: 8px;
  font-size: 22px;
}

.search-box {
  display: inline-flex;
  min-width: 220px;
  min-height: 40px;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(16, 55, 35, .12);
  border-radius: 10px;
  background: rgba(255, 255, 255, .76);
  padding: 0 10px;
}

.search-box input,
.teacher-form input,
.filter-group select {
  border: 0;
  background: transparent;
  color: var(--ink);
  outline: none;
}

.search-box input {
  width: 100%;
}

.teacher-form {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)) auto;
  gap: 8px;
  margin-top: 14px;
}

.teacher-form input,
.filter-group select {
  min-height: 40px;
  border: 1px solid rgba(16, 55, 35, .12);
  border-radius: 10px;
  background: rgba(255, 255, 255, .76);
  padding: 0 10px;
}

.teacher-list {
  display: grid;
  max-height: 290px;
  overflow-y: auto;
  gap: 8px;
  margin-top: 14px;
  padding-right: 2px;
}

.teacher-row,
.course-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(16, 55, 35, .08);
  border-radius: 12px;
  background: rgba(255, 255, 255, .58);
  padding: 10px;
}

.teacher-row div,
.course-row div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.teacher-row strong,
.teacher-row span,
.course-row strong,
.course-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teacher-row em,
.course-row em,
.student-row em {
  color: var(--green);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
}

.icon-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: rgba(16, 55, 35, .08);
  color: var(--deep);
}

.icon-btn.danger {
  color: #b42318;
}

.student-table {
  display: grid;
  max-height: 390px;
  overflow-y: auto;
  gap: 8px;
  margin-top: 14px;
  padding-right: 2px;
}

.student-row {
  display: grid;
  grid-template-columns: minmax(100px, .7fr) minmax(0, 1fr) auto;
  min-height: 50px;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(16, 55, 35, .08);
  border-radius: 12px;
  background: rgba(255, 255, 255, .58);
  padding: 0 12px;
  text-align: left;
}

.student-row.active {
  border-color: rgba(47, 172, 102, .38);
  background: var(--mint);
}

.assignment-panel {
  position: sticky;
  top: 14px;
  align-self: start;
  max-height: calc(100vh - 42px);
  overflow-y: auto;
}

.assignment-panel header {
  border-bottom: 1px solid rgba(16, 55, 35, .08);
  padding-bottom: 14px;
}

.assignment-section {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.assignment-section h3 {
  margin: 0;
  font-size: 15px;
}

.course-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.course-row.locked {
  background: rgba(220, 246, 232, .58);
}

.available-list {
  display: grid;
  max-height: 360px;
  overflow-y: auto;
  gap: 8px;
  padding-right: 2px;
}

.empty-text {
  border: 1px dashed rgba(16, 55, 35, .16);
  border-radius: 12px;
  padding: 14px;
  text-align: center;
}

@media (max-width: 1080px) {
  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-layout {
    grid-template-columns: 1fr;
  }

  .assignment-panel {
    position: static;
    max-height: none;
  }

  .teacher-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .admin-topbar,
  .admin-panel header,
  .filter-group {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-strip,
  .teacher-form {
    grid-template-columns: 1fr;
  }

  .teacher-row,
  .student-row {
    grid-template-columns: 1fr;
  }

  .search-box {
    min-width: 0;
    width: 100%;
  }
}
</style>
