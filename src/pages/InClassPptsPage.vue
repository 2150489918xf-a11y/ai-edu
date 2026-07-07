<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getCourseQuestions, notify, store } from '../data/mockStore';

const router = useRouter();

const historyPpts = [
  { id: 'function-mono', courseId: 'math-monotonicity', title: '函数单调性', course: '高一数学', slides: 12, status: '待上课', updatedAt: '05/30 10:12', cover: 'f(x)' },
  { id: 'chem-equation', courseId: 'chem-equation', title: '化学方程式', course: '初三化学', slides: 10, status: '可复用', updatedAt: '05/26 16:20', cover: 'H₂O' }
];

const activeCourse = computed(() => store.courses.find((course) => course.id === store.selectedCourseId));
const ppts = computed(() => {
  const list = [...historyPpts];
  if (activeCourse.value?.subject === '物理' && activeCourse.value.title.includes('牛顿第二定律')) {
    list.unshift({
      id: 'newton-2',
      courseId: activeCourse.value.id,
      title: '牛顿第二定律',
      course: `${activeCourse.value.grade}${activeCourse.value.subject}`,
      slides: 16,
      status: activeCourse.value.hasOutline ? '可授课' : '待完善',
      updatedAt: '刚刚',
      cover: 'F=ma'
    });
  }
  return list;
});
const activeCourseQuestionCount = computed(() => activeCourse.value ? getCourseQuestions(activeCourse.value.id).length : 0);

function startClass(ppt) {
  store.selectedCourseId = ppt.courseId;
  store.classroom.courseId = ppt.courseId;
  store.classroom.pptId = ppt.id;
  store.classroom.phase = 'ready';
  store.classroom.panelOpen = false;
  const [firstQuestion] = getCourseQuestions(ppt.courseId);
  store.classroom.selectedQuestionId = firstQuestion?.id || null;
  router.push(`/in-class/play/${ppt.id}`);
}
</script>

<template>
  <main class="module-page inclass-page">
    <section class="module-head">
      <div>
        <h1>课中 PPT</h1>
        <p>选择已经准备好的课件进入授课播放，课堂题目会从题库和 PPT 页自动带入。</p>
      </div>
    </section>

    <section class="module-tools">
      <div class="segmented">
        <button class="active" type="button">全部</button>
        <button type="button">今天</button>
        <button type="button">待上课</button>
        <button type="button">可复用</button>
      </div>
      <label class="module-search">
        <span class="material-symbols-outlined">search</span>
        <input type="search" placeholder="搜索课件、课程..." />
      </label>
      <button class="course-filter" type="button" @click="notify('已按上课时间排序')">
        上课时间
        <span class="material-symbols-outlined">expand_more</span>
      </button>
    </section>

    <section class="ppt-grid">
      <article v-for="ppt in ppts" :key="ppt.id" class="module-card ppt-card lift-card">
        <div class="ppt-cover">
          <span>{{ ppt.cover }}</span>
          <i></i>
          <small>{{ ppt.slides }} 页</small>
        </div>
        <div class="ppt-info">
          <span class="status-chip">{{ ppt.status }}</span>
          <h2>{{ ppt.title }}</h2>
          <p>{{ ppt.course }} ・ {{ ppt.updatedAt }} ・ 已引用 {{ getCourseQuestions(ppt.courseId).length }} 道课堂题</p>
          <div class="card-actions">
            <button class="primary-btn start-class-btn" type="button" @click="startClass(ppt)">
              <span class="material-symbols-outlined">play_arrow</span>
              开始上课
            </button>
          </div>
        </div>
      </article>
    </section>

    <section class="live-brief">
      <article>
        <span class="material-symbols-outlined">quiz</span>
        <strong>{{ activeCourseQuestionCount }} 道课堂题</strong>
        <small>当前课程已引用题目</small>
      </article>
      <article>
        <span class="material-symbols-outlined">group</span>
        <strong>实时答题</strong>
        <small>下发后展示进度和正确率</small>
      </article>
      <article>
        <span class="material-symbols-outlined">monitoring</span>
        <strong>课后分析</strong>
        <small>自动沉淀单题错因</small>
      </article>
    </section>
  </main>
</template>

<style scoped>
.ppt-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.inclass-page :deep(.module-head h1) {
  font-family: var(--font-mono);
  font-size: 34px;
  letter-spacing: 0;
}

.ppt-card {
  display: grid;
  grid-template-rows: 226px auto;
  padding: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, .70);
}

.ppt-cover {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(126, 240, 160, .08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(126, 240, 160, .08) 1px, transparent 1px),
    var(--deep);
  background-size: 32px 32px;
  border-bottom: 1px solid var(--line);
}

.ppt-cover span {
  display: grid;
  width: 150px;
  height: 96px;
  place-items: center;
  border: 1px solid rgba(126, 240, 160, .30);
  border-radius: 14px;
  background: rgba(255, 255, 255, .08);
  color: #7df0a0;
  font-family: var(--font-mono);
  font-size: 34px;
  font-weight: 800;
  box-shadow: 0 18px 34px rgba(0, 0, 0, .16);
}

.ppt-cover i {
  position: absolute;
  left: 28px;
  bottom: 28px;
  width: 74px;
  height: 5px;
  border-radius: 999px;
  background: #7df0a0;
}

.ppt-cover small {
  position: absolute;
  right: 22px;
  bottom: 22px;
  color: rgba(255, 255, 255, .64);
  font-size: 12px;
  font-weight: 700;
}

.ppt-info {
  padding: 20px;
}

.ppt-info h2 {
  margin-top: 14px;
  font-family: var(--font-serif);
}

.card-actions {
  margin-top: 18px;
}

.start-class-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 122px;
  height: 40px;
  justify-content: center;
}

.start-class-btn .material-symbols-outlined {
  font-size: 20px;
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20;
}

.live-brief {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.live-brief article {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 12px;
  min-height: 88px;
  align-content: center;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .58);
  padding: 16px;
}

.live-brief .material-symbols-outlined {
  grid-row: 1 / span 2;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
}

.live-brief strong {
  font-family: var(--font-serif);
  font-size: 18px;
}

.live-brief small {
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
</style>
