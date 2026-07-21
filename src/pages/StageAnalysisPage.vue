<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CourseWorkflowRail from '../components/CourseWorkflowRail.vue';
import { getAnsweredCourseQuestions, getCourse, getCourseQuestions, notify, store } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const activeTab = ref('已作答');
const selectedAnalysisQuestionId = ref(null);
const tabs = ['已作答', '学情上下文', '课堂统计'];

const course = computed(() => getCourse(route.params.courseId));
const referencedQuestions = computed(() => getCourseQuestions(course.value.id));
const answeredQuestions = computed(() => getAnsweredCourseQuestions(course.value.id));
const activeQuestion = computed(() => {
  const selected = store.questions.find((question) => question.id === store.classroom.selectedQuestionId);
  return selected && referencedQuestions.value.some((question) => question.id === selected.id)
    ? selected
    : referencedQuestions.value[0] || null;
});
const activeAnalysis = computed(() => activeQuestion.value ? (store.afterClass.questionAnalysis[activeQuestion.value.id] || null) : null);
const modalQuestion = computed(() => store.questions.find((question) => question.id === selectedAnalysisQuestionId.value) || activeQuestion.value);
const modalAnalysis = computed(() => modalQuestion.value ? (store.afterClass.questionAnalysis[modalQuestion.value.id] || null) : null);
const classAccuracy = computed(() => {
  if (!activeQuestion.value) return 0;
  return store.classroom.phase === 'result' ? store.classroom.accuracy : activeQuestion.value.accuracy;
});
function getWeakPoints(questionId) {
  const base = store.afterClass.summary.weakPoints;
  if (questionId === 'newton-q4') return ['力不一定让速度变大', '合力方向与速度方向混淆', '运动状态变化表述'];
  if (questionId === 'newton-q3') return ['摩擦力参与合力计算', '受力分析步骤遗漏', '方向表达不完整'];
  return base;
}
const weakPoints = computed(() => activeQuestion.value ? getWeakPoints(activeQuestion.value.id) : []);
const modalWeakPoints = computed(() => modalQuestion.value ? getWeakPoints(modalQuestion.value.id) : []);

function openAnalysisModal(questionId) {
  store.classroom.selectedQuestionId = questionId;
  selectedAnalysisQuestionId.value = questionId;
}
</script>

