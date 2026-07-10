<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { logout } from '../../data/authApiClient';
import { getStudentCourseGroups } from '../../data/studentApiClient';

const DEFAULT_STUDENT_ID = 'stu-chenyu';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const student = ref(null);
const courses = ref([]);

const studentId = computed(() => route.query.studentId || DEFAULT_STUDENT_ID);
const pendingCount = computed(() => courses.value.reduce((sum, course) => sum + Number(course.pendingTaskCount || 0), 0));
const totalTasks = computed(() => courses.value.reduce((sum, course) => sum + Number(course.taskCount || 0), 0));
const completedTasks = computed(() => Math.max(totalTasks.value - pendingCount.value, 0));
const profileName = computed(() => student.value?.name || '未识别学生');
const profileClass = computed(() => student.value?.className || '未分班');
const profileNo = computed(() => student.value?.studentNo || studentId.value);
const profileGradeSubject = computed(() => {
  const grade = student.value?.grade || '年级';
  const subject = student.value?.subject || '学科';
  return `${grade} · ${subject}`;
});

function openCourse(course) {
  router.push({
    path: `/student/courses/${course.id}`,
    query: { studentId: studentId.value }
  });
}

function handleLogout() {
  logout();
  router.replace('/student/login');
}

function openAnalysis() {
  router.push({ path: '/student/analysis', query: { studentId: studentId.value } });
}

