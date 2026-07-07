<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addQuestionToClass, getBank, getQuestion, notify } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const showAnswer = ref(false);
const question = computed(() => getQuestion(route.params.questionId));
const bank = computed(() => getBank(question.value.bankId));
</script>

<template>
  <main class="module-page question-page question-detail-page">
    <section class="module-head">
      <div>
        <h1>题目详情</h1>
        <p>{{ bank.title }} ・ {{ question.stage }} ・ {{ question.type }} ・ {{ question.difficulty }}</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn back-btn" type="button" @click="router.push(`/question-banks/${bank.id}`)">
          <span class="material-symbols-outlined">chevron_left</span>
          返回题库
        </button>
        <button class="primary-btn" type="button" @click="addQuestionToClass(question.id)">
          <span class="material-symbols-outlined">add_task</span>
          加入课堂
        </button>
      </div>
    </section>

    <section class="question-detail-layout">
      <article class="surface-card question-main">
        <div class="card-meta" style="margin-top:0">
          <span>{{ question.stage }}</span>
          <span>{{ question.type }}</span>
          <span>{{ question.difficulty }}</span>
          <span>历史正确率 {{ question.accuracy }}%</span>
        </div>
        <h2>{{ question.title }}</h2>
        <div class="option-list">
          <button v-for="option in question.options" :key="option" type="button" @click="notify('已选中选项用于演示')">{{ option }}</button>
        </div>
        <div class="detail-actions">
          <button class="soft-btn" type="button" @click="showAnswer = !showAnswer">
            <span class="material-symbols-outlined">{{ showAnswer ? 'visibility_off' : 'visibility' }}</span>
            {{ showAnswer ? '隐藏答案' : '查看答案解析' }}
          </button>
          <button class="soft-btn" type="button" @click="notify('已复制题目')">复制题目</button>
          <button class="soft-btn" type="button" @click="notify('已加入课后作业')">加入课后</button>
        </div>
        <section v-if="showAnswer" class="answer-panel">
          <strong>答案：{{ question.answer }}</strong>
          <p>{{ question.analysis }}</p>
        </section>
      </article>

      <aside class="surface-card side-panel">
        <span class="small-chip">AI 讲解建议</span>
        <h2>先受力分析，再代入公式</h2>
        <p>如果作为课堂即时题，建议在第 6 页 F=ma 公式建构后下发，答题结束后展示选项分布。</p>
        <div class="side-stat"><strong>{{ question.accuracy }}%</strong><span>历史正确率</span></div>
        <div class="side-stat"><strong>2</strong><span>关联错因</span></div>
        <button class="outline-generate-btn" type="button" @click="router.push(`/after-class/physics-newton-2/questions/${question.id}`)">
          <span class="material-symbols-outlined">monitoring</span>
          查看单题分析
        </button>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.question-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.question-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  margin-top: 24px;
}

.question-main {
  min-height: 610px;
  border-radius: 16px;
  padding: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .80), rgba(255, 255, 255, .66)),
    var(--surface-glass);
}

.question-main h2 {
  margin-top: 18px;
  font-family: var(--font-serif);
  font-size: 25px;
  line-height: 1.4;
}

.option-list {
  display: grid;
  gap: 12px;
  margin: 26px 0;
}

.option-list button {
  min-height: 54px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(244, 250, 246, .82);
  padding: 0 18px;
  text-align: left;
  font-size: 15px;
  font-weight: 700;
}

.answer-panel {
  margin-top: 22px;
  padding: 18px;
  border: 1px solid var(--green);
  border-radius: 14px;
  background: rgba(220, 246, 232, .72);
}

.answer-panel strong {
  display: block;
  margin-bottom: 8px;
}

.answer-panel p,
.side-panel p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.side-panel h2 {
  margin: 18px 0 10px;
  font-family: var(--font-serif);
  font-size: 24px;
  line-height: 1.3;
}

.side-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  border-top: 1px solid var(--line);
}

.side-stat strong {
  font-family: var(--font-mono);
  font-size: 24px;
}

.side-stat span {
  color: var(--muted);
  font-size: 13px;
}
</style>
