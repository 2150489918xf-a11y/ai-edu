<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiChat from '../../components/AiChat.vue';
import {
  saveStudentAnswer,
  streamStudentPracticeGenerate,
  submitStudentTask
} from '../../data/studentApiClient';

const DEFAULT_STUDENT_ID = 'stu-chenyu';
const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'ai',
  title: 'AI 练习助手',
  text: '告诉我你想练什么，我会在左侧生成题目，你可以直接作答。也可以继续说“再加 2 道”“把第 1 题改简单点”“删掉第 3 题”。'
};

const route = useRoute();
const router = useRouter();
const generating = ref(false);
const saving = ref(false);
const submitting = ref(false);
const error = ref('');
const aiMessages = ref([WELCOME_MESSAGE]);
const questions = ref([]);
const answers = ref({});
const task = ref(null);
const result = ref(null);

const studentId = computed(() => route.query.studentId || DEFAULT_STUDENT_ID);
const courseId = computed(() => route.query.courseId || '');
const answeredCount = computed(() => questions.value.filter((question) => hasAnswer(question.id || question.tempId)).length);
const canSubmit = computed(() => Boolean(task.value?.taskId) && questions.value.length > 0 && answeredCount.value > 0);
const title = computed(() => route.query.courseTitle || 'AI 针对练习');

function backToAnalysis() {
  router.push({ path: '/student/analysis', query: { studentId: studentId.value } });
}

function normalizeTypeLabel(type) {
  if (type === 'choice' || String(type).includes('选择')) return '选择题';
  if (type === 'blank' || String(type).includes('填空')) return '填空题';
  return type || '练习题';
}

function stripProtocolBlocks(text) {
  return String(text || '')
    .replace(/:::practice-op-start\s*[\s\S]*?\s*:::practice-op-end/gi, '')
    .replace(/:::question-start\s*[\s\S]*?\s*:::question-end/gi, '')
    .replace(/:::questions\s*[\s\S]*?\s*:::/gi, '')
    .trim();
}

function parseRequestedCount(text, fallback = 5) {
  const source = String(text || '');
  const numberMatch = source.match(/(\d+)\s*(道|题|个)?/);
  if (numberMatch) return Math.max(1, Math.min(Number(numberMatch[1]), 12));
  const zhMap = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const zhMatch = source.match(/([一两二三四五六七八九十])\s*(道|题|个)/);
  return zhMatch ? (zhMap[zhMatch[1]] || fallback) : fallback;
}

function inferOperation(text) {
  const source = String(text || '');
  if (/删掉|删除|去掉|移除/.test(source)) return 'delete';
  if (/修改|改成|改简单|改难|调整|优化|第\s*\d+\s*题/.test(source)) return 'update';
  if (/重新|重出|换一组|全部换|替换全部/.test(source)) return 'replace';
  if (/再|增加|追加|补|加\s*\d+/.test(source) && questions.value.length) return 'append';
  return questions.value.length ? 'append' : 'replace';
}

function inferQuestionTypes(text) {
  const source = String(text || '');
  if (/选择题|选择|单选|choice/i.test(source)) return ['choice'];
  if (/填空题|填空|blank/i.test(source)) return ['blank'];
  return ['choice', 'blank'];
}

function getQuestionKey(question) {
  return question?.id || question?.tempId || '';
}

function ensureQuestionIdentity(question, index = 0) {
  return {
    ...question,
    tempId: question.id || question.tempId || `temp-${Date.now()}-${index}`
  };
}

function toExistingQuestionPayload() {
  return questions.value.map((question) => ({
    id: question.id || '',
    type: question.type || '',
    difficulty: question.difficulty || '',
    title: question.title || '',
    options: question.options || [],
    knowledge: question.knowledge || []
  }));
}

function buildMessagesForRequest() {
  return aiMessages.value.map((message) => ({
    role: message.role === 'ai' ? 'assistant' : 'user',
    text: message.text || ''
  }));
}

function applyOperation(operation = {}) {
  const action = operation.action || 'append';
  const incoming = (operation.questions || []).map(ensureQuestionIdentity);
  if (action === 'delete') {
    const targets = new Set(operation.targetIndexes || []);
    questions.value = questions.value.filter((_, index) => !targets.has(index + 1));
    return;
  }
  if (action === 'replace' && !(operation.targetIndexes || []).length) {
    questions.value = incoming;
    answers.value = {};
    return;
  }
  if (action === 'append') {
    const titles = new Set(questions.value.map((question) => question.title));
    questions.value = [...questions.value, ...incoming.filter((question) => question.title && !titles.has(question.title))];
    return;
  }
  if (action === 'replace') {
    const next = [...questions.value];
    (operation.targetIndexes || []).forEach((target, index) => {
      if (incoming[index]) next[target - 1] = incoming[index];
    });
    questions.value = next.filter(Boolean);
    return;
  }
  if (action === 'update') {
    const next = [...questions.value];
    (operation.targetIndexes || []).forEach((target, index) => {
      const patch = incoming[index] || incoming[0];
      if (!patch || !next[target - 1]) return;
      next[target - 1] = ensureQuestionIdentity({ ...next[target - 1], ...patch, id: patch.id || '' }, index);
    });
    questions.value = next.filter(Boolean);
  }
}

