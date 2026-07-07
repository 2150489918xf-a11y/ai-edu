<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createQuestion } from '../data/questionBankApiClient';
import { getAnsweredCourseQuestions, getBank, notify, saveGeneratedQuestionsToBank, store } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const generated = ref(false);
const generating = ref(false);
const selecting = ref(false);
const selected = ref([]);
const teacherPrompt = ref('围绕牛顿第二定律，生成适合高一课堂即时检测的题目，重点考查合力、加速度方向和 F=ma 基础应用。');
const selectedAnalysisId = ref('newton-q3');
const generatedDrafts = ref([]);
const bank = computed(() => getBank(route.params.bankId));
const analysisQuestions = computed(() => getAnsweredCourseQuestions(store.selectedCourseId));
const selectedAnalysis = computed(() => store.afterClass.questionAnalysis[selectedAnalysisId.value] || store.afterClass.questionAnalysis['newton-q1']);
const selectedAnalysisQuestion = computed(() => store.questions.find((question) => question.id === selectedAnalysisId.value) || analysisQuestions.value[0] || store.questions[0]);
const generatedQuestions = computed(() => generated.value ? generatedDrafts.value : []);

function createDraftQuestions() {
  return [
    {
      id: 'draft-newton-1',
      type: '单选题',
      stage: '课中',
      difficulty: '基础',
      title: '物体质量不变时，合外力增大到原来的 2 倍，加速度将如何变化？',
      analysis: '根据 F=ma，质量不变时，加速度与合外力成正比。'
    },
    {
      id: 'draft-newton-2',
      type: '单选题',
      stage: '课中',
      difficulty: '理解',
      title: '小车向右运动时受到向左的合外力，下列说法正确的是哪一项？',
      analysis: '加速度方向始终与合外力方向一致，速度方向不一定立刻改变。'
    },
    {
      id: 'draft-newton-3',
      type: '计算题',
      stage: '课后',
      difficulty: '提升',
      title: '质量 1 kg 的木块受到 5 N 水平拉力，同时受到 1 N 摩擦力，求木块加速度。',
      analysis: '合外力为 5N-1N=4N，a=F合/m=4/1=4 m/s²。'
    }
  ];
}

function generate() {
  if (generating.value) return;
  generating.value = true;
  window.setTimeout(() => {
    generatedDrafts.value = createDraftQuestions();
    generated.value = true;
    selecting.value = true;
    selected.value = generatedDrafts.value.map((question) => question.id);
    generating.value = false;
    notify('已生成 6 道牛顿第二定律变式题');
  }, 10000);
}

function regenerate() {
  if (generating.value) return;
  generating.value = true;
  generated.value = false;
  selected.value = [];
  window.setTimeout(() => {
    generatedDrafts.value = createDraftQuestions();
    generated.value = true;
    selecting.value = true;
    selected.value = generatedDrafts.value.map((question) => question.id);
    generating.value = false;
    notify('已重新生成一版题目');
  }, 10000);
}

function toggle(questionId) {
  selected.value = selected.value.includes(questionId)
    ? selected.value.filter((id) => id !== questionId)
    : [...selected.value, questionId];
}

function saveToMockBank() {
  const drafts = generatedDrafts.value.filter((question) => selected.value.includes(question.id));
  const saved = saveGeneratedQuestionsToBank(bank.value.id, drafts);
  const savedCount = saved.length;
  notify(`已保存 ${savedCount} 道题到当前题库`);
  router.push(`/question-banks/${bank.value.id}`);
}
async function saveToBank() {
  const drafts = generatedDrafts.value.filter((question) => selected.value.includes(question.id));
  await Promise.all(drafts.map((question) => createQuestion(route.params.bankId, {
    title: question.title,
    type: question.type,
    stage: question.stage,
    difficulty: question.difficulty,
    options: question.options || [],
    answer: question.answer || '',
    analysis: question.analysis || '',
    knowledge: question.knowledge ? [question.knowledge] : []
  })));
  notify(`已保存 ${drafts.length} 道题到数据库`);
  router.push(`/question-banks/${route.params.bankId}`);
}
</script>

