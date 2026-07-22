<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiChat from '../components/AiChat.vue';
import { parseQuestionsFromAiText } from '../data/aiQuestionParser';
import { createQuestion, generateAiQuestions, getQuestionBank, streamAiQuestions } from '../data/questionBankApiClient';
import { fetchCourseAnalysisReportContext } from '../data/courseAnalysisApiClient.js';
import { getAnsweredCourseQuestions, getBank, notify, store } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const chatLoading = ref(false);
const saving = ref(false);
const selected = ref([]);
const candidateQuestions = ref([]);
const currentBank = ref(getBank(route.params.bankId));
const analysisReportId = ref(String(route.query.analysisReportId || ''));
const analysisReportContext = ref(null);
const selectedAnalysisId = ref('newton-q3');
const editingQuestionId = ref('');
const aiMessages = ref([
  {
    role: 'ai',
    title: '题目生成助手',
    text: '你可以直接描述题目要求。我会把回复中的结构化题目解析成候选卡片，勾选后可保存进当前题库。'
  }
]);

const analysisQuestions = computed(() => getAnsweredCourseQuestions(store.selectedCourseId));
const selectedAnalysis = computed(() => store.afterClass.questionAnalysis[selectedAnalysisId.value] || store.afterClass.questionAnalysis['newton-q1']);
const selectedAnalysisQuestion = computed(() => store.questions.find((question) => question.id === selectedAnalysisId.value) || analysisQuestions.value[0] || store.questions[0]);
const selectedQuestions = computed(() => candidateQuestions.value.filter((question) => selected.value.includes(question.id)));
const editingQuestion = computed(() => candidateQuestions.value.find((question) => question.id === editingQuestionId.value) || null);
const candidateLoading = computed(() => chatLoading.value && !candidateQuestions.value.length);

function stripQuestionBlocks(text) {
  return String(text)
    .replace(/:::questions\s*[\s\S]*?\s*:::/gi, '')
    .replace(/:::question-start\s*[\s\S]*?\s*:::question-end/gi, '')
    .trim();
}

function buildAiReply(inputText) {
  const wantsCalculation = /计算|合外力|摩擦|加速度/.test(inputText);
  const questions = [
    {
      type: '单选题',
      stage: '课中',
      difficulty: '基础',
      title: '物体质量不变时，合外力增大到原来的 2 倍，加速度将如何变化？',
      options: ['变为原来的 2 倍', '变为原来的一半', '保持不变', '无法判断'],
      answer: '变为原来的 2 倍',
      analysis: '根据 F=ma，质量不变时，加速度与合外力成正比。',
      knowledge: ['F=ma', '合外力']
    },
    {
      type: '单选题',
      stage: '课中',
      difficulty: '理解',
      title: '小车向右运动时受到向左的合外力，下列说法正确的是哪一项？',
      options: ['加速度向左', '速度立刻向左', '合外力为零', '质量变小'],
      answer: '加速度向左',
      analysis: '加速度方向始终与合外力方向一致，速度方向不一定立即改变。',
      knowledge: ['加速度方向', '合外力方向']
    },
    {
      type: wantsCalculation ? '计算题' : '单选题',
      stage: '课后',
      difficulty: '提升',
      title: '质量 1 kg 的木块受到 5 N 水平拉力，同时受到 1 N 摩擦力，求木块加速度。',
      options: [],
      answer: '4 m/s²',
      analysis: '合外力为 5N-1N=4N，a=F合/m=4/1=4 m/s²。',
      knowledge: ['合外力计算', 'F=ma']
    }
  ];

  return [
    '我根据你的要求生成了 3 道可入库题目，已优先覆盖 F=ma、合外力方向和含摩擦力计算。',
    ':::questions',
    JSON.stringify(questions, null, 2),
    ':::'
  ].join('\n');
}

function addParsedQuestions(rawReply, parsedQuestions = null) {
  const parsed = Array.isArray(parsedQuestions) && parsedQuestions.length
    ? parsedQuestions
    : parseQuestionsFromAiText(rawReply);
  if (!parsed.length) {
    notify('AI 回复中没有识别到结构化题目');
    return;
  }

  const existingTitles = new Set(candidateQuestions.value.map((question) => question.title));
  const timestamp = Date.now();
  const additions = parsed
    .filter((question) => !existingTitles.has(question.title))
    .map((question, index) => ({
      ...question,
      id: `ai-candidate-${timestamp}-${index + 1}`
    }));

  candidateQuestions.value = [...additions, ...candidateQuestions.value];
  selected.value = [...new Set([...additions.map((question) => question.id), ...selected.value])];
  notify(`已解析 ${additions.length} 道候选题`);
}

