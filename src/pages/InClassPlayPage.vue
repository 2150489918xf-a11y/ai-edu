<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  assignClassQuestion,
  getCourse,
  finishClassQuestion,
  getCourseQuestions,
  getQuestion,
  notify,
  resetClassQuestion,
  store
} from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const currentIndex = ref(store.classroom.currentSlideIndex ?? 5);
const resultLoading = ref(false);
const pptCourseMap = {
  'function-mono': 'math-monotonicity',
  'chem-equation': 'chem-equation'
};
const playCourseId = computed(() => {
  if (store.classroom.pptId === route.params.pptId && store.classroom.courseId) return store.classroom.courseId;
  return pptCourseMap[route.params.pptId] || store.selectedCourseId;
});
const selectedQuestionId = computed({
  get: () => store.classroom.selectedQuestionId,
  set: (value) => {
    store.classroom.selectedQuestionId = value;
  }
});

const slide = computed(() => store.slides[currentIndex.value] || store.slides[0]);
const course = computed(() => getCourse(playCourseId.value));
const classQuestions = computed(() => getCourseQuestions(playCourseId.value));
const activeQuestion = computed(() => getQuestion(selectedQuestionId.value) || classQuestions.value[0] || null);
const answerPercent = computed(() => Math.round((store.classroom.answered / store.classroom.total) * 100));

function togglePanel() {
  store.classroom.panelOpen = !store.classroom.panelOpen;
}

function assign() {
  if (!selectedQuestionId.value) {
    notify('请先从题库引用本课题目');
    return;
  }
  store.classroom.courseId = playCourseId.value;
  store.selectedCourseId = playCourseId.value;
  assignClassQuestion(selectedQuestionId.value);
  notify('题目已下发给学生');
}

function finish() {
  if (resultLoading.value) return;
  resultLoading.value = true;
  window.setTimeout(() => {
    finishClassQuestion();
    resultLoading.value = false;
    notify('答题已结束，结果已生成');
  }, 900);
}

function nextSlide() {
  currentIndex.value = Math.min(store.slides.length - 1, currentIndex.value + 1);
  store.classroom.currentSlideIndex = currentIndex.value;
}

function prevSlide() {
  currentIndex.value = Math.max(0, currentIndex.value - 1);
  store.classroom.currentSlideIndex = currentIndex.value;
}
</script>