<template>
  <main class="qa-page">
    <header class="qa-top">
      <button class="qa-back back-btn" type="button" @click="router.push(`/preclass/courses/${course.id}/workspace`)">
        <span class="material-symbols-outlined">chevron_left</span>
        返回大纲
      </button>
      <div>
        <h1>题目与分析</h1>
        <p>{{ course.title }} ・ 管理本课引用题目，沉淀作答统计、错因和 AI 弱点分析。</p>
      </div>
      <div class="qa-actions">
        <button class="soft-btn" type="button" @click="router.push(`/preclass/courses/${course.id}/lesson-plan`)">
          <span class="material-symbols-outlined">article</span>
          去生成教案
        </button>
        <button class="primary-btn" type="button" @click="router.push('/question-banks/newton-laws-bank/generate')">
          <span class="material-symbols-outlined">auto_awesome</span>
          引用学情生成题目
        </button>
      </div>
    </header>

    <section class="qa-shell">
      <CourseWorkflowRail :course-id="course.id" active-step="analysis" />

      <section class="qa-content">

    <section class="qa-summary">
      <article>
        <span>本课引用题</span>
        <strong>{{ answeredQuestions.length }}</strong>
        <em>{{ referencedQuestions.length }} 道已进入题析</em>
      </article>
      <article>
        <span>当前作答</span>
        <strong>{{ store.classroom.answered }}/{{ store.classroom.total }}</strong>
        <em>{{ store.classroom.phase === 'ready' ? '待下发' : store.classroom.phase === 'answering' ? '进行中' : '已结束' }}</em>
      </article>
      <article>
        <span>当前正确率</span>
        <strong>{{ classAccuracy }}%</strong>
        <em>随课中结果更新</em>
      </article>
      <article>
        <span>AI 识别弱点</span>
        <strong>{{ weakPoints.length }}</strong>
        <em>供生成内容引用</em>
      </article>
    </section>

    <section class="module-tools">
      <div class="segmented">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="{ active: activeTab === tab }"
          type="button"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>
      <label class="module-search">
        <span class="material-symbols-outlined">search</span>
        <input type="search" placeholder="搜索学情、错因、知识点..." />
      </label>
      <button class="course-filter" type="button" @click="notify('已按薄弱程度排序')">
        薄弱优先
        <span class="material-symbols-outlined">expand_more</span>
      </button>
    </section>

    <section class="qa-layout">
      <div v-if="activeTab !== '课堂统计'" class="list-panel qa-list">
        <article
          v-for="question in activeTab === '已作答' ? answeredQuestions : referencedQuestions"
          :key="question.id"
          class="question-row"
          :class="{ selected: activeQuestion?.id === question.id }"
        >
          <div>
            <div class="card-meta" style="margin-top:0">
              <span>{{ question.stage }}</span>
              <span>{{ question.type }}</span>
              <span>{{ question.difficulty }}</span>
              <span>正确率 {{ question.accuracy }}%</span>
            </div>
            <h3>{{ question.title }}</h3>
            <p>{{ question.analysis }}</p>
          </div>
          <div class="row-actions">
            <button class="soft-btn" type="button" @click="openAnalysisModal(question.id)">查看课程数据</button>
            <button class="primary-btn" type="button" @click="router.push('/question-banks/newton-laws-bank/generate')">
              引用生成
            </button>
          </div>
        </article>

        <article v-if="activeTab === '已作答' && !answeredQuestions.length" class="empty-import">
          <span class="material-symbols-outlined">playlist_add</span>
          <strong>还没有已作答题目</strong>
          <p>先从题库把题目引用到本课，课中才能下发并沉淀分析。</p>
          <button class="primary-btn" type="button" @click="router.push('/question-banks')">去题库准备课堂题</button>
        </article>
        <article v-if="activeTab === '学情上下文' && !referencedQuestions.length" class="empty-import">
          <span class="material-symbols-outlined">link</span>
          <strong>本课还没有引用题目</strong>
          <p>题库中的题目被引用到这门课后，才会进入这里并出现在课中选题面板。</p>
          <button class="primary-btn" type="button" @click="router.push('/question-banks')">去题库引用</button>
        </article>
      </div>

      <div v-else-if="activeQuestion" class="list-panel qa-live">
        <article class="live-stat-card">
          <header>
            <span class="small-chip">实时答题统计</span>
            <h2>{{ activeQuestion.title }}</h2>
            <p>{{ store.classroom.phase === 'ready' ? '课中尚未下发，当前展示题库历史正确率。' : '来自课中授课页的实时作答数据。' }}</p>
          </header>
          <div class="live-progress">
            <strong>{{ classAccuracy }}%</strong>
            <span>正确率</span>
            <i :style="{ width: `${classAccuracy}%` }"></i>
          </div>
          <div class="option-bars">
            <div v-for="item in activeAnalysis?.options || []" :key="item.label">
              <span>{{ item.label }}</span>
              <i :style="{ width: `${item.percent}%` }"></i>
              <strong>{{ item.percent }}%</strong>
              <em>{{ item.note }}</em>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="list-panel qa-live">
        <article class="empty-import">
          <span class="material-symbols-outlined">monitoring</span>
          <strong>暂无课堂统计</strong>
          <p>课中下发本课引用题并结束答题后，这里会显示实时正确率和选项分布。</p>
        </article>
      </div>

      <aside v-if="activeQuestion" class="surface-card qa-ai">
        <span class="small-chip"><span class="material-symbols-outlined">auto_awesome</span>AI 弱点分析</span>
        <h2>{{ activeQuestion.title }}</h2>
        <p>{{ activeAnalysis?.advice || '这道题还没有课堂作答分析。下发并结束答题后，AI 会生成讲评建议。' }}</p>
        <div class="weak-list">
          <button v-for="point in weakPoints" :key="point" type="button" @click="notify(`${point} 已加入补救建议`)">
            <span class="material-symbols-outlined">error</span>
            {{ point }}
          </button>
        </div>
        <div class="qa-link-box">
          <strong>学情上下文</strong>
          <p>这里沉淀的已作答题目、错因和弱点，会被 PPT 生成、教案生成和 AI 生题作为上下文引用。</p>
        </div>
        <button class="outline-generate-btn" type="button" @click="openAnalysisModal(activeQuestion.id)">
          <span class="material-symbols-outlined">monitoring</span>
          查看课程数据
        </button>
      </aside>
      <aside v-else class="surface-card qa-ai">
        <span class="small-chip"><span class="material-symbols-outlined">auto_awesome</span>AI 弱点分析</span>
        <h2>等待课堂题目</h2>
        <p>先从题库引用题目到本课，课中下发并结束答题后，AI 会在这里沉淀弱点分析。</p>
        <div class="qa-link-box">
          <strong>数据流转</strong>
          <p>题库题目先被课程引用，课中只能选择这些引用题；作答结果会回流到本页和全局学情分析。</p>
        </div>
      </aside>
    </section>
      </section>
    </section>

    <Teleport to="body">
      <div v-if="selectedAnalysisQuestionId && modalQuestion" class="qa-modal-backdrop" @click.self="selectedAnalysisQuestionId = null">
        <section class="qa-modal" role="dialog" aria-modal="true" aria-label="题目 AI 分析">
          <header class="qa-modal-head">
            <div>
              <span class="small-chip"><span class="material-symbols-outlined">auto_awesome</span>AI 学情分析</span>
              <h2>{{ modalQuestion.title }}</h2>
              <p>{{ course.title }} ・ {{ modalQuestion.stage }} ・ {{ modalQuestion.type }} ・ {{ modalQuestion.difficulty }}</p>
            </div>
            <button type="button" aria-label="关闭" @click="selectedAnalysisQuestionId = null">
              <span class="material-symbols-outlined">close</span>
            </button>
          </header>

          <section class="qa-modal-body">
            <article class="modal-score">
              <span>课堂正确率</span>
              <strong>{{ modalQuestion.id === activeQuestion?.id ? classAccuracy : modalQuestion.accuracy }}%</strong>
              <p>平均用时 {{ modalAnalysis?.avgTime || '待统计' }} ・ {{ modalAnalysis?.correct || 0 }} 人答对 / {{ modalAnalysis?.wrong || 0 }} 人需讲评</p>
            </article>

            <article class="modal-ai-copy">
              <span class="small-chip">AI 讲评建议</span>
              <p>{{ modalAnalysis?.advice || '这道题还没有课堂作答分析。' }}</p>
              <div class="modal-weak">
                <button v-for="point in modalWeakPoints" :key="point" type="button" @click="notify(`${point} 已加入讲评重点`)">
                  <span class="material-symbols-outlined">priority_high</span>
                  {{ point }}
                </button>
              </div>
            </article>

            <article class="modal-options">
              <h3>选项 / 步骤分布</h3>
              <div v-for="item in modalAnalysis?.options || []" :key="item.label" class="modal-option-row">
                <span>{{ item.label }}</span>
                <i><b :style="{ width: `${item.percent}%` }"></b></i>
                <strong>{{ item.percent }}%</strong>
                <em>{{ item.note }}</em>
              </div>
            </article>
          </section>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.qa-page {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: var(--edu-topbar-h) minmax(0, 1fr);
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, rgba(176, 232, 200, .68), transparent 30%),
    #f4faf6;
  color: var(--ink);
}

