<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ExamPaperPreview from '../components/ExamPaperPreview.vue';
import { generateExamPaper, saveExamPaper } from '../data/mockApi';
import { getBank, notify } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const bank = computed(() => getBank(route.params.bankId));
const paper = ref(null);
const generating = ref(false);
const saving = ref(false);
const config = ref({
  type: '随堂测',
  totalQuestions: 10,
  difficultyRatio: { basic: 4, medium: 4, advanced: 2 },
  knowledgePoints: ['牛顿第二定律', '合外力', '加速度方向', '受力分析'],
  priority: '优先覆盖班级薄弱点'
});

const paperStats = computed(() => {
  if (!paper.value) {
    return [
      { label: '题量', value: '10' },
      { label: '预计', value: '20min' },
      { label: '薄弱点', value: '2' }
    ];
  }
  return [
    { label: '题量', value: String(paper.value.totalQuestions) },
    { label: '预计', value: `${paper.value.estimatedMinutes}min` },
    { label: '覆盖', value: `${Math.round(paper.value.knowledgeCoverage.reduce((sum, item) => sum + item.coverage, 0) / paper.value.knowledgeCoverage.length)}%` }
  ];
});

async function generatePaper() {
  if (generating.value) return;
  generating.value = true;
  paper.value = null;
  const result = await generateExamPaper(bank.value.id, config.value);
  paper.value = result.paper;
  generating.value = false;
  notify('已生成牛顿第二定律随堂测');
}

async function savePaper() {
  if (!paper.value || saving.value) return;
  saving.value = true;
  const result = await saveExamPaper(paper.value.id);
  saving.value = false;
  notify(result.message);
}
</script>

<template>
  <main class="module-page question-page paper-page">
    <section class="module-head">
      <div>
        <h1>智能组卷</h1>
        <p>{{ bank.title }} ・ 按知识点、难度比例和班级薄弱点生成一份可预览试卷。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn back-btn" type="button" @click="router.push(`/question-banks/${bank.id}`)">
          <span class="material-symbols-outlined">chevron_left</span>
          返回题库
        </button>
        <button class="primary-btn" type="button" :disabled="generating" @click="generatePaper">
          <span class="material-symbols-outlined">{{ generating ? 'progress_activity' : 'auto_awesome' }}</span>
          {{ generating ? '组卷中' : '生成试卷' }}
        </button>
      </div>
    </section>

    <section class="paper-layout">
      <aside class="surface-card paper-config">
        <span class="small-chip">组卷配置</span>
        <label class="form-label">试卷类型</label>
        <div class="segmented paper-segmented">
          <button
            v-for="type in ['随堂测', '单元测', '课后练习']"
            :key="type"
            :class="{ active: config.type === type }"
            type="button"
            @click="config.type = type"
          >
            {{ type }}
          </button>
        </div>

        <label class="form-label">题量</label>
        <div class="paper-number">
          <strong>{{ config.totalQuestions }}</strong>
          <span>题 ・ 预计 20 分钟</span>
        </div>

        <label class="form-label">难度比例</label>
        <div class="difficulty-bars">
          <div>
            <span>基础 40%</span>
            <i style="--value:40%"></i>
          </div>
          <div>
            <span>理解 40%</span>
            <i style="--value:40%"></i>
          </div>
          <div>
            <span>提升 20%</span>
            <i style="--value:20%"></i>
          </div>
        </div>

        <label class="form-label">知识点</label>
        <div class="fake-chip-input paper-chip-input">
          <span v-for="point in config.knowledgePoints" :key="point">{{ point }} ×</span>
        </div>

        <label class="form-label">优先策略</label>
        <button class="priority-card active" type="button">
          <span class="material-symbols-outlined">psychology</span>
          <strong>{{ config.priority }}</strong>
          <small>优先补强合外力计算、加速度方向两个班级薄弱点。</small>
        </button>

        <button class="outline-generate-btn" type="button" :disabled="generating" @click="generatePaper">
          <span class="material-symbols-outlined">{{ generating ? 'progress_activity' : 'auto_awesome' }}</span>
          {{ generating ? '正在匹配题目...' : '生成 10 题试卷' }}
        </button>
      </aside>

      <section class="surface-card paper-preview">
        <header>
          <div>
            <span class="small-chip">{{ paper ? '试卷预览' : '等待生成' }}</span>
            <h2>{{ paper ? paper.title : '牛顿第二定律随堂测' }}</h2>
          </div>
          <div class="paper-stats">
            <span v-for="stat in paperStats" :key="stat.label">
              <strong>{{ stat.value }}</strong>
              {{ stat.label }}
            </span>
          </div>
        </header>

        <div v-if="generating" class="paper-loading">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>AI 正在匹配知识点、平衡难度、检查重复题</strong>
          <p>正在围绕合外力计算、加速度方向和 F=ma 应用生成试卷结构。</p>
        </div>

        <div v-else-if="paper" class="exam-preview-wrap">
          <ExamPaperPreview :paper="paper" />
        </div>

        <div v-else class="empty-paper">
          <span class="material-symbols-outlined">assignment</span>
          <strong>尚未生成试卷</strong>
          <p>左侧配置已按牛顿第二定律课堂检测预填，点击“生成试卷”后显示 10 题结构。</p>
        </div>

        <footer>
          <span>{{ paper ? `已生成 ${paper.totalQuestions} 题，可保存到当前题库` : '生成后可保存试卷' }}</span>
          <button class="primary-btn" type="button" :disabled="!paper || saving" @click="savePaper">
            {{ saving ? '保存中' : '保存试卷' }}
          </button>
        </footer>
      </section>

      <aside class="surface-card paper-report">
        <span class="small-chip">覆盖率与质量</span>
        <h2>{{ paper ? '组卷检查通过' : '待生成' }}</h2>
        <p>{{ paper ? '当前试卷覆盖核心知识点，并按薄弱点做了题目倾斜。' : '生成后展示知识点覆盖率、难度分布和质量检查。' }}</p>

        <section class="report-block">
          <h3>知识点覆盖</h3>
          <div
            v-for="item in paper?.knowledgeCoverage || []"
            :key="item.id"
            class="coverage-row"
          >
            <span>{{ item.name }}</span>
            <strong>{{ item.coverage }}%</strong>
            <i :style="{ '--value': `${item.coverage}%` }"></i>
          </div>
          <div v-if="!paper" class="muted-list">
            <span>牛顿第二定律</span>
            <span>合外力</span>
            <span>加速度方向</span>
            <span>受力分析</span>
          </div>
        </section>

        <section class="report-block">
          <h3>难度分布</h3>
          <div class="difficulty-summary">
            <span v-for="item in paper?.difficultyDistribution || []" :key="item.label">
              <strong>{{ item.value }}</strong>
              {{ item.label }}
            </span>
          </div>
        </section>

        <section class="report-block">
          <h3>质量检查</h3>
          <div v-if="paper" class="quality-list">
            <span v-for="item in paper.qualityChecks" :key="item.label">
              <i class="material-symbols-outlined">check_circle</i>
              {{ item.label }}
            </span>
          </div>
          <div v-else class="quality-list muted">
            <span><i class="material-symbols-outlined">radio_button_unchecked</i>等待生成</span>
          </div>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.question-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.paper-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  margin-top: 24px;
}