function appendCandidateQuestion(question) {
  if (!question?.title) return;
  const existing = candidateQuestions.value.some((item) => item.title === question.title);
  if (existing) return;
  const id = `ai-candidate-${Date.now()}-${candidateQuestions.value.length + 1}`;
  candidateQuestions.value = [{ ...question, id }, ...candidateQuestions.value];
  selected.value = [...new Set([id, ...selected.value])];
}

function replaceEditingQuestion(rawReply, parsedQuestions = null) {
  const parsed = Array.isArray(parsedQuestions) && parsedQuestions.length
    ? parsedQuestions
    : parseQuestionsFromAiText(rawReply);
  const nextQuestion = parsed[0];
  if (!editingQuestion.value || !nextQuestion) return false;

  candidateQuestions.value = candidateQuestions.value.map((question) => (
    question.id === editingQuestion.value.id
      ? { ...question, ...nextQuestion, id: question.id }
      : question
  ));
  selected.value = [...new Set([...selected.value, editingQuestion.value.id])];
  notify('已替换当前编辑题目');
  editingQuestionId.value = '';
  return true;
}

function replaceEditingQuestionWithQuestion(question) {
  if (!editingQuestion.value || !question?.title) return false;
  const targetId = editingQuestion.value.id;
  candidateQuestions.value = candidateQuestions.value.map((item) => (
    item.id === targetId ? { ...item, ...question, id: targetId } : item
  ));
  selected.value = [...new Set([...selected.value, targetId])];
  editingQuestionId.value = '';
  notify('已替换当前编辑题目');
  return true;
}

function getOrdinalEditingQuestion(text) {
  const match = String(text).match(/第\s*([一二三四五六七八九十\d]+)\s*题/);
  if (!match) return null;
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const index = Number(match[1]) || map[match[1]];
  return Number.isFinite(index) ? candidateQuestions.value[index - 1] : null;
}

function getRequestMode(text) {
  if (editingQuestion.value || getOrdinalEditingQuestion(text)) return 'edit';
  return /修改|优化|改成|改为|降低|提高|重写|替换/.test(text) && candidateQuestions.value.length ? 'edit' : 'generate';
}

function buildStructuredPrompt() {
  return [
    `围绕${currentBank.value?.title || '当前题库'}生成课堂检测题。`,
    `重点参考学情：${selectedAnalysisQuestion.value?.title || '当前薄弱点'}。`,
    '题型数量：单选 3 道，多选 1 道，计算 2 道。',
    '难度分布：基础 40%，理解 40%，提升 20%。'
  ].join('\n');
}

function startEditingQuestion(question) {
  editingQuestionId.value = question.id;
  notify('已选中题目，可在右侧输入修改要求');
}

function buildAiRequest(text, mode) {
  return {
    prompt: text,
    mode,
    analysisReportId: analysisReportId.value || undefined,
    analysis: {
      id: selectedAnalysisId.value,
      title: selectedAnalysisQuestion.value?.title || '',
      accuracy: selectedAnalysisQuestion.value?.accuracy ?? null,
      detail: selectedAnalysis.value || {}
    },
    candidateQuestions: candidateQuestions.value,
    editingQuestion: mode === 'edit' ? editingQuestion.value : null,
    messages: aiMessages.value.map((message) => ({
      role: message.role,
      text: message.text
    }))
  };
}

function handleStreamQuestion(question, mode) {
  if (mode === 'edit' && replaceEditingQuestionWithQuestion(question)) return;
  appendCandidateQuestion(question);
}

function getCleanStreamingText(text) {
  const cleaned = stripQuestionBlocks(text);
  return cleaned.includes(':::question') || cleaned.includes(':::questions') ? '' : cleaned;
}