async function loadDashboard() {
  loading.value = true;
  error.value = '';
  try {
    const dashboard = await getStudentCourseGroups(studentId.value);
    student.value = dashboard.student || null;
    courses.value = dashboard.courses || [];
  } catch (err) {
    error.value = err.message || '课程加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <main class="student-shell">
    <section class="student-dashboard">
      <article class="profile-panel">
        <div class="profile-topline">
          <span class="small-chip">学生档案</span>
          <button type="button" class="logout-btn" @click="handleLogout">
            <span class="material-symbols-outlined">logout</span>
            退出登录
          </button>
        </div>
        <div class="profile-heading">
          <div class="profile-avatar">{{ profileName.slice(0, 1) }}</div>
          <div>
            <h1>{{ profileName }}</h1>
            <p>{{ profileNo }}</p>
          </div>
        </div>
        <dl class="profile-meta">
          <div>
            <dt>所在班级</dt>
            <dd>{{ profileClass }}</dd>
          </div>
          <div>
            <dt>年级学科</dt>
            <dd>{{ profileGradeSubject }}</dd>
          </div>
          <div>
            <dt>已分配课程</dt>
            <dd>{{ courses.length }} 门</dd>
          </div>
        </dl>
      </article>

      <article class="overview-panel">
        <div>
          <span class="small-chip">我的课程</span>
          <h2>今天要完成的学习任务</h2>
          <p>进入课程后可以完成选择题和填空题，也可以在答题页向 AI 学习助手提问。</p>
        </div>
        <div class="student-summary">
          <article>
            <strong>{{ courses.length }}</strong>
            <span>课程</span>
          </article>
          <article>
            <strong>{{ pendingCount }}</strong>
            <span>待完成</span>
          </article>
          <article>
            <strong>{{ completedTasks }}</strong>
            <span>已完成任务</span>
          </article>
        </div>
      </article>

      <article class="analysis-panel">
        <div>
          <span class="small-chip">学情分析</span>
          <h2>根据答题数据完善学习画像</h2>
          <p>查看不同课程的答题表现、薄弱知识点和 AI 学生画像，后续会用于生成个性化练习。</p>
        </div>
        <dl class="analysis-meta">
          <div>
            <dt>累计答题</dt>
            <dd>{{ courses.reduce((sum, course) => sum + Number(course.answeredQuestionCount || 0), 0) }} 道</dd>
          </div>
          <div>
            <dt>覆盖课程</dt>
            <dd>{{ courses.length }} 门</dd>
          </div>
        </dl>
        <button type="button" @click="openAnalysis">
          进入学情分析
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </article>
    </section>

    <section v-if="error" class="student-empty">
      <span class="material-symbols-outlined">error</span>
      <strong>{{ error }}</strong>
      <button type="button" @click="loadDashboard">重新加载</button>
    </section>

    <section v-else-if="!loading && !courses.length" class="student-empty">
      <span class="material-symbols-outlined">school</span>
      <strong>暂时没有已分配课程</strong>
      <p>课程由教务处或老师统一分配，分配后会出现在这里。</p>
    </section>

    <section v-else class="student-course-grid">
      <article v-for="course in courses" :key="course.id" class="student-course-card">
        <header>
          <span>{{ course.subject }} · {{ course.grade }}</span>
          <em>{{ course.source === 'joined' ? '个人分配' : '班级课程' }}</em>
        </header>
        <h2>{{ course.title }}</h2>
        <p>{{ course.description || '进入课程查看练习任务。' }}</p>
        <dl class="course-meta">
          <div>
            <dt>任课老师</dt>
            <dd>{{ course.teacher || '任课老师' }}</dd>
          </div>
          <div>
            <dt>任务状态</dt>
            <dd>{{ course.pendingTaskCount ? `${course.pendingTaskCount} 个待完成` : '全部完成' }}</dd>
          </div>
        </dl>
        <div class="course-progress" aria-label="课程进度">
          <span :style="{ width: `${course.progress || 0}%` }"></span>
        </div>
        <footer>
          <div>
            <strong>{{ course.progress || 0 }}%</strong>
            <span>{{ course.taskCount || 0 }} 个任务</span>
          </div>
          <button type="button" @click="openCourse(course)">
            进入课程
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </footer>
      </article>
      <article v-if="loading" class="student-course-card loading-card">
        <h2>正在加载课程</h2>
        <p>请稍候。</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.student-shell {
  width: 100%;
  height: 100vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  background:
    radial-gradient(circle at 8% 8%, rgba(81, 201, 135, .22), transparent 30%),
    var(--wash);
  color: var(--ink);
  padding: 18px 18px 48px;
}

.student-dashboard,
.student-course-grid {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.student-dashboard {
  display: grid;
  gap: 14px;
  padding: 18px 0 16px;
}

.profile-panel,
.overview-panel,
.analysis-panel,
.student-course-card,
.student-empty {
  border: 1px solid rgba(255, 255, 255, .78);
  background: rgba(255, 255, 255, .72);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.profile-panel,
.overview-panel,
.analysis-panel {
  border-radius: 16px;
  padding: 18px;
}

.profile-topline,
.student-course-card header,
.student-course-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.logout-btn {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: 9px;
  background: rgba(16, 55, 35, .08);
  color: var(--deep);
  padding: 0 10px;
  font-size: 13px;
  font-weight: 800;
}

.logout-btn .material-symbols-outlined {
  font-size: 18px;
}

.profile-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
}

.profile-avatar {
  display: grid;
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 16px;
  background: var(--deep);
  color: #80f3a8;
  font-size: 30px;
  font-weight: 900;
}

.profile-heading h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 34px;
  line-height: 1.15;
}

.profile-heading p,
.student-summary span,
.student-course-card header span,
.student-course-card p,
.student-course-card footer span,
.overview-panel p {
  color: var(--muted);
}

.profile-heading p {
  margin: 6px 0 0;
  font-size: 16px;
}

.profile-meta,
.course-meta {
  display: grid;
  gap: 14px;
  margin: 18px 0 0;
}

.profile-meta dt,
.course-meta dt {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.profile-meta dd,
.course-meta dd {
  margin: 4px 0 0;
  font-weight: 800;
}

.overview-panel,
.analysis-panel {
  display: grid;
  align-content: space-between;
  gap: 18px;
}

.overview-panel h2,
.analysis-panel h2 {
  margin: 12px 0 0;
  font-size: 24px;
}

.overview-panel p,
.analysis-panel p {
  margin: 8px 0 0;
  line-height: 1.6;
}

.student-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.student-summary article {
  min-height: 84px;
  border-radius: 14px;
  background: rgba(255, 255, 255, .58);
  padding: 14px;
}

.student-summary strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 28px;
}

.student-course-card button,
.student-empty button,
.analysis-panel button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  background: var(--deep);
  color: #80f3a8;
  padding: 0 16px;
  font-weight: 700;
}

.analysis-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.analysis-meta div {
  border-radius: 12px;
  background: rgba(255, 255, 255, .58);
  padding: 12px;
}

.analysis-meta dt {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.analysis-meta dd {
  margin: 5px 0 0;
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 900;
}

.student-course-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  padding: 16px 0 28px;
}

.student-course-card {
  min-height: 280px;
  border-radius: 16px;
  padding: 18px;
}

.student-course-card header em {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  background: var(--mint);
  color: var(--green);
  padding: 0 10px;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.student-course-card h2 {
  margin-top: 18px;
  font-size: 24px;
}

.student-course-card p {
  min-height: 46px;
  margin-top: 10px;
  line-height: 1.65;
}

.course-meta {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.course-progress {
  height: 8px;
  margin: 18px 0;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(16, 55, 35, .08);
}

.course-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--teal));
}

.student-course-card footer strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 20px;
}

.student-empty {
  display: grid;
  width: min(680px, calc(100% - 36px));
  min-height: 220px;
  place-items: center;
  gap: 10px;
  margin: 30px auto;
  border-radius: 16px;
  padding: 28px;
  text-align: center;
}

.student-empty .material-symbols-outlined {
  color: var(--green);
  font-size: 36px;
}

@media (min-width: 768px) {
  .student-shell {
    padding: 28px;
  }

  .student-dashboard {
    grid-template-columns: 1fr 1.3fr;
    padding-top: 28px;
  }

  .student-course-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}

@media (min-width: 1080px) {
  .student-dashboard {
    grid-template-columns: 320px minmax(0, 1fr) 360px;
    align-items: stretch;
  }

  .student-course-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .profile-topline,
  .student-course-card footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