.paper-config,
.paper-preview,
.paper-report {
  padding: 22px;
}

.paper-config {
  background:
    linear-gradient(180deg, rgba(220, 246, 232, .72), rgba(255, 255, 255, .72)),
    var(--surface-glass);
}

.paper-segmented {
  width: 100%;
}

.paper-number {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: rgba(255, 255, 255, .72);
  padding: 0 14px;
}

.paper-number strong {
  font-family: var(--font-mono);
  font-size: 28px;
}

.paper-number span,
.paper-report p,
.paper-preview footer {
  color: var(--muted);
  font-size: 13px;
}

.difficulty-bars {
  display: grid;
  gap: 10px;
}

.difficulty-bars div,
.coverage-row {
  display: grid;
  gap: 8px;
}

.difficulty-bars span,
.coverage-row span,
.coverage-row strong {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.difficulty-bars i,
.coverage-row i {
  display: block;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(16, 55, 35, .1);
}

.difficulty-bars i::after,
.coverage-row i::after {
  display: block;
  width: var(--value);
  height: 100%;
  border-radius: inherit;
  background: var(--green);
  content: '';
}

.paper-chip-input {
  min-height: auto;
}

.priority-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 8px 10px;
  width: 100%;
  min-height: 92px;
  border: 1px solid rgba(31, 181, 95, .44);
  border-radius: var(--edu-radius-md);
  background: rgba(235, 249, 240, .88);
  padding: 12px;
  text-align: left;
}

.priority-card .material-symbols-outlined {
  grid-row: span 2;
  color: var(--green);
}

.priority-card strong {
  color: var(--ink);
  font-size: 13px;
}

.priority-card small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}

.paper-preview header,
.paper-preview footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.paper-preview h2,
.paper-report h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 22px;
}

.paper-stats,
.difficulty-summary {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.paper-stats span,
.difficulty-summary span {
  display: grid;
  min-width: 72px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: rgba(255, 255, 255, .72);
  padding: 8px 10px;
  color: var(--soft);
  font-size: 11px;
  font-weight: 800;
}

.paper-stats strong,
.difficulty-summary strong {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 18px;
}

.paper-loading,
.empty-paper {
  display: grid;
  min-height: 430px;
  place-items: center;
  align-content: center;
  gap: 12px;
  margin-top: 18px;
  border: 1px dashed rgba(47, 172, 102, .28);
  border-radius: var(--edu-radius-md);
  background: rgba(220, 246, 232, .34);
  text-align: center;
}

.paper-loading .material-symbols-outlined,
.empty-paper .material-symbols-outlined {
  color: var(--green);
  font-size: 34px;
}

.paper-loading .material-symbols-outlined,
.primary-btn:disabled .material-symbols-outlined,
.outline-generate-btn:disabled .material-symbols-outlined {
  animation: spin-soft 1.2s linear infinite;
}

.paper-loading strong,
.empty-paper strong {
  font-family: var(--font-serif);
  font-size: 20px;
}

.paper-loading p,
.empty-paper p {
  max-width: 430px;
  color: var(--soft);
  font-size: 13px;
  line-height: 1.7;
}

.exam-preview-wrap {
  overflow-x: auto;
  padding-bottom: 2px;
}

.paper-preview footer {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-weight: 800;
}

.report-block {
  display: grid;
  gap: 12px;
  margin-top: 22px;
}

.report-block h3 {
  color: var(--ink);
  font-size: 14px;
}

.coverage-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.coverage-row i {
  grid-column: 1 / -1;
}

.muted-list,
.quality-list {
  display: grid;
  gap: 8px;
}

.muted-list span,
.quality-list span {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: rgba(255, 255, 255, .64);
  padding: 0 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.quality-list i {
  color: var(--green);
  font-size: 17px;
}

.quality-list.muted i {
  color: var(--soft);
}

@keyframes spin-soft {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 900px) {
  .paper-layout {
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  }

  .paper-report {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .paper-layout {
    grid-template-columns: 312px minmax(0, 1fr) var(--edu-side-panel);
  }

  .paper-report {
    grid-column: auto;
  }
}
</style>