async function sendAiMessage(inputText) {
  const text = String(inputText || '').trim();
  if (!text || chatLoading.value) return;

  aiMessages.value.push({ role: 'teacher', text });
  chatLoading.value = true;
  try {
    const ordinalQuestion = getOrdinalEditingQuestion(text);
    if (!editingQuestion.value && ordinalQuestion) {
      editingQuestionId.value = ordinalQuestion.id;
    }
    const mode = getRequestMode(text);
    const request = buildAiRequest(text, mode);
    const assistantMessage = {
      role: 'ai',
      title: 'AI 正在生成',
      text: ''
    };
    aiMessages.value.push(assistantMessage);
    await streamAiQuestions(route.params.bankId, request, {
      onDelta: (delta) => {
        assistantMessage.rawText = `${assistantMessage.rawText || ''}${delta}`;
        assistantMessage.text = getCleanStreamingText(assistantMessage.rawText) || '正在逐题解析，完整题目会直接进入候选区。';
      },
      onQuestion: (question) => {
        handleStreamQuestion(question, mode);
      },
      onDone: (meta) => {
        assistantMessage.title = [meta.provider, meta.model].filter(Boolean).join(' · ') || 'AI 已生成';
        assistantMessage.text = stripQuestionBlocks(assistantMessage.text) || '已逐题解析到候选区。';
      }
    });
  } catch (error) {
    try {
      const mode = getRequestMode(text);
      const result = await generateAiQuestions(route.params.bankId, buildAiRequest(text, mode));
      const rawReply = result.reply || '';
      const modelLabel = [result.provider, result.model].filter(Boolean).join(' · ');
      aiMessages.value.push({
        role: 'ai',
        title: `${modelLabel || 'AI 已生成'} · 非流式`,
        text: stripQuestionBlocks(rawReply) || 'AI 已返回结构化题目，请在候选区确认后保存。'
      });
      if (mode === 'edit' && replaceEditingQuestion(rawReply, result.questions)) return;
      addParsedQuestions(rawReply, result.questions);
    } catch (fallbackError) {
      notify(fallbackError.message || error.message || 'AI 题目生成失败');
      aiMessages.value.push({
        role: 'ai',
        title: '生成失败',
        text: fallbackError.message || error.message || 'AI 题目生成失败，请检查后端 AI 配置。'
      });
    }
  } finally {
    chatLoading.value = false;
  }
}

function generate() {
  sendAiMessage(buildStructuredPrompt());
}

function regenerate() {
  sendAiMessage('请基于当前候选题再生成一组不同题干，增加一道计算题，并保持难度分层。');
}

function toggle(questionId) {
  selected.value = selected.value.includes(questionId)
    ? selected.value.filter((id) => id !== questionId)
    : [...selected.value, questionId];
}

async function saveToBank() {
  const drafts = selectedQuestions.value;
  if (!drafts.length || saving.value) return;
  saving.value = true;
  try {
    await Promise.all(drafts.map((question) => createQuestion(route.params.bankId, {
      title: question.title,
      type: question.type,
      stage: question.stage,
      difficulty: question.difficulty,
      options: question.options || [],
      answer: question.answer || '',
      analysis: question.analysis || '',
      knowledge: question.knowledge || []
    })));
    notify(`已保存 ${drafts.length} 道题到数据库`);
    router.push(`/question-banks/${route.params.bankId}`);
  } catch (error) {
    notify(error.message || '保存题目失败');
  } finally {
    saving.value = false;
  }
}

async function loadBank() {
  try {
    currentBank.value = await getQuestionBank(route.params.bankId);
  } catch {
    currentBank.value = getBank(route.params.bankId);
  }
}

async function loadAnalysisReportContext() {
  analysisReportId.value = String(route.query.analysisReportId || '');
  if (!analysisReportId.value) { analysisReportContext.value = null; return; }
  try {
    analysisReportContext.value = await fetchCourseAnalysisReportContext(analysisReportId.value);
  } catch (error) {
    analysisReportContext.value = null;
    notify(error.message || '引用的学情报告加载失败');
  }
}

function removeAnalysisReportReference() {
  analysisReportId.value = '';
  analysisReportContext.value = null;
}

onMounted(() => { loadBank(); loadAnalysisReportContext(); });
watch(() => route.params.bankId, loadBank);
</script>

