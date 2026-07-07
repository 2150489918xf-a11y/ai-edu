<script setup>
import { computed, ref, watch } from 'vue';
import { getQuestion, store } from '../data/mockStore';

const selectedAnswer = ref('');
const submitted = ref(false);

const slideIndex = computed(() => store.classroom.currentSlideIndex ?? 0);
const slide = computed(() => store.slides[slideIndex.value] || store.slides[0]);
const activeQuestion = computed(() => getQuestion(store.classroom.assignedQuestionId || store.classroom.selectedQuestionId) || store.classroom.assignedQuestionSnapshot);
const showQuestion = computed(() => Boolean(activeQuestion.value) && store.classroom.phase !== 'ready');
const answerOptions = computed(() => activeQuestion.value?.options || []);
const isResult = computed(() => store.classroom.phase === 'result');

watch(
  () => store.classroom.assignedQuestionId,
  () => {
    selectedAnswer.value = '';
    submitted.value = false;
  }
);

function submitAnswer() {
  if (!selectedAnswer.value) return;
  submitted.value = true;
}
</script>

<template>
  <main class="student-page">
    <header class="student-top">
      <div>
        <strong>学生端</strong>
        <span>被动同步教师端课件</span>
      </div>
      <div class="sync-chip">
        <i></i>
        教师端同步中
      </div>
    </header>

    <section class="student-stage">
      <article class="student-slide">
        <img
          :src="`/assets/newton-ppt/slide-${String(slideIndex + 1).padStart(2, '0')}.png`"
          :alt="`${String(slideIndex + 1).padStart(2, '0')} ${slide.title}`"
        />
      </article>
      <div class="student-page-mark">
        第 {{ slideIndex + 1 }} / {{ store.slides.length }} 页
      </div>
    </section>

    <aside v-if="showQuestion" class="student-question-modal">
      <header>
        <span class="small-chip">{{ isResult ? '答题结果' : submitted ? '已提交' : '课堂题目' }}</span>
        <h2>{{ activeQuestion.title }}</h2>
        <p>{{ activeQuestion.stage }} ・ {{ activeQuestion.type }} ・ {{ activeQuestion.difficulty }}</p>
      </header>

      <section v-if="!isResult" class="student-options">
        <button
          v-for="option in answerOptions"
          :key="option"
          :class="{ active: selectedAnswer === option }"
          type="button"
          :disabled="submitted"
          @click="selectedAnswer = option"
        >
          {{ option }}
        </button>
      </section>

      <section v-if="isResult" class="student-result">
        <strong>本题正确率 {{ store.classroom.accuracy }}%</strong>
        <p>老师正在讲解错因，请对照题目解析订正。</p>
      </section>

      <footer v-else>
        <p v-if="submitted">答案已提交，等待老师结束答题。</p>
        <button class="submit-answer" type="button" :disabled="!selectedAnswer || submitted" @click="submitAnswer">
          {{ submitted ? '已提交' : '提交答案' }}
        </button>
      </footer>
    </aside>
  </main>
</template>

<style scoped>
.student-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(126, 240, 160, .14), transparent 28%),
    #101a15;
  color: #edf8f1;
}

.student-top {
  position: absolute;
  left: 28px;
  right: 28px;
  top: 22px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.student-top div:first-child {
  display: grid;
  gap: 6px;
}

.student-top strong {
  font-size: 18px;
}

.student-top span {
  color: rgba(237, 248, 241, .58);
  font-size: 12px;
  font-weight: 700;
}

.sync-chip {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 999px;
  background: rgba(255, 255, 255, .10);
  padding: 0 14px;
  color: rgba(237, 248, 241, .82);
  font-size: 12px;
  font-weight: 800;
  backdrop-filter: blur(14px);
}

.sync-chip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7df0a0;
  box-shadow: 0 0 0 6px rgba(125, 240, 160, .14);
}

.student-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 82px 60px 58px;
}

.student-slide {
  width: min(calc(100vw - 120px), calc((100vh - 158px) * 16 / 9), 1220px);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 34px 90px rgba(0, 0, 0, .34);
}

.student-slide img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.student-page-mark {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 999px;
  background: rgba(255, 255, 255, .10);
  padding: 10px 18px;
  color: rgba(237, 248, 241, .74);
  font-size: 13px;
  font-weight: 800;
  backdrop-filter: blur(16px);
}

.student-question-modal {
  position: absolute;
  right: 34px;
  top: 92px;
  z-index: 10;
  width: min(420px, calc(100vw - 68px));
  border: 1px solid rgba(255, 255, 255, .68);
  border-radius: 18px;
  background: rgba(255, 255, 255, .94);
  color: var(--ink);
  padding: 20px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .24);
}

.student-question-modal h2 {
  margin-top: 12px;
  font-family: var(--font-serif);
  font-size: 20px;
  line-height: 1.35;
}

.student-question-modal header p {
  margin-top: 8px;
  color: var(--soft);
  font-size: 12px;
  font-weight: 700;
}

.student-options {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.student-options button {
  min-height: 46px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(244, 250, 246, .88);
  padding: 10px 12px;
  text-align: left;
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
}

.student-options button.active {
  border-color: rgba(31, 181, 95, .52);
  background: rgba(235, 249, 240, .96);
  color: var(--green);
  box-shadow: inset 0 0 0 1px rgba(47, 172, 102, .22);
}

.student-question-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
}

.student-question-modal footer p,
.student-result p {
  color: var(--soft);
  font-size: 12px;
  line-height: 1.6;
}

.submit-answer {
  min-width: 108px;
  height: 38px;
  border: 0;
  border-radius: 10px;
  background: var(--deep);
  color: #7df0a0;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 800;
}

.submit-answer:disabled {
  opacity: .64;
}

.student-result {
  display: grid;
  gap: 10px;
  margin-top: 18px;
  border-radius: 14px;
  background: rgba(235, 249, 240, .82);
  padding: 14px;
}

.student-result strong {
  color: var(--green);
  font-family: var(--font-mono);
  font-size: 24px;
}
</style>