<template>
  <main class="play-page">
    <header class="play-top">
      <button class="play-ghost back-btn" type="button" @click="router.push('/in-class/ppts')">
        <span class="material-symbols-outlined">chevron_left</span>
        退出播放
      </button>
      <div>
        <strong>{{ course.title.replace(/^.*《|》$/g, '') }}</strong>
        <span>第 {{ currentIndex + 1 }} / {{ store.slides.length }} 页 ・ 课中授课</span>
      </div>
      <span class="play-top-spacer" aria-hidden="true"></span>
    </header>

    <section class="slide-stage">
      <article class="live-slide">
        <img
          :src="`/assets/newton-ppt/slide-${String(currentIndex + 1).padStart(2, '0')}.png`"
          :alt="`${String(currentIndex + 1).padStart(2, '0')} ${slide.title}`"
        />
      </article>
    </section>

    <nav class="play-controls" aria-label="幻灯片切换">
      <button type="button" :disabled="currentIndex === 0" @click="prevSlide">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <strong>{{ slide.label }}</strong>
      <button type="button" :disabled="currentIndex === store.slides.length - 1" @click="nextSlide">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </nav>

    <button class="float-question" type="button" aria-label="课堂题目" @click="togglePanel">题</button>

    <aside class="question-panel" :class="{ open: store.classroom.panelOpen }">
      <header>
        <div>
          <h2>课堂题目</h2>
          <span>{{ store.classroom.phase === 'ready' ? '选择本课可下发题目' : store.classroom.phase === 'answering' ? '学生正在作答' : '答题结果' }}</span>
        </div>
        <div class="panel-head-actions">
          <button v-if="store.classroom.phase !== 'ready'" type="button" aria-label="重置答题" @click="resetClassQuestion">
            <span class="material-symbols-outlined">restart_alt</span>
          </button>
          <button type="button" aria-label="关闭题目面板" @click="togglePanel">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </header>

      <section v-if="store.classroom.phase === 'ready'" class="question-list-live">
        <div class="question-source-note">
          <span class="material-symbols-outlined">link</span>
          来自本课程「题目与分析」页的引用题目
        </div>
        <button
          v-for="question in classQuestions"
          :key="question.id"
          class="live-question-card"
          :class="{ selected: selectedQuestionId === question.id }"
          type="button"
          @click="selectedQuestionId = question.id"
        >
          <span class="select-circle"></span>
          <span>
            <strong>{{ question.title }}</strong>
            <small>{{ question.stage }} ・ {{ question.type }} ・ {{ question.difficulty }}</small>
          </span>
          <em>{{ question.accuracy }}%</em>
        </button>
        <div v-if="!classQuestions.length" class="live-empty">
          <span class="material-symbols-outlined">playlist_add</span>
          <strong>本课还没有引用题目</strong>
          <p>请先到题库选择题目并引用到这门课，课中只能下发本课已引用题目。</p>
          <button class="primary-btn" type="button" @click="router.push('/question-banks')">去题库引用</button>
        </div>
      </section>

      <section v-else-if="store.classroom.phase === 'answering'" class="answering-panel">
        <h3>{{ activeQuestion?.title }}</h3>
        <div v-if="resultLoading" class="result-loading">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>正在统计答题结果</strong>
          <p>AI 正在生成错误分布和讲解建议。</p>
        </div>
        <template v-else>
        <div class="answer-progress">
          <span>已作答 {{ store.classroom.answered }} / {{ store.classroom.total }}</span>
          <strong>{{ answerPercent }}%</strong>
        </div>
        <div class="progress-line"><i :style="{ width: `${answerPercent}%` }"></i></div>
        <div class="mini-bars">
          <div v-for="item in store.classroom.distribution" :key="item.label">
            <i :style="{ height: `${item.value * 2}px` }"></i>
            <span>{{ item.label }}</span>
          </div>
        </div>
        </template>
      </section>

      <section v-else class="result-panel">
        <span class="small-chip">正确率 {{ store.classroom.accuracy }}%</span>
        <h3>{{ activeQuestion?.title }}</h3>
        <p>讲解建议：先确认研究对象，再画受力图。重点追问选择 A、B 的学生是否把拉力直接当成合力。</p>
        <div class="result-grid">
          <div v-for="item in store.classroom.distribution" :key="item.label">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}%</span>
          </div>
        </div>
      </section>

      <footer v-if="store.classroom.phase !== 'result'">
        <button v-if="store.classroom.phase === 'ready'" class="primary-btn" type="button" @click="assign">
          下发题目
        </button>
        <button v-else-if="store.classroom.phase === 'answering'" class="primary-btn" type="button" :disabled="resultLoading" @click="finish">
          {{ resultLoading ? '生成结果中' : '结束答题' }}
        </button>
      </footer>
    </aside>
  </main>
</template>

<style scoped>
.play-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 22% 12%, rgba(126, 240, 160, .16), transparent 28%),
    #111b16;
  color: #edf8f1;
}

.play-top {
  position: absolute;
  left: 28px;
  right: 28px;
  top: 22px;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.play-top div {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.play-top strong {
  font-size: 18px;
}

.play-top span {
  color: rgba(237, 248, 241, .58);
  font-size: 12px;
  font-weight: 700;
}

.play-top-spacer {
  width: 112px;
}

.play-ghost {
  display: inline-flex;
  height: 40px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: 999px;
  background: rgba(255, 255, 255, .09);
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
  color: #edf8f1;
  backdrop-filter: blur(16px);
}

.slide-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 86px 64px 66px;
}

.live-slide {
  position: relative;
  width: min(calc(100vw - 128px), calc((100vh - 168px) * 16 / 9), 1210px);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 34px 90px rgba(0, 0, 0, .34);
}

.live-slide img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.play-controls {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, .14);
  background: rgba(255, 255, 255, .10);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(16px);
  transform: translateX(-50%);
}