.qa-top {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--edu-gap-md);
  padding: 0 var(--edu-page-pad);
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .9);
}

.qa-top h1 {
  font-family: var(--font-serif);
  font-size: var(--edu-title);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: 0;
}

.qa-top p {
  margin-top: 6px;
  color: var(--soft);
  font-size: var(--edu-body);
  font-weight: 600;
}

.qa-back,
.qa-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--edu-gap-sm);
}

.qa-back {
  height: var(--edu-control-compact-h);
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--edu-body);
  font-weight: 750;
}

.qa-actions .soft-btn,
.qa-actions .primary-btn {
  height: var(--edu-control-compact-h);
}

.qa-content {
  min-height: 0;
  overflow: hidden;
  padding: var(--edu-page-pad);
}

.qa-shell {
  min-height: 0;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  overflow: hidden;
}

.qa-content .module-tools {
  margin-top: 18px;
  margin-bottom: 16px;
}

.qa-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 0;
}

.qa-summary article {
  min-height: 116px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .74);
  padding: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .72);
}

.qa-summary span,
.qa-summary em {
  display: block;
  color: var(--soft);
  font-size: 12px;
  font-style: normal;
  font-weight: 750;
}

.qa-summary strong {
  display: block;
  margin: 10px 0 8px;
  font-family: var(--font-mono);
  font-size: 34px;
  line-height: 1;
}

.qa-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: start;
}

.qa-list {
  align-content: start;
}

.qa-live {
  min-height: 460px;
}

.qa-list .question-row {
  background: rgba(255, 255, 255, .74);
}

.qa-list .question-row.selected {
  border-color: rgba(31, 181, 95, .45);
  background: rgba(235, 249, 240, .82);
}

.row-actions {
  display: grid;
  gap: 10px;
  min-width: 122px;
}

