<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCourse, getQuestion, notify, store } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const course = computed(() => getCourse(route.params.courseId));
const question = computed(() => getQuestion(route.params.questionId));
const analysis = computed(() => store.afterClass.questionAnalysis[question.value.id] || store.afterClass.questionAnalysis['newton-q1']);
</script>

<template>
  <main class="module-page report-page question-analysis-page">
    <section class="module-head">
      <div>
        <h1>单题数据分析</h1>
        <p>{{ course.title }} ・ {{ question.type }} ・ {{ question.stage }} ・ {{ question.difficulty }}</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn back-btn" type="button" @click="router.push('/learning-analysis')">
          <span class="material-symbols-outlined">chevron_left</span>
          返回分析
        </button>
        <button class="primary-btn" type="button" @click="notify('已加入下节课讲解清单')">
          <span class="material-symbols-outlined">playlist_add_check</span>
          加入讲解
        </button>
      </div>
    </section>

    <section class="question-data-layout">
      <article class="surface-card question-copy">
        <div class="card-meta" style="margin-top:0">
          <span>正确 {{ analysis.correct }} 人</span>
          <span>错误 {{ analysis.wrong }} 人</span>
          <span>平均用时 {{ analysis.avgTime }}</span>
        </div>
        <h2>{{ question.title }}</h2>
        <p>答案：{{ question.answer }}</p>
        <div class="option-analysis">
          <div v-for="option in analysis.options" :key="option.label">
            <header><strong>{{ option.label }}</strong><span>{{ option.percent }}%</span></header>
            <div class="progress-line"><i :style="{ width: `${option.percent}%` }"></i></div>
            <p>{{ option.note }}</p>
          </div>
        </div>
      </article>

      <aside class="surface-card side-panel">
        <span class="small-chip">AI 讲评建议</span>
        <h2>{{ analysis.advice }}</h2>
        <p>建议把这道题放在下节课第一个检测环节前，用 2 分钟让学生先说“研究对象、合力、方向”。</p>
        <button class="outline-generate-btn" type="button" @click="router.push('/question-banks/newton-laws-bank/generate')">
          <span class="material-symbols-outlined">auto_awesome</span>
          生成同类变式
        </button>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.report-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.question-data-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 18px;
  margin-top: 24px;
}

.question-copy,
.side-panel {
  border-radius: 16px;
  padding: 28px;
}

.question-copy h2 {
  margin-top: 18px;
  font-family: var(--font-serif);
  font-size: 25px;
  line-height: 1.42;
}

.question-copy > p {
  margin-top: 14px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 800;
}

.option-analysis {
  display: grid;
  gap: 14px;
  margin-top: 28px;
}

.option-analysis > div {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(244, 250, 246, .78);
}

.option-analysis header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.option-analysis p,
.side-panel p {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
}

.side-panel h2 {
  margin: 18px 0 10px;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.45;
}
</style>