<template>
  <main class="module-page question-page question-generate-page">
    <section class="module-head">
      <div>
        <h1>AI 生成题目</h1>
        <p>{{ bank.title }} ・ 引用学情分析中的薄弱点，生成可直接下发的补救题和变式题。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn back-btn" type="button" @click="router.push(`/question-banks/${bank.id}`)">
          <span class="material-symbols-outlined">chevron_left</span>
          返回题库
        </button>
        <button class="primary-btn" type="button" :disabled="generating" @click="generate">
          <span class="material-symbols-outlined">{{ generating ? 'progress_activity' : 'auto_awesome' }}</span>
          {{ generating ? '生成中' : '生成题目' }}
        </button>
      </div>
    </section>

    <section class="generate-layout">
      <article class="surface-card generate-form">
        <span class="small-chip">生成设置</span>
        <label class="form-label">引用学情分析</label>
        <div class="analysis-reference">
          <button
            v-for="question in analysisQuestions"
            :key="question.id"
            :class="{ active: selectedAnalysisId === question.id }"
            type="button"
            @click="selectedAnalysisId = question.id"
          >
            <strong>{{ question.title }}</strong>
            <span>正确率 {{ question.accuracy }}% ・ {{ question.stage }} ・ {{ question.difficulty }}</span>
          </button>
        </div>
        <div class="analysis-source">
          <span class="small-chip"><span class="material-symbols-outlined">analytics</span>已引用</span>
          <p>{{ selectedAnalysis.advice }}</p>
        </div>
        <label class="form-label">老师生成要求</label>
        <textarea
          v-model="teacherPrompt"
          class="teacher-prompt"
          placeholder="输入题目用途、知识点、难度和课堂场景..."
        ></textarea>
        <label class="form-label">知识点</label>
        <div class="fake-chip-input">
          <span>F=ma ×</span>
          <span>合力方向 ×</span>
          <span>摩擦力参与计算 ×</span>
        </div>
        <label class="form-label">题型与数量</label>
        <div class="choice-grid">
          <button class="active" type="button">单选 3 道</button>
          <button type="button">多选 1 道</button>
          <button type="button">计算 2 道</button>
        </div>
        <label class="form-label">难度分布</label>
        <div class="choice-grid">
          <button class="active" type="button">基础 40%</button>
          <button class="active" type="button">理解 40%</button>
          <button type="button">提升 20%</button>
        </div>
        <button class="outline-generate-btn" type="button" :disabled="generating" @click="generate">
          <span class="material-symbols-outlined">{{ generating ? 'progress_activity' : 'auto_awesome' }}</span>
          {{ generating ? 'AI 正在生成...' : '生成 6 道课堂题' }}
        </button>
      </article>

      <section class="surface-card generated-panel">
        <header>
          <div>
            <span class="small-chip">{{ generated ? '已生成' : '学情引用预览' }}</span>
            <h2>{{ generated ? '可保存进当前题库的题目' : '等待生成题目' }}</h2>
          </div>
          <button
            class="soft-btn"
            type="button"
            :disabled="!generated || generating"
            @click="selecting = !selecting"
          >
            {{ selecting ? '取消选择' : '选择' }}
          </button>
        </header>

        <div v-if="generating" class="generation-loading">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>AI 正在组合题干、选项和解析</strong>
          <p>正在引用「{{ selectedAnalysisQuestion.title }}」的学情分析，补强薄弱知识点。</p>
        </div>

        <div v-else-if="generated" class="list-panel">
          <article v-for="question in generatedQuestions" :key="question.id" class="question-row" :class="{ picking: selecting }">
            <button v-if="selecting" class="select-dot" :class="{ active: selected.includes(question.id) }" type="button" @click="toggle(question.id)">
              <span class="material-symbols-outlined">check</span>
            </button>
            <div>
              <div class="card-meta" style="margin-top:0">
                <span>{{ question.type }}</span>
                <span>{{ question.stage }}</span>
                <span>{{ question.difficulty }}</span>
              </div>
              <h3>{{ question.title }}</h3>
              <p>{{ question.analysis }}</p>
            </div>
            <button class="soft-btn" type="button" @click="router.push(`/questions/${question.id}`)">详情</button>
          </article>
        </div>
        <div v-else class="empty-generate-panel">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>右侧将在生成后展示题目</strong>
          <p>先在左侧补充生成要求，再点击「生成题目」。生成结果保存进当前题库后，回到题库页选择引用到课程。</p>
        </div>

        <footer>
          <span>{{ generated ? `已选择 ${selected.length} 道` : '尚未生成题目' }}</span>
          <button class="primary-btn" type="button" :disabled="!generated || !selected.length" @click="saveToBank">
            保存进当前题库
          </button>
        </footer>
      </section>
    </section>
  </main>