function getAnswerValue(question) {
  return answers.value[getQuestionKey(question)]?.value || '';
}

function hasAnswer(questionKey) {
  const answer = answers.value[questionKey]?.value;
  return answer !== undefined && answer !== null && String(answer).trim() !== '';
}

function setAnswer(question, value) {
  const key = getQuestionKey(question);
  if (!key) return;
  answers.value = {
    ...answers.value,
    [key]: { value }
  };
}

async function persistAnswer(question) {
  if (!task.value?.taskId || !question?.id || !hasAnswer(question.id)) return;
  saving.value = true;
  try {
    await saveStudentAnswer(studentId.value, task.value.taskId, {
      questionId: question.id,
      answer: answers.value[question.id]
    });
  } catch (err) {
    error.value = err.message || '答案保存失败';
  } finally {
    saving.value = false;
  }
}

async function chooseOption(question, option) {
  setAnswer(question, option);
  await persistAnswer(question);
}

async function submitPractice() {
  if (!task.value?.taskId) return;
  for (const question of questions.value) {
    await persistAnswer(question);
  }
  submitting.value = true;
  try {
    result.value = await submitStudentTask(studentId.value, task.value.taskId);
  } catch (err) {
    error.value = err.message || '提交失败';
  } finally {
    submitting.value = false;
  }
}

async function sendAiMessage(inputText) {
  const text = String(inputText || '').trim();
  if (!text || generating.value || !courseId.value) return;

  const userMessage = { id: `student-${Date.now()}`, role: 'teacher', text };
  const assistantMessage = { id: `ai-${Date.now()}`, role: 'ai', title: '正在处理', text: '' };
  aiMessages.value = [...aiMessages.value, userMessage, assistantMessage];
  generating.value = true;
  error.value = '';
  result.value = null;

  try {
    await streamStudentPracticeGenerate(courseId.value, {
      studentId: studentId.value,
      taskId: task.value?.taskId || '',
      prompt: text,
      count: parseRequestedCount(text),
      operation: inferOperation(text),
      questionTypes: inferQuestionTypes(text),
      existingQuestions: toExistingQuestionPayload(),
      messages: buildMessagesForRequest()
    }, {
      onDelta(delta) {
        assistantMessage.rawText = `${assistantMessage.rawText || ''}${delta}`;
        assistantMessage.text = stripProtocolBlocks(assistantMessage.rawText) || '正在整理题目。';
        aiMessages.value = [...aiMessages.value];
      },
      onOperation(operation) {
        applyOperation(operation);
      },
      onQuestion(question) {
        applyOperation({ action: 'append', questions: [question] });
      },
      onTask(nextTask) {
        task.value = nextTask;
        if (Array.isArray(nextTask.questions)) {
          const nextAnswers = {};
          for (const question of nextTask.questions) {
            const old = questions.value.find((item) => item.title === question.title);
            const oldKey = old?.tempId || old?.id || question.id;
            if (answers.value[oldKey]) nextAnswers[question.id] = answers.value[oldKey];
          }
          questions.value = nextTask.questions.map(ensureQuestionIdentity);
          answers.value = { ...answers.value, ...nextAnswers };
        }
      },
      onDone() {
        assistantMessage.title = '已更新练习';
        assistantMessage.text = `左侧已更新为 ${questions.value.length} 道题，可以直接作答。`;
        aiMessages.value = [...aiMessages.value];
      }
    });
  } catch (err) {
    assistantMessage.title = '处理失败';
    assistantMessage.text = err.message || 'AI 处理失败，请稍后再试。';
    aiMessages.value = [...aiMessages.value];
    error.value = err.message || 'AI 处理失败';
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <main class="student-ai-workbench">
    <section class="student-ai-answer">
      <header class="student-ai-answer-head">
        <button type="button" class="icon-btn" aria-label="返回学情分析" @click="backToAnalysis">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <span class="small-chip">AI 针对练习</span>
          <h1>{{ title }}</h1>
        </div>
        <button type="button" class="submit-btn" :disabled="!canSubmit || submitting" @click="submitPractice">
          <span class="material-symbols-outlined">check</span>
          {{ submitting ? '提交中' : '提交练习' }}
        </button>
      </header>

      <p v-if="error" class="error-text">{{ error }}</p>

      <div class="student-ai-answer-status">
        <strong>{{ questions.length ? `${questions.length} 道题` : '等待 AI 生成题目' }}</strong>
        <span>{{ answeredCount }}/{{ questions.length }} 已作答</span>
        <em v-if="saving">保存中...</em>
        <em v-else-if="result">得分 {{ result.score }}/{{ result.totalScore }} · {{ result.accuracy }}%</em>
      </div>

      <section v-if="!questions.length" class="student-ai-empty">
        <span class="material-symbols-outlined">edit_note</span>
        <strong>右侧告诉 AI 你想练什么</strong>
        <p>生成后题目会出现在这里，直接选择或填写答案。</p>
      </section>

      <section v-else class="student-ai-question-list">
        <article v-for="(question, index) in questions" :key="getQuestionKey(question) || `${question.title}-${index}`" class="student-ai-question-card">
          <header>
            <span>{{ index + 1 }}</span>
            <em>{{ normalizeTypeLabel(question.type) }} · {{ question.difficulty || '练习' }}</em>
          </header>
          <h2>{{ question.title }}</h2>

          <div v-if="question.options?.length" class="student-ai-options">
            <button
              v-for="option in question.options"
              :key="option"
              type="button"
              :disabled="!question.id || saving"
              :class="{ selected: getAnswerValue(question) === option }"
              @click="chooseOption(question, option)"
            >
              {{ option }}
            </button>
          </div>

          <label v-else class="student-ai-blank">
            <span>你的答案</span>
            <textarea
              :value="getAnswerValue(question)"
              :disabled="!question.id"
              placeholder="在这里输入答案"
              @input="setAnswer(question, $event.target.value)"
              @blur="persistAnswer(question)"
            ></textarea>
          </label>
        </article>
      </section>
    </section>

    <AiChat
      class="student-ai-chat"
      title="AI 练习助手"
      :messages="aiMessages"
      :loading="generating"
      :show-thinking="false"
      loading-label="处理中"
      placeholder="告诉 AI 你想练什么，例如：生成 1 道基础选择题..."
      send-label="发送"
      :suggestions="['生成 1 道题', '再加 2 道选择题', '把第 1 题改简单点']"
      @send="sendAiMessage"
    />
  </main>
</template>

<style scoped>
.student-ai-workbench {
  display: grid;
  width: 100%;
  height: 100vh;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
  gap: 14px;
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 8%, rgba(81, 201, 135, .18), transparent 30%),
    var(--wash);
  color: var(--ink);
  padding: 16px;
}

.student-ai-answer,
.student-ai-chat {
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, .78);
  border-radius: 16px;
  background: rgba(255, 255, 255, .76);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.student-ai-answer {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  padding: 16px;
}

.student-ai-answer-head {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid var(--line);
  padding-bottom: 14px;
}

.student-ai-answer-head h1 {
  margin: 6px 0 0;
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn,
.submit-btn {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  background: var(--deep);
  color: #80f3a8;
  padding: 0 14px;
  font-weight: 900;
}

.icon-btn {
  width: 42px;
  padding: 0;
}

button:disabled,
textarea:disabled {
  cursor: default;
  opacity: .52;
}

.error-text {
  margin: 10px 0 0;
  color: #b42318;
  font-weight: 900;
}

.student-ai-answer-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  color: var(--muted);
}

.student-ai-answer-status strong {
  color: var(--ink);
  font-size: 20px;
}

.student-ai-answer-status em {
  margin-left: auto;
  color: var(--green);
  font-style: normal;
  font-weight: 900;
}

.student-ai-empty {
  display: grid;
  min-height: 0;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: var(--muted);
  text-align: center;
}

.student-ai-empty .material-symbols-outlined {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
  font-size: 28px;
}

.student-ai-empty strong {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 24px;
}

.student-ai-empty p {
  margin: 0;
}

.student-ai-question-list {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
}

.student-ai-question-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, .78);
  padding: 14px;
}