.empty-import {
  display: grid;
  min-height: 260px;
  place-items: center;
  align-content: center;
  gap: 12px;
  border: 1px dashed rgba(31, 181, 95, .36);
  border-radius: 16px;
  background: rgba(255, 255, 255, .62);
  text-align: center;
}

.empty-import .material-symbols-outlined {
  color: var(--green);
  font-size: 34px;
}

.empty-import p {
  color: var(--muted);
  font-size: 13px;
}

.live-stat-card,
.qa-ai {
  border-radius: 16px;
  padding: 20px;
}

.live-stat-card {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .76);
}

.live-stat-card h2,
.qa-ai h2 {
  margin-top: 12px;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.35;
}

.live-stat-card p,
.qa-ai p,
.qa-link-box p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.live-progress {
  position: relative;
  margin-top: 24px;
  overflow: hidden;
  border-radius: 16px;
  background: #eff8f3;
  padding: 20px;
}

.live-progress strong {
  font-family: var(--font-mono);
  font-size: 46px;
}

.live-progress span {
  margin-left: 10px;
  color: var(--soft);
  font-weight: 800;
}

.live-progress i {
  display: block;
  height: 8px;
  margin-top: 18px;
  border-radius: 999px;
  background: var(--green);
}

.option-bars {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.option-bars div {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 46px minmax(120px, .8fr);
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.option-bars i {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--green);
}

.qa-ai {
  position: sticky;
  top: 0;
}

.weak-list {
  display: grid;
  gap: 10px;
  margin: 18px 0;
}

.weak-list button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .78);
  padding: 0 12px;
  color: var(--ink);
  font-weight: 800;
  text-align: left;
}

.weak-list .material-symbols-outlined {
  color: var(--amber);
}

.qa-link-box {
  border-radius: 14px;
  background: #eef8f2;
  padding: 14px;
  margin-bottom: 16px;
}

.qa-link-box strong {
  color: #159251;
}

.qa-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  background: rgba(9, 30, 20, .34);
  backdrop-filter: blur(10px);
}

.qa-modal {
  width: min(880px, calc(100vw - 96px));
  max-height: min(760px, calc(100vh - 72px));
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 20px;
  background: rgba(248, 253, 250, .96);
  box-shadow: 0 34px 90px rgba(8, 38, 24, .28);
}

.qa-modal-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  gap: 18px;
  align-items: start;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--line);
}

.qa-modal-head h2 {
  margin-top: 12px;
  font-family: var(--font-serif);
  font-size: 26px;
  line-height: 1.28;
}

.qa-modal-head p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
}

.qa-modal-head > button {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--mint);
  color: var(--green);
}

.qa-modal-body {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  max-height: calc(min(760px, calc(100vh - 72px)) - 126px);
  overflow-y: auto;
  padding: 18px 24px 24px;
}

.modal-score,
.modal-ai-copy,
.modal-options {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .78);
  padding: 18px;
}

.modal-score {
  align-self: start;
  min-height: 186px;
  background: var(--deep);
  color: #fff;
}

.modal-score span {
  display: block;
  color: rgba(255, 255, 255, .66);
  font-size: 12px;
  font-weight: 800;
}

.modal-score strong {
  display: block;
  margin-top: 18px;
  color: #7df0a0;
  font-family: var(--font-mono);
  font-size: 54px;
  line-height: 1;
}

.modal-score p {
  margin-top: 16px;
  color: rgba(255, 255, 255, .72);
  font-size: 13px;
  line-height: 1.6;
}

.modal-ai-copy {
  min-height: 186px;
}

.modal-ai-copy p {
  margin-top: 12px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.72;
}

.modal-weak {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.modal-weak button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  padding: 0 12px;
  color: var(--ink);
  font-size: 12px;
  font-weight: 800;
}

.modal-weak .material-symbols-outlined {
  color: var(--amber);
  font-size: 17px;
}

.modal-options {
  grid-column: 1 / -1;
}

.modal-options h3 {
  margin-bottom: 14px;
  font-family: var(--font-serif);
  font-size: 20px;
}

.modal-option-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 54px minmax(160px, .72fr);
  align-items: center;
  gap: 12px;
  min-height: 42px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.modal-option-row span {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: #eef8f2;
  color: #159251;
  font-weight: 900;
}

.modal-option-row i {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7f1eb;
}

.modal-option-row b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.modal-option-row strong {
  color: var(--ink);
}

.modal-option-row em {
  font-style: normal;
}
</style>