.play-controls button {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
}

.play-controls button:disabled {
  opacity: .35;
}

.play-controls strong {
  min-width: 80px;
  text-align: center;
  font-size: 13px;
  color: #edf8f1;
}

.float-question {
  position: absolute;
  right: 54px;
  top: 112px;
  z-index: 10;
  width: 58px;
  height: 58px;
  border: 0;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
  box-shadow: 0 18px 34px rgba(10, 53, 34, .24);
  font-size: 22px;
  font-weight: 900;
}

.question-panel {
  position: absolute;
  right: 54px;
  top: 184px;
  z-index: 9;
  display: none;
  width: 440px;
  max-height: calc(100vh - 210px);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, .95);
  box-shadow: var(--shadow);
  color: var(--ink);
}

.question-panel.open {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.question-panel.open:has(.result-panel) {
  grid-template-rows: auto minmax(0, 1fr);
}

.question-panel header,
.question-panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--line);
}

.question-panel footer {
  border-top: 1px solid var(--line);
  border-bottom: 0;
}

.question-panel h2 {
  font-size: 20px;
}

.question-panel header span {
  color: var(--muted);
  font-size: 12px;
}

.question-panel header button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--mint);
  color: var(--green);
}

.panel-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-list-live {
  display: grid;
  gap: 12px;
  padding: 14px;
  overflow: hidden;
}

.question-source-note {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border-radius: 10px;
  background: #eef8f2;
  padding: 0 10px;
  color: #208e52;
  font-size: 12px;
  font-weight: 800;
}

.question-source-note .material-symbols-outlined {
  font-size: 18px;
}

.live-question-card {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 42px;
  gap: 10px;
  align-items: center;
  min-height: 92px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
  padding: 12px;
  text-align: left;
}

.live-question-card.selected {
  border-color: var(--green);
  background: rgba(220, 246, 232, .52);
}

.select-circle {
  width: 18px;
  height: 18px;
  border: 2px solid var(--deep);
  border-radius: 50%;
}

.live-question-card.selected .select-circle {
  box-shadow: inset 0 0 0 4px white;
  background: var(--green);
}

.live-question-card strong,
.live-question-card small {
  display: block;
}

.live-question-card strong {
  font-size: 13px;
  line-height: 1.45;
}

.live-question-card small {
  margin-top: 6px;
  color: var(--soft);
  font-size: 11px;
}

.live-question-card em {
  color: var(--green);
  font-style: normal;
  font-weight: 900;
}

.answering-panel,
.result-panel {
  padding: 18px;
}

.answering-panel h3,
.result-panel h3 {
  margin: 14px 0;
  font-size: 16px;
  line-height: 1.45;
}

.answer-progress {
  display: flex;
  justify-content: space-between;
  margin: 16px 0 10px;
  color: var(--muted);
  font-size: 13px;
}

.mini-bars {
  display: flex;
  align-items: end;
  justify-content: space-around;
  height: 128px;
  margin-top: 22px;
  padding: 0 18px;
  border-radius: 14px;
  background: #f5faf7;
}

.mini-bars div {
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.mini-bars i {
  display: block;
  width: 28px;
  border-radius: 8px 8px 0 0;
  background: var(--green);
}

.result-panel p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.result-loading {
  display: grid;
  min-height: 230px;
  place-items: center;
  align-content: center;
  gap: 10px;
  border-radius: 14px;
  background: rgba(220, 246, 232, .52);
  text-align: center;
}

.result-loading .material-symbols-outlined {
  color: var(--green);
  font-size: 34px;
  animation: result-spin 1.2s linear infinite;
}

.result-loading strong {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 20px;
}

.result-loading p {
  color: var(--muted);
  font-size: var(--edu-body);
}

.primary-btn:disabled {
  opacity: .72;
}

@keyframes result-spin {
  to {
    transform: rotate(360deg);
  }
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 18px;
}

.result-grid div {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 64px;
  border-radius: 12px;
  background: #f4faf6;
}

.result-grid span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}
</style>
