<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getStudentCourseGroup } from '../../data/studentApiClient';

const DEFAULT_STUDENT_ID = 'stu-chenyu';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const course = ref(null);

const studentId = computed(() => route.query.studentId || DEFAULT_STUDENT_ID);
const courseId = computed(() => route.params.courseId);
const tasks = computed(() => course.value?.tasks || []);
const units = computed(() => course.value?.units || []);
const completedTasks = computed(() => tasks.value.filter((task) => task.status === 'completed').length);

function statusLabel(status) {
  if (status === 'completed') return '已完成';
  if (status === 'in_progress') return '继续完成';
  return '未开始';
}

function openTask(task) {
  router.push({
    path: `/student/tasks/${task.id}/practice`,
    query: { studentId: studentId.value }
  });
}

async function loadCourse(options = {}) {
  loading.value = true;
  error.value = '';
  try {
    course.value = await getStudentCourseGroup(studentId.value, courseId.value, options);
  } catch (err) {
    error.value = err.message || '课程详情加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadCourse);
</script>

<template>
  <main class="student-detail-shell">
    <header class="detail-topbar">
      <button type="button" aria-label="返回课程列表" @click="router.push({ path: '/student/courses', query: { studentId } })">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <div>
        <span class="small-chip">课程详情</span>
        <h1>{{ course?.title || '课程详情' }}</h1>
        <p>{{ course?.subject || '学科' }} · {{ course?.grade || '年级' }}</p>
      </div>
      <button type="button" :disabled="loading" @click="loadCourse({ force: true })">
        <span class="material-symbols-outlined">refresh</span>
      </button>
    </header>

    <section v-if="error" class="detail-empty">
      <strong>{{ error }}</strong>
      <button type="button" @click="loadCourse({ force: true })">重新加载</button>
    </section>

    <template v-else>
      <section class="course-overview">
        <article>
          <span>课程目标</span>
          <p>{{ course?.goal || course?.description || '完成老师发布的练习，巩固本节课知识。' }}</p>
        </article>
        <article>
          <strong>{{ units.length }}</strong>
          <span>课程单元</span>
        </article>
        <article>
          <strong>{{ tasks.length }}</strong>
          <span>全部任务</span>
        </article>
      </section>

      <section class="unit-list">
        <header>
          <h2>课程单元</h2>
          <span>{{ units.length }} 个单元 · {{ completedTasks }} 个任务已完成</span>
        </header>
        <div class="unit-grid">
          <article v-for="unit in units" :key="unit.id" class="unit-card">
            <div>
              <strong>{{ unit.title }}</strong>
              <span>{{ unit.taskCount || 0 }} 个任务 · {{ unit.questionCount || 0 }} 道题</span>
            </div>
            <em>{{ unit.progress || 0 }}%</em>
          </article>
        </div>
      </section>

      <section class="task-list">
        <header>
          <h2>练习与试卷</h2>
          <span>{{ loading ? '加载中' : `${tasks.length} 个任务` }}</span>
        </header>

        <article v-for="task in tasks" :key="task.id" class="task-card">
          <div>
            <span class="task-status" :class="task.status">{{ statusLabel(task.status) }}</span>
            <h3>{{ task.title }}</h3>
            <p>{{ task.questionCount }} 道题 · 已完成 {{ task.answeredCount }} 道</p>
          </div>
          <button type="button" @click="openTask(task)">
            {{ task.status === 'completed' ? '查看练习' : '开始答题' }}
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </article>

        <section v-if="!loading && !tasks.length" class="detail-empty">
          <strong>暂时没有练习或试卷</strong>
          <p>老师发布后会显示在这里。</p>
        </section>
      </section>
    </template>
  </main>
</template>

<style scoped>
.student-detail-shell {
  width: 100%;
  height: 100vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  background:
    radial-gradient(circle at 92% 0%, rgba(81, 201, 135, .18), transparent 28%),
    var(--wash);
  color: var(--ink);
  padding: 18px 18px 52px;
}

.detail-topbar,
.course-overview,
.unit-list,
.task-list {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.detail-topbar {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  gap: 12px;
  align-items: center;
  padding: 10px 0 18px;
}

.detail-topbar h1 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 28px;
  line-height: 1.22;
}

.detail-topbar p {
  margin-top: 6px;
  color: var(--muted);
  font-size: 14px;
}

.detail-topbar button,
.task-card button,
.detail-empty button {
  display: inline-flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  background: var(--deep);
  color: #80f3a8;
  padding: 0 14px;
  font-weight: 700;
}

.course-overview {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.course-overview article,
.unit-list,
.unit-card,
.task-list,
.task-card,
.detail-empty {
  border: 1px solid rgba(255, 255, 255, .78);
  background: rgba(255, 255, 255, .74);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.course-overview article {
  min-height: 92px;
  border-radius: 16px;
  padding: 16px;
}

.course-overview article:first-child {
  display: grid;
  gap: 8px;
}

.course-overview span,
.course-overview p,
.task-list > header span,
.task-card p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.course-overview strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 30px;
}

.unit-list {
  display: grid;
  gap: 12px;
  border-radius: 16px;
  margin-bottom: 16px;
  padding: 14px;
}

.unit-list header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.unit-list h2 {
  font-size: 18px;
}

.unit-list header span,
.unit-card span {
  color: var(--muted);
  font-size: 13px;
}

.unit-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.unit-card {
  display: flex;
  min-height: 78px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 14px;
  padding: 14px;
}

.unit-card strong,
.unit-card span {
  display: block;
}

.unit-card span {
  margin-top: 6px;
}

.unit-card em {
  border-radius: 999px;
  background: var(--mint);
  color: var(--green);
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-style: normal;
  font-weight: 900;
}

.task-list {
  display: grid;
  gap: 12px;
  border-radius: 16px;
  padding: 14px;
}

.task-list > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-list h2 {
  font-size: 18px;
}

.task-card {
  display: grid;
  gap: 14px;
  border-radius: 14px;
  padding: 16px;
}

.task-card h3 {
  margin-top: 10px;
  font-size: 18px;
}

.task-card p {
  margin-top: 8px;
}

.task-status {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  background: rgba(16, 55, 35, .08);
  color: var(--muted);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.task-status.in_progress,
.task-status.not_started {
  background: var(--mint);
  color: var(--green);
}

.task-status.completed {
  background: rgba(16, 55, 35, .10);
  color: var(--deep);
}

.detail-empty {
  display: grid;
  gap: 10px;
  place-items: center;
  min-height: 190px;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}

@media (min-width: 768px) {
  .student-detail-shell {
    padding: 28px;
  }

  .detail-topbar h1 {
    font-size: 34px;
  }

  .course-overview {
    grid-template-columns: minmax(0, 1fr) 160px 160px;
  }

  .unit-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .task-card {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }
}
</style>