<template>
  <main class="module-page question-page question-generate-page">
    <section class="module-head">
      <div>
        <h1>AI 生成题目</h1>
        <p>{{ currentBank.title }} · 与 AI 对话生成题目，系统会解析回复中的题目并保存到数据库。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn back-btn" type="button" @click="router.push(`/question-banks/${route.params.bankId}`)">
          <span class="material-symbols-outlined">chevron_left</span>
          返回题库
        </button>
        <button class="primary-btn" type="button" :disabled="chatLoading" @click="generate">
          <span class="material-symbols-outlined">{{ chatLoading ? 'progress_activity' : 'auto_awesome' }}</span>
          {{ chatLoading ? '生成中' : '生成题目' }}
        </button>
      </div>
    </section>

    <section class="ai-question-layout">
      <article class="surface-card generate-form">
        <div v-if="analysisReportContext" class="analysis-reference-chip">
          <span class="material-symbols-outlined">insights</span>
          <div><strong>已引用学情报告</strong><p>{{ analysisReportContext.course?.title }} · 将按薄弱点生成题目</p></div>
          <button type="button" aria-label="移除学情报告引用" @click="removeAnalysisReportReference"><span class="material-symbols-outlined">close</span></button>
        </div>
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
            <span>正确率 {{ question.accuracy }}% · {{ question.stage }} · {{ question.difficulty }}</span>
          </button>
        </div>
        <div class="analysis-source">
          <span class="small-chip"><span class="material-symbols-outlined">analytics</span>已引用</span>
          <p>{{ selectedAnalysis.advice }}</p>
        </div>
        <div class="settings-note">
          <span class="material-symbols-outlined">chat</span>
          <p>自然语言要求请直接在右侧 AI 输入框里补充；左侧只保留可复用的生成参数。</p>
        </div>
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
        <button class="outline-generate-btn" type="button" :disabled="chatLoading" @click="generate">
          <span class="material-symbols-outlined">{{ chatLoading ? 'progress_activity' : 'auto_awesome' }}</span>
          {{ chatLoading ? 'AI 正在生成...' : '按当前设置生成' }}
        </button>
      </article>

      <section class="surface-card generated-panel">
        <header>
          <div>
            <span class="small-chip">候选题</span>
            <h2>{{ candidateQuestions.length ? '可保存进当前题库的题目' : '等待 AI 解析题目' }}</h2>
          </div>
          <button class="soft-btn" type="button" :disabled="chatLoading" @click="regenerate">
            再生成一组
          </button>
        </header>

        <div v-if="editingQuestion" class="editing-context">
          <span class="material-symbols-outlined">edit_note</span>
          <p>正在编辑：{{ editingQuestion.title }}</p>
          <button type="button" @click="editingQuestionId = ''">取消</button>
        </div>

        <div v-if="candidateLoading" class="generation-loading">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>AI 正在组织题干、选项和解析</strong>
          <p>正在引用“{{ selectedAnalysisQuestion.title }}”的学情分析，补强薄弱知识点。</p>
        </div>

        <div v-else-if="candidateQuestions.length" class="list-panel">
          <article
            v-for="question in candidateQuestions"
            :key="question.id"
            class="question-row picking"
            :class="{ editing: editingQuestionId === question.id }"
          >
            <button class="select-dot" :class="{ active: selected.includes(question.id) }" type="button" @click="toggle(question.id)">
              <span class="material-symbols-outlined">check</span>
            </button>
            <div>
              <div class="card-meta" style="margin-top:0">
                <span>{{ question.type }}</span>
                <span>{{ question.stage }}</span>
                <span>{{ question.difficulty }}</span>
              </div>
              <h3>{{ question.title }}</h3>
              <p>{{ question.options?.length ? question.options.join('　') : question.analysis }}</p>
              <p class="candidate-answer">答案：{{ question.answer || '待补充' }}</p>
            </div>
            <div class="question-actions">
              <button class="soft-btn" type="button" @click="startEditingQuestion(question)">编辑这题</button>
              <button class="soft-btn" type="button" @click="notify(question.analysis || '暂无解析')">解析</button>
            </div>
          </article>
        </div>
        <div v-else class="empty-generate-panel">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>AI 回复中的题目会出现在这里</strong>
          <p>右侧对话或左侧生成按钮都会触发解析器。识别出的题目先进入候选区，老师确认后再入库。</p>
        </div>

        <footer>
          <span>已选择 {{ selected.length }} 道</span>
          <button class="primary-btn" type="button" :disabled="!selected.length || saving" @click="saveToBank">
            {{ saving ? '保存中' : '保存进当前题库' }}
          </button>
        </footer>
      </section>

      <AiChat
        class="question-ai-chat"
        title="AI 出题助手"
        :messages="aiMessages"
        :loading="chatLoading"
        :show-thinking="false"
        loading-label="生成中"
        placeholder="继续告诉 AI：题型、难度、知识点或要避开的错误..."
        send-label="发送"
        :suggestions="['再出 3 道计算题', '降低难度', '围绕合外力方向出题']"
        @send="sendAiMessage"
      />
    </section>
  </main>
