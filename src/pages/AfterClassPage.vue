<script setup>
import { computed, ref } from 'vue';
import { notify, store } from '../data/mockStore';

const selectedQuestionId = ref(null);
const questionRecords = computed(() => Object.entries(store.afterClass.questionAnalysis).map(([questionId, analysis]) => {
  const question = store.questions.find((item) => item.id === questionId);
  const total = analysis.correct + analysis.wrong;
  const accuracy = total ? Math.round((analysis.correct / total) * 100) : question?.accuracy || 0;
  return {
    id: questionId,
    question,
    analysis,
    accuracy,
    total,
    courseName: questionId.startsWith('newton') ? '高中物理《牛顿第二定律》' : '历史课堂'
  };
}));
const selectedRecord = computed(() => questionRecords.value.find((record) => record.id === selectedQuestionId.value) || null);
const selectedOptions = computed(() => selectedRecord.value?.analysis.options || []);
const maxOptionPercent = computed(() => Math.max(...selectedOptions.value.map((item) => item.percent), 1));

function openRecord(record) {
  selectedQuestionId.value = record.id;
}
</script>

<template>
  <main class="module-page report-page">
    <section class="module-head">
      <div>
        <h1>学情分析</h1>
        <p>汇总全系统课程作答记录、薄弱知识点和 AI 分析，支持回看每门课的题目与分析。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn" type="button" @click="notify('已刷新课堂记录')">
          <span class="material-symbols-outlined">refresh</span>
          刷新记录
        </button>
        <button class="primary-btn" type="button" @click="notify('已打开全局薄弱点汇总')">
          <span class="material-symbols-outlined">monitoring</span>
          查看全局分析
        </button>
      </div>
    </section>

    <section class="metric-grid after-metrics">
      <article class="metric-card"><strong>{{ store.afterClass.summary.attendance }}</strong><span>课堂出勤</span></article>
      <article class="metric-card"><strong>{{ store.afterClass.summary.interactions }}</strong><span>互动数据</span></article>
      <article class="metric-card"><strong>{{ store.afterClass.summary.avgAccuracy }}%</strong><span>平均正确率</span></article>
    </section>

    <section class="surface-card course-table">
      <header class="table-head">
        <span>题目记录</span>
        <span>时间</span>
        <span>类型</span>
        <span>正确率</span>
        <span>操作</span>
      </header>
      <article v-for="record in questionRecords" :key="record.id" class="table-row">
        <div>
          <h3>{{ record.question?.title || '课堂互动题' }}</h3>
          <p>{{ record.courseName }} ・ {{ record.analysis.advice }}</p>
        </div>
        <span>刚刚</span>
        <span>{{ record.question?.type || '互动题' }}</span>
        <strong>{{ record.accuracy }}%</strong>
        <button class="primary-btn" type="button" @click="openRecord(record)">查看记录</button>
      </article>
    </section>

    <Teleport to="body">
      <div v-if="selectedRecord" class="analysis-modal-backdrop" @click.self="selectedQuestionId = null">
        <section class="analysis-modal" role="dialog" aria-modal="true" aria-label="单题学情分析">
          <header class="analysis-modal-head">
            <div>
              <span class="small-chip"><span class="material-symbols-outlined">analytics</span>单题学情记录</span>
              <h2>{{ selectedRecord.question?.title || '课堂互动题' }}</h2>
              <p>{{ selectedRecord.courseName }} ・ {{ selectedRecord.question?.stage || '课中' }} ・ {{ selectedRecord.question?.type || '互动题' }} ・ 平均用时 {{ selectedRecord.analysis.avgTime }}</p>
            </div>
            <button type="button" aria-label="关闭" @click="selectedQuestionId = null">
              <span class="material-symbols-outlined">close</span>
            </button>
          </header>

          <section class="analysis-modal-body">
            <article class="analysis-score-card">
              <span>本题正确率</span>
              <strong>{{ selectedRecord.accuracy }}%</strong>
              <p>{{ selectedRecord.analysis.correct }} 人答对，{{ selectedRecord.analysis.wrong }} 人需要讲评。相比课中面板，这里保留了完整错因、选项分布和后续引用建议。</p>
            </article>

            <article class="analysis-ai-card">
              <span class="small-chip"><span class="material-symbols-outlined">auto_awesome</span>AI 单题分析</span>
              <h3>讲评重点：先确认研究对象，再判断合力方向</h3>
              <p>{{ selectedRecord.analysis.advice }}</p>
              <div class="weak-tags">
                <button v-for="point in store.afterClass.summary.weakPoints" :key="point" type="button" @click="notify(`${point} 已加入后续备课上下文`)">
                  {{ point }}
                </button>
              </div>
            </article>

            <article class="analysis-detail-card">
              <h3>选项 / 步骤分布</h3>
              <div v-for="item in selectedOptions" :key="item.label" class="analysis-question-row">
                <div>
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.note }}</span>
                </div>
                <i><b :style="{ width: `${Math.round((item.percent / maxOptionPercent) * 100)}%` }"></b></i>
                <em>{{ item.percent }}%</em>
              </div>
            </article>

          </section>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.report-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.after-metrics {
  margin: 24px 0 18px;
}