</template>

<style scoped>
.question-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.generate-layout {
  display: grid;
  grid-template-columns: 368px minmax(0, 1fr);
  gap: 18px;
  margin-top: 24px;
}

.generate-form,
.generated-panel {
  border-radius: 16px;
  padding: 22px;
}

.generate-form {
  background:
    linear-gradient(180deg, rgba(220, 246, 232, .72), rgba(255, 255, 255, .72)),
    var(--surface-glass);
}

.analysis-reference {
  display: grid;
  gap: 8px;
}

.analysis-reference button {
  display: grid;
  gap: 6px;
  min-height: 72px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .72);
  padding: 10px 12px;
  text-align: left;
}

.analysis-reference button.active {
  border-color: rgba(31, 181, 95, .56);
  background: rgba(235, 249, 240, .9);
  box-shadow: inset 0 0 0 1px rgba(47, 172, 102, .26);
}

.analysis-reference strong {
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.analysis-reference span {
  color: var(--soft);
  font-size: 11px;
  font-weight: 750;
}

.analysis-source {
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .66);
  padding: 12px;
}

.analysis-source p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.teacher-prompt {
  width: 100%;
  min-height: 118px;
  resize: none;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .72);
  padding: 12px 14px;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
  outline: none;
}

.teacher-prompt:focus {
  border-color: rgba(31, 181, 95, .48);
  box-shadow: 0 0 0 3px rgba(47, 172, 102, .12);
}

.primary-btn:disabled,
.outline-generate-btn:disabled,
.soft-btn:disabled {
  opacity: .72;
}

.generation-loading {
  display: grid;
  min-height: 360px;
  place-items: center;
  align-content: center;
  gap: 12px;
  border: 1px dashed rgba(47, 172, 102, .28);
  border-radius: 16px;
  background: rgba(220, 246, 232, .34);
  text-align: center;
}

.generation-loading .material-symbols-outlined {
  color: var(--green);
  font-size: 34px;
  animation: spin-soft 1.2s linear infinite;
}

.primary-btn:disabled .material-symbols-outlined,
.outline-generate-btn:disabled .material-symbols-outlined {
  animation: spin-soft 1.2s linear infinite;
}

.generation-loading strong {
  font-family: var(--font-serif);
  font-size: 20px;
}

.generation-loading p {
  color: var(--soft);
  font-size: var(--edu-body);
}

.empty-generate-panel {
  display: grid;
  min-height: 430px;
  place-items: center;
  align-content: center;
  gap: 12px;
  border: 1px dashed rgba(16, 55, 35, .18);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(244, 250, 246, .82), rgba(255, 255, 255, .66));
  text-align: center;
}

.empty-generate-panel .material-symbols-outlined {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
  font-size: 26px;
}

.empty-generate-panel strong {
  font-family: var(--font-serif);
  font-size: 22px;
}

.empty-generate-panel p {
  max-width: 420px;
  color: var(--soft);
  font-size: 13px;
  line-height: 1.7;
}

@keyframes spin-soft {
  to {
    transform: rotate(360deg);
  }
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.choice-grid button {
  height: 42px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, .68);
  color: var(--muted);
  font-weight: 700;
}

.choice-grid button.active {
  border-color: var(--green);
  background: var(--mint);
  color: #1f8847;
}

.generated-panel header,
.generated-panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.generated-panel header {
  margin-bottom: 18px;
}

.generated-panel h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 22px;
}

.generated-panel footer {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.question-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.question-row.picking {
  grid-template-columns: 34px minmax(0, 1fr) auto;
}

.select-dot {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: white;
  color: transparent;
}

.select-dot.active {
  border-color: var(--green);
  background: var(--green);
  color: white;
}

.select-dot .material-symbols-outlined {
  font-size: 16px;
}
</style>