.student-ai-question-card header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.student-ai-question-card header span {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 10px;
  background: var(--deep);
  color: white;
  font-weight: 900;
}

.student-ai-question-card header em {
  color: var(--muted);
  font-style: normal;
  font-weight: 800;
}

.student-ai-question-card h2 {
  margin: 12px 0;
  font-size: 18px;
  line-height: 1.55;
}

.student-ai-options {
  display: grid;
  gap: 8px;
}

.student-ai-options button {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(248, 252, 249, .96);
  color: var(--ink);
  padding: 10px 12px;
  text-align: left;
  font-weight: 800;
}

.student-ai-options button.selected {
  border-color: rgba(47, 172, 102, .58);
  background: var(--mint);
  color: var(--green);
}

.student-ai-blank {
  display: grid;
  gap: 8px;
}

.student-ai-blank span {
  color: var(--muted);
  font-weight: 800;
}

.student-ai-blank textarea {
  width: 100%;
  min-height: 100px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 10px;
  outline: none;
  background: rgba(248, 252, 249, .96);
  padding: 10px;
  color: var(--ink);
  line-height: 1.5;
}

.student-ai-chat {
  overflow: hidden;
}

@media (max-width: 980px) {
  .student-ai-workbench {
    height: auto;
    min-height: 100vh;
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .student-ai-answer {
    min-height: 620px;
  }

  .student-ai-chat {
    min-height: 560px;
  }
}

@media (max-width: 640px) {
  .student-ai-answer-head {
    grid-template-columns: 1fr;
  }

  .icon-btn,
  .submit-btn {
    width: 100%;
  }
}
</style>