</template>

<style scoped>
.analysis-reference-chip{display:grid;grid-template-columns:28px 1fr 32px;align-items:center;gap:10px;margin-bottom:14px;border:1px solid rgba(31,181,95,.28);border-radius:12px;background:#edf8f1;padding:11px;color:#177c46}.analysis-reference-chip p{margin-top:3px;color:var(--muted);font-size:11px}.analysis-reference-chip>button{width:30px;height:30px;border:0;border-radius:50%;background:#fff;color:var(--muted)}
.question-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.question-generate-page {
  --question-workspace-height: calc(100vh - 178px);
}

.ai-question-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  margin-top: 24px;
}

.generate-form,
.generated-panel {
  border-radius: 16px;
  padding: 22px;
}

.generate-form {
  height: auto;
  min-height: 0;
  overflow-y: auto;
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

.settings-note {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .72);
  padding: 12px;
}

.settings-note .material-symbols-outlined {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  background: var(--mint);
  color: var(--green);
  font-size: 18px;
}

.settings-note p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

.primary-btn:disabled,
.outline-generate-btn:disabled,
.soft-btn:disabled {
  opacity: .72;
}

.generation-loading,
.empty-generate-panel {
  display: grid;
  min-height: 360px;
  place-items: center;
  align-content: center;
  gap: 12px;
  border-radius: 16px;
  text-align: center;
}

.generation-loading {
  border: 1px dashed rgba(47, 172, 102, .28);
  background: rgba(220, 246, 232, .34);
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

.generation-loading strong,
.empty-generate-panel strong {
  font-family: var(--font-serif);
  font-size: 20px;
}

.generation-loading p,
.empty-generate-panel p {
  max-width: 420px;
  color: var(--soft);
  font-size: 13px;
  line-height: 1.7;
}

.empty-generate-panel {
  border: 1px dashed rgba(16, 55, 35, .18);
  background:
    linear-gradient(135deg, rgba(244, 250, 246, .82), rgba(255, 255, 255, .66));
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
  min-height: 42px;
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

.generated-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
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

.generated-panel .list-panel {
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.editing-context {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  border: 1px solid rgba(47, 172, 102, .28);
  border-radius: 10px;
  background: rgba(220, 246, 232, .42);
  padding: 10px 12px;
  color: var(--muted);
  font-size: 13px;
}

.editing-context .material-symbols-outlined {
  color: var(--green);
  font-size: 20px;
}

.editing-context p {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editing-context button {
  min-height: 32px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: white;
  color: var(--muted);
  padding: 0 10px;
  font-weight: 700;
}

.question-row.picking {
  grid-template-columns: 34px minmax(0, 1fr) auto;
}

.question-row.editing {
  border-color: rgba(47, 172, 102, .48);
  background: rgba(244, 250, 246, .88);
  box-shadow: inset 0 0 0 1px rgba(47, 172, 102, .20);
}

.question-actions {
  display: grid;
  gap: 8px;
  align-content: start;
}

.question-actions .soft-btn {
  min-height: 36px;
  white-space: nowrap;
}

.candidate-answer {
  margin-top: 8px;
  color: var(--green);
  font-weight: 700;
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

.question-ai-chat {
  height: min(680px, var(--question-workspace-height));
  min-height: 560px;
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
}

@media (min-width: 1024px) {
  .ai-question-layout {
    grid-template-columns: minmax(280px, 330px) minmax(0, 1fr);
  }

  .question-ai-chat {
    grid-column: 1 / -1;
    height: min(620px, var(--question-workspace-height));
  }
}

@media (min-width: 1280px) {
  .ai-question-layout {
    grid-template-columns: minmax(280px, 330px) minmax(0, 1fr) minmax(320px, 360px);
    align-items: stretch;
    height: var(--question-workspace-height);
  }

  .generate-form,
  .generated-panel,
  .question-ai-chat {
    height: var(--question-workspace-height);
  }

  .question-ai-chat {
    grid-column: auto;
    min-height: 0;
  }
}
</style>
