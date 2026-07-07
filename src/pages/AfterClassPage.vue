<script setup>
import { computed, onMounted, ref } from 'vue';
import { notify, store } from '../data/mockStore';
import {
  getClassLearningAnalysis,
  getParentLearningSummary,
  getStudentProfile,
  getStudentProfileList
} from '../data/mockApi';

const tabs = [
  { key: 'class', label: '班级学情' },
  { key: 'student', label: '学生画像' },
  { key: 'parent', label: '家长摘要' }
];
const activeTab = ref('class');
const selectedQuestionId = ref(null);
const selectedStudentId = ref('stu-liming');
const loading = ref(false);
const classAnalysis = ref(null);
const studentProfile = ref(null);
const studentList = ref([]);
const classFilters = ref(['全部班级']);
const selectedClassFilter = ref('全部班级');
const studentViewMode = ref('list');
const parentSummary = ref(null);

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
const maxClassOptionValue = computed(() => {
  const values = classAnalysis.value?.questionStats?.flatMap((question) => question.optionDistribution.map((item) => item.value)) || [];
  return Math.max(...values, 1);
});
const lowestMastery = computed(() => {
  if (!studentProfile.value?.mastery?.length) return null;
  return [...studentProfile.value.mastery].sort((a, b) => a.value - b.value)[0];
});

function openRecord(record) {
  selectedQuestionId.value = record.id;
}

async function refreshAnalysis() {
  loading.value = true;
  try {
    const [classResult, listResult, profileResult, parentResult] = await Promise.all([
      getClassLearningAnalysis('class-2026-physics-1'),
      getStudentProfileList({ className: selectedClassFilter.value }),
      getStudentProfile(selectedStudentId.value),
      getParentLearningSummary(selectedStudentId.value)
    ]);
    classAnalysis.value = classResult;
    classFilters.value = listResult.classes;
    studentList.value = listResult.students;
    studentProfile.value = profileResult;
    parentSummary.value = parentResult;
  } finally {
    loading.value = false;
  }
}

async function changeClassFilter(className) {
  selectedClassFilter.value = className;
  loading.value = true;
  try {
    const listResult = await getStudentProfileList({ className });
    classFilters.value = listResult.classes;
    studentList.value = listResult.students;
    studentViewMode.value = 'list';
  } finally {
    loading.value = false;
  }
}

async function openStudentDetail(studentId) {
  selectedStudentId.value = studentId;
  loading.value = true;
  try {
    const [profileResult, parentResult] = await Promise.all([
      getStudentProfile(studentId),
      getParentLearningSummary(studentId)
    ]);
    studentProfile.value = profileResult;
    parentSummary.value = parentResult;
    studentViewMode.value = 'detail';
  } finally {
    loading.value = false;
  }
}

function backToStudentList() {
  studentViewMode.value = 'list';
}

function generatePractice() {
  notify('已根据薄弱点生成推荐练习');
}

onMounted(refreshAnalysis);
</script>