.after-metrics :deep(.metric-card) {
  background:
    linear-gradient(135deg, rgba(220, 246, 232, .72), rgba(255, 255, 255, .60)),
    var(--surface-glass);
}

.course-table {
  overflow: hidden;
  border-radius: 16px;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 150px 120px 120px 150px;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 0 20px;
}

.table-head {
  border-bottom: 1px solid var(--line);
  background: rgba(244, 250, 246, .84);
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.table-row {
  min-height: 92px;
  border-bottom: 1px solid var(--line);
}

.table-row:last-child {
  border-bottom: 0;
}

.table-row h3 {
  font-family: var(--font-serif);
  font-size: 18px;
}

.table-row p {
  margin-top: 6px;
  color: var(--soft);
  font-size: 12px;
}

.table-row span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.analysis-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  background: rgba(11, 31, 22, .34);
  backdrop-filter: blur(10px);
}

.analysis-modal {
  width: min(980px, calc(100vw - 64px));
  max-height: min(820px, calc(100vh - 64px));
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(231, 249, 239, .92), rgba(255, 255, 255, .94)),
    var(--surface-glass);
  box-shadow: 0 30px 90px rgba(8, 34, 21, .22);
}

.analysis-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 28px 18px;
  border-bottom: 1px solid var(--line);
}

.analysis-modal-head h2 {
  margin-top: 12px;
  font-family: var(--font-serif);
  font-size: 28px;
}

.analysis-modal-head p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.analysis-modal-head > button {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(10, 53, 34, .08);
  color: var(--ink);
}

.analysis-modal-body {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  max-height: 680px;
  overflow: auto;
  padding: 20px 28px 28px;
}

.analysis-score-card,
.analysis-ai-card,
.analysis-detail-card,
.analysis-flow-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .68);
  padding: 18px;
}

.analysis-score-card {
  min-height: 250px;
}

.analysis-score-card span,
.analysis-question-row span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.analysis-score-card strong {
  display: block;
  margin: 20px 0 12px;
  font-family: var(--font-mono);
  font-size: 58px;
  line-height: 1;
}

.analysis-score-card p,
.analysis-ai-card p,
.analysis-flow-card span {
  color: var(--soft);
  font-size: 13px;
  line-height: 1.7;
}

.analysis-ai-card {
  min-height: 250px;
}

.analysis-ai-card h3,
.analysis-detail-card h3,
.analysis-flow-card h3 {
  margin-top: 12px;
  font-family: var(--font-serif);
  font-size: 20px;
}

.weak-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.weak-tags button {
  min-height: 32px;
  border: 1px solid rgba(31, 181, 95, .22);
  border-radius: 999px;
  background: rgba(235, 249, 240, .82);
  padding: 0 12px;
  color: var(--green);
  font-size: 12px;
  font-weight: 800;
}

.analysis-detail-card {
  grid-column: 1 / -1;
}

.analysis-question-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px 48px;
  align-items: center;
  gap: 14px;
  min-height: 70px;
  border-bottom: 1px solid var(--line);
}

.analysis-question-row:last-child {
  border-bottom: 0;
}

.analysis-question-row div {
  display: grid;
  gap: 6px;
}

.analysis-question-row i {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(10, 53, 34, .08);
}

.analysis-question-row b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.analysis-question-row em {
  color: var(--ink);
  font-family: var(--font-mono);
  font-style: normal;
  font-weight: 800;
}

</style>