<template>
  <main class="module-page report-page">
    <section class="module-head">
      <div>
        <h1>学情分析</h1>
        <p>承接学生端答题、AI 问答和个性化练习结果，形成班级诊断、学生画像和家长摘要闭环。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn" type="button" :disabled="loading" @click="refreshAnalysis">
          <span class="material-symbols-outlined">refresh</span>
          {{ loading ? '分析中' : '刷新分析' }}
        </button>
        <button class="primary-btn" type="button" @click="notify('已打开全局薄弱点汇总')">
          <span class="material-symbols-outlined">monitoring</span>
          查看全局分析
        </button>
      </div>
    </section>

    <section class="analysis-toolbar">
      <div class="segmented" role="tablist" aria-label="学情分析类型">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
      <span v-if="loading" class="small-chip"><span class="material-symbols-outlined">sync</span>AI 正在更新分析</span>
      <span v-else class="small-chip"><span class="material-symbols-outlined">check_circle</span>{{ classAnalysis?.updatedAt || '刚刚' }}更新</span>
    </section>

    <section v-if="activeTab === 'class' && classAnalysis" class="analysis-tab">
      <section class="metric-grid after-metrics">
        <article class="metric-card"><strong>{{ classAnalysis.avgAccuracy }}%</strong><span>班级平均正确率</span></article>
        <article class="metric-card"><strong>{{ classAnalysis.submitted }}/{{ classAnalysis.totalStudents }}</strong><span>完成人数</span></article>
        <article class="metric-card"><strong>{{ classAnalysis.weakPoints.length }}</strong><span>重点薄弱知识点</span></article>
      </section>

      <section class="analysis-layout">
        <article class="surface-card class-board">
          <header class="section-head">
            <div>
              <span class="small-chip"><span class="material-symbols-outlined">science</span>{{ classAnalysis.lessonName }}</span>
              <h2>{{ classAnalysis.className }} 题目正确率排行</h2>
            </div>
          </header>

          <div v-for="question in classAnalysis.questionStats" :key="question.id" class="question-stat-card">
            <div class="question-stat-main">
              <strong>{{ question.title }}</strong>
              <span>{{ question.weakPoint }} ・ 平均用时 {{ question.avgTime }}</span>
            </div>
            <em>{{ question.accuracy }}%</em>
            <div class="option-bars">
              <div v-for="option in question.optionDistribution" :key="`${question.id}-${option.label}`" class="option-row">
                <span>{{ option.label }}</span>
                <i><b :style="{ width: `${Math.round((option.value / maxClassOptionValue) * 100)}%` }"></b></i>
                <small>{{ option.value }} 人 ・ {{ option.note }}</small>
              </div>
            </div>
          </div>
        </article>

        <aside class="surface-card class-side">
          <h2>班级薄弱点</h2>
          <div v-for="point in classAnalysis.weakPoints" :key="point.id" class="weak-point-card">
            <div>
              <strong>{{ point.name }}</strong>
              <span>{{ point.impact }}</span>
            </div>
            <em>{{ point.accuracy }}%</em>
          </div>
          <article class="ai-advice-card">
            <span class="small-chip"><span class="material-symbols-outlined">auto_awesome</span>AI 教学建议</span>
            <p>{{ classAnalysis.aiAdvice }}</p>
          </article>
        </aside>
      </section>
    </section>

    <section v-if="activeTab === 'student'" class="analysis-tab">
      <article v-if="studentViewMode === 'list'" class="surface-card student-list-panel">
        <header class="section-head">
          <div>
            <span class="small-chip"><span class="material-symbols-outlined">groups</span>学生画像</span>
            <h2>班级学生画像列表</h2>
            <p>默认展示全部学生，老师可按班级筛选，并点击学生进入个人画像详情。</p>
          </div>
          <select class="student-select" :value="selectedClassFilter" @change="changeClassFilter($event.target.value)">
            <option v-for="className in classFilters" :key="className" :value="className">{{ className }}</option>
          </select>
        </header>

        <div class="student-summary-grid">
          <button
            v-for="student in studentList"
            :key="student.id"
            type="button"
            class="student-summary-card"
            @click="openStudentDetail(student.id)"
          >
            <header>
              <div>
                <strong>{{ student.name }}</strong>
                <span>{{ student.className }} ・ 出勤 {{ student.attendance }}</span>
              </div>
              <em>{{ student.avgMastery }}%</em>
            </header>
            <div class="summary-progress">
              <i><b :style="{ width: `${student.avgMastery}%` }"></b></i>
              <span>平均掌握</span>
            </div>
            <article>
              <span>最低掌握</span>
              <strong>{{ student.lowestMastery?.name }} {{ student.lowestMastery?.value }}%</strong>
            </article>
            <div class="tag-cloud compact">
              <span v-for="point in student.weakPoints.slice(0, 3)" :key="point">{{ point }}</span>
            </div>
          </button>
        </div>
      </article>

      <section v-else-if="studentProfile" class="student-layout">
      <article class="surface-card profile-card">
        <header class="section-head">
          <div>
            <span class="small-chip"><span class="material-symbols-outlined">person_search</span>学生画像</span>
            <h2>{{ studentProfile.name }} ・ {{ studentProfile.className }}</h2>
            <p>出勤 {{ studentProfile.attendance }} ・ 已完成 {{ studentProfile.practiceCount }} 道练习</p>
          </div>
          <button class="soft-btn" type="button" @click="backToStudentList">
            <span class="material-symbols-outlined">arrow_back</span>
            返回列表
          </button>
        </header>

        <div class="mastery-list">
          <div v-for="item in studentProfile.mastery" :key="item.knowledgeId" class="mastery-row">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.value }}%</span>
            </div>
            <i><b :style="{ width: `${item.value}%` }"></b></i>
          </div>
        </div>

        <article v-if="lowestMastery" class="profile-focus">
          <span>当前最低掌握</span>
          <strong>{{ lowestMastery.name }} {{ lowestMastery.value }}%</strong>
          <p>{{ studentProfile.aiConversationSummary }}</p>
        </article>
      </article>

      <aside class="surface-card profile-side">
        <h2>错因诊断</h2>
        <div class="tag-cloud">
          <span v-for="point in studentProfile.weakPoints" :key="point">{{ point }}</span>
        </div>
        <ul class="reason-list">
          <li v-for="reason in studentProfile.mistakeReasons" :key="reason">{{ reason }}</li>
        </ul>

        <h2>推荐练习</h2>
        <div v-for="practice in studentProfile.recommendedPractice" :key="practice.id" class="practice-row">
          <div>
            <strong>{{ practice.title }}</strong>
            <span>{{ practice.difficulty }} ・ {{ practice.target }}</span>
          </div>
        </div>
        <button class="primary-btn practice-btn" type="button" @click="generatePractice">
          <span class="material-symbols-outlined">auto_fix_high</span>
          生成推荐练习
        </button>
      </aside>
      </section>
    </section>

    <section v-if="activeTab === 'parent' && parentSummary" class="analysis-tab parent-layout">
      <article class="surface-card parent-card">
        <span class="small-chip"><span class="material-symbols-outlined">family_restroom</span>家长可见摘要</span>
        <h2>{{ parentSummary.studentName }} 本周学习摘要</h2>
        <p>{{ parentSummary.weeklyStatus }}</p>
        <div class="parent-columns">
          <section>
            <h3>已掌握内容</h3>
            <span v-for="item in parentSummary.mastered" :key="item">{{ item }}</span>
          </section>
          <section>
            <h3>需要关注</h3>
            <span v-for="item in parentSummary.needsAttention" :key="item">{{ item }}</span>
          </section>
        </div>
        <article class="parent-suggestion">
          <strong>建议练习</strong>
          <p>{{ parentSummary.suggestion }}</p>
        </article>
      </article>

      <aside class="surface-card privacy-card">
        <span class="material-symbols-outlined">shield</span>
        <h2>低敏报告规则</h2>
        <p>家长摘要只展示个人学习概况、已掌握内容、需关注知识点和练习建议，不展示班级排名，也不展示其他学生信息。</p>
      </aside>
    </section>

    <section v-if="activeTab === 'class'" class="surface-card course-table">
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
.report-page {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 96px;
  scrollbar-gutter: stable;
  scrollbar-width: none;
}

.report-page::-webkit-scrollbar {
  display: none;
}

.report-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.after-metrics {
  margin: 14px 0;
}

.after-metrics :deep(.metric-card) {
  background:
    linear-gradient(135deg, rgba(220, 246, 232, .72), rgba(255, 255, 255, .60)),
    var(--surface-glass);
}

.course-table {
  margin-top: 14px;
  overflow: hidden;
  border-radius: 16px;
}

.analysis-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
}

.analysis-tab {
  margin-top: 14px;
}

.analysis-layout,
.student-layout,
.parent-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--edu-side-panel);
  gap: 16px;
}

.class-board,
.class-side,
.profile-card,
.profile-side,
.parent-card,
.privacy-card {
  border-radius: var(--edu-radius-lg);
  padding: 18px;
}

.student-list-panel {
  border-radius: var(--edu-radius-lg);
  padding: 18px;
}

.student-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.student-summary-card {
  display: grid;
  gap: 14px;
  min-height: 210px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: rgba(255, 255, 255, .64);
  padding: 16px;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.student-summary-card:hover {
  border-color: rgba(47, 172, 102, .34);
  background: rgba(246, 253, 249, .86);
}

.student-summary-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.student-summary-card header div {
  display: grid;
  gap: 6px;
}

.student-summary-card strong {
  font-size: 16px;
}

.student-summary-card header span,
.summary-progress span,
.student-summary-card article span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.student-summary-card header em {
  color: var(--green);
  font-family: var(--font-mono);
  font-size: 24px;
  font-style: normal;
  font-weight: 900;
}

.summary-progress {
  display: grid;
  gap: 7px;
}

.summary-progress i {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(10, 53, 34, .08);
}

.summary-progress b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.student-summary-card article {
  display: grid;
  gap: 6px;
  border: 1px solid rgba(47, 172, 102, .18);
  border-radius: var(--edu-radius-sm);
  background: rgba(235, 249, 240, .66);
  padding: 10px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.section-head h2,
.class-side h2,
.profile-side h2,
.parent-card h2,
.privacy-card h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.2;
}

.section-head p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
}

.question-stat-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 68px;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

.question-stat-card:first-of-type {
  border-top: 0;
}

.question-stat-main {
  display: grid;
  gap: 6px;
}

.question-stat-main strong,
.weak-point-card strong,
.practice-row strong,
.mastery-row strong {
  font-size: 14px;
  line-height: 1.45;
}

.question-stat-main span,
.weak-point-card span,
.practice-row span,
.mastery-row span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.question-stat-card > em,
.weak-point-card em {
  color: var(--green);
  font-family: var(--font-mono);
  font-size: 20px;
  font-style: normal;
  font-weight: 800;
  text-align: right;
}

.option-bars {
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
}

.option-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 160px;
  align-items: center;
  gap: 10px;
  min-height: 24px;
  color: var(--muted);
  font-size: 12px;
}

.option-row i,
.mastery-row i {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(10, 53, 34, .08);
}

.option-row b,
.mastery-row b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.class-side {
  display: grid;
  align-content: start;
  gap: 12px;
}

.weak-point-card,
.practice-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: rgba(255, 255, 255, .58);
}

.ai-advice-card,
.profile-focus,
.parent-suggestion {
  margin-top: 4px;
  border: 1px solid rgba(47, 172, 102, .18);
  border-radius: var(--edu-radius-md);
  background: rgba(235, 249, 240, .78);
  padding: 14px;
}

.ai-advice-card p,
.profile-focus p,
.parent-suggestion p,
.parent-card > p,
.privacy-card p {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.student-select {
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .74);
  padding: 0 12px;
  color: var(--ink);
  font-weight: 700;
  outline: 0;
}

.mastery-list {
  display: grid;
  gap: 13px;
}

.mastery-row {
  display: grid;
  gap: 8px;
}

.mastery-row div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.profile-focus span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.profile-focus strong {
  display: block;
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: 22px;
}

.profile-side {
  display: grid;
  align-content: start;
  gap: 12px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-cloud.compact span {
  min-height: 26px;
  font-size: 11px;
}

.tag-cloud span,
.parent-columns span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  background: rgba(47, 172, 102, .12);
  padding: 0 11px;
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
}

.reason-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

.practice-btn {
  width: 100%;
}

.parent-card {
  min-height: 420px;
}

.parent-card h2 {
  margin-top: 16px;
}

.parent-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.parent-columns section {
  display: flex;
  min-height: 132px;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: rgba(255, 255, 255, .58);
  padding: 14px;
}

.parent-columns h3 {
  width: 100%;
  margin-bottom: 4px;
  font-size: 15px;
}

.privacy-card {
  align-self: start;
}

.privacy-card > .material-symbols-outlined {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 14px;
  background: var(--deep);
  color: #7df0a0;
  font-size: 26px;
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
