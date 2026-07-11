<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getStudentTask,
  saveStudentAnswer,
  streamStudentAiChat,
  submitStudentTask
} from '../../data/studentApiClient';

const DEFAULT_STUDENT_ID = 'stu-chenyu';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const submitting = ref(false);
const aiLoading = ref(false);
const error = ref('');
const task = ref(null);
const currentIndex = ref(0);
const answers = ref({});
const result = ref(null);
const aiDraft = ref('');
const aiMessages = ref([
  {
    id: 'welcome',
    role: 'ai',
    text: '遇到卡住的地方可以问我。我会先提示思路，不会直接替你写答案。'
  }
]);
const chatFeedRef = ref(null);

const studentId = computed(() => route.query.studentId || DEFAULT_STUDENT_ID);
const taskId = computed(() => route.params.taskId);
const returnCourseGroupId = computed(() => {
  const explicit = Array.isArray(route.query.returnGroupId) ? route.query.returnGroupId[0] : route.query.returnGroupId;
  return explicit || task.value?.course?.groupId || task.value?.course?.id || '';
});
const questions = computed(() => task.value?.questions || []);
const currentQuestion = computed(() => questions.value[currentIndex.value] || null);
const currentAnswer = computed(() => currentQuestion.value ? answers.value[currentQuestion.value.id]?.value || '' : '');
const answeredCount = computed(() => questions.value.filter((question) => hasAnswer(question.id)).length);
const canGoPrev = computed(() => currentIndex.value > 0);
const canGoNext = computed(() => currentIndex.value < questions.value.length - 1);

function hasAnswer(questionId) {
  const answer = answers.value[questionId]?.value;
  return answer !== undefined && answer !== null && String(answer).trim() !== '';
}

function setAnswer(questionId, value) {
  answers.value = {
    ...answers.value,
    [questionId]: { value }
  };
}

async function persistQuestion(question = currentQuestion.value) {
  if (!question || !hasAnswer(question.id)) return;
  saving.value = true;
  try {
    await saveStudentAnswer(studentId.value, taskId.value, {
      questionId: question.id,
      answer: answers.value[question.id]
    });
  } catch (err) {
    error.value = err.message || '答案保存失败';
  } finally {
    saving.value = false;
  }
}

async function chooseOption(option) {
  if (!currentQuestion.value) return;
  setAnswer(currentQuestion.value.id, option);
  await persistQuestion(currentQuestion.value);
}

async function goPrev() {
  await persistQuestion();
  if (canGoPrev.value) currentIndex.value -= 1;
}

async function goNext() {
  await persistQuestion();
  if (canGoNext.value) currentIndex.value += 1;
}

async function submitTask() {
  await persistQuestion();
  submitting.value = true;
  try {
    result.value = await submitStudentTask(studentId.value, taskId.value);
  } catch (err) {
    error.value = err.message || '提交失败';
  } finally {
    submitting.value = false;
  }
}

function fillInitialAnswers(taskPayload) {
  const nextAnswers = {};
  for (const question of taskPayload.questions || []) {
    if (question.studentAnswer?.value) {
      nextAnswers[question.id] = { value: question.studentAnswer.value };
    }
  }
  answers.value = nextAnswers;
}

async function loadTask(options = {}) {
  loading.value = true;
  error.value = '';
  try {
    const payload = await getStudentTask(studentId.value, taskId.value, options);
    task.value = payload;
    fillInitialAnswers(payload);
  } catch (err) {
    error.value = err.message || '答题任务加载失败';
  } finally {
    loading.value = false;
  }
}

function scrollChatToBottom() {
  nextTick(() => {
    if (!chatFeedRef.value) return;
    chatFeedRef.value.scrollTop = chatFeedRef.value.scrollHeight;
  });
}

async function askAi() {
  const message = aiDraft.value.trim();
  if (!message || aiLoading.value || !currentQuestion.value) return;

  const userMessage = {
    id: `user-${Date.now()}`,
    role: 'student',
    text: message
  };
  const aiMessage = {
    id: `ai-${Date.now()}`,
    role: 'ai',
    text: ''
  };
  aiMessages.value = [...aiMessages.value, userMessage, aiMessage];
  aiDraft.value = '';
  aiLoading.value = true;

  try {
    await streamStudentAiChat({
      studentId: studentId.value,
      taskId: taskId.value,
      questionId: currentQuestion.value.id,
      question: {
        ...currentQuestion.value,
        studentAnswer: answers.value[currentQuestion.value.id] || null
      },
      course: task.value?.course || null,
      message
    }, {
      onDelta: (text) => {
        aiMessage.text += text;
        aiMessages.value = [...aiMessages.value];
      },
      onDone: () => {}
    });
  } catch (err) {
    aiMessage.text = err.message || 'AI 暂时无法回复，请稍后再试。';
    aiMessages.value = [...aiMessages.value];
  } finally {
    aiLoading.value = false;
  }
}

function backToCourse() {
  router.push({
    path: returnCourseGroupId.value ? `/student/courses/${returnCourseGroupId.value}` : '/student/courses',
    query: { studentId: studentId.value }
  });
}

watch(
  () => [aiMessages.value.length, aiMessages.value.at(-1)?.text],
  scrollChatToBottom,
  { flush: 'post' }
);

onMounted(loadTask);
</script>

<template>
  <main class="practice-shell">
    <header class="practice-topbar">
      <button type="button" aria-label="返回课程" @click="backToCourse">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <div>
        <strong>{{ task?.course?.title || '答题练习' }}</strong>
        <span>{{ task?.title || '练习任务' }} · {{ answeredCount }}/{{ questions.length }} 已答</span>
      </div>
      <button type="button" :disabled="loading" @click="loadTask({ force: true })">
        <span class="material-symbols-outlined">refresh</span>
      </button>
    </header>

    <section v-if="error" class="practice-error">
      <strong>{{ error }}</strong>
      <button type="button" @click="loadTask({ force: true })">重新加载</button>
    </section>

    <section v-else class="practice-layout">
      <aside class="question-nav" aria-label="题号导航">
        <strong>题目</strong>
        <button
          v-for="(question, index) in questions"
          :key="question.id"
          type="button"
          :class="{ active: index === currentIndex, answered: hasAnswer(question.id) }"
          @click="currentIndex = index"
        >
          {{ index + 1 }}
        </button>
      </aside>

      <section class="question-stage">
        <template v-if="loading">
          <div class="question-loading">正在加载题目...</div>
        </template>

        <template v-else-if="currentQuestion">
          <header class="question-head">
            <span>{{ currentQuestion.type === 'choice' ? '选择题' : '填空题' }}</span>
            <em>{{ currentQuestion.difficulty || '练习' }}</em>
          </header>
          <article class="question-card">
            <h1>{{ currentIndex + 1 }}. {{ currentQuestion.title }}</h1>

            <div v-if="currentQuestion.type === 'choice'" class="option-list">
              <button
                v-for="option in currentQuestion.options"
                :key="option"
                type="button"
                :class="{ selected: currentAnswer === option }"
                @click="chooseOption(option)"
              >
                {{ option }}
              </button>
            </div>

            <label v-else class="blank-answer">
              <span>你的答案</span>
              <textarea
                :value="currentAnswer"
                placeholder="在这里输入答案"
                @input="setAnswer(currentQuestion.id, $event.target.value)"
                @blur="persistQuestion(currentQuestion)"
              ></textarea>
            </label>
          </article>

          <footer class="question-actions">
            <button type="button" :disabled="!canGoPrev || saving" @click="goPrev">
              <span class="material-symbols-outlined">chevron_left</span>
              上一题
            </button>
            <div>
              <span v-if="saving">保存中...</span>
              <span v-else-if="result">得分 {{ result.score }}/{{ result.totalScore }} · 正确率 {{ result.accuracy }}%</span>
              <span v-else>{{ hasAnswer(currentQuestion.id) ? '已作答' : '未作答' }}</span>
            </div>
            <button v-if="canGoNext" type="button" :disabled="saving" @click="goNext">
              下一题
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <button v-else type="button" :disabled="submitting" @click="submitTask">
              {{ submitting ? '提交中' : '提交' }}
              <span class="material-symbols-outlined">check</span>
            </button>
          </footer>
        </template>

        <section v-else class="question-loading">暂无可答题目</section>
      </section>

      <aside class="ai-tutor-panel">
        <header>
          <img class="ai-logo-avatar" src="/assets/eduai-logo.png" alt="AI" />
          <div>
            <strong>AI 学习助手</strong>
            <span>引导思路，不直接代答</span>
          </div>
        </header>

        <div ref="chatFeedRef" class="ai-feed">
          <article
            v-for="message in aiMessages"
            :key="message.id"
            class="ai-message"
            :class="message.role"
          >
            {{ message.text || (message.role === 'ai' && aiLoading ? '思考中...' : '') }}
          </article>
        </div>

        <footer class="ai-composer">
          <textarea
            v-model="aiDraft"
            :disabled="aiLoading || !currentQuestion"
            placeholder="问问这道题的思路，例如：第一步应该看什么？"
            @keydown.enter.prevent="askAi"
          ></textarea>
          <button type="button" :disabled="aiLoading || !aiDraft.trim()" @click="askAi">
            {{ aiLoading ? '回复中' : '发送' }}
          </button>
        </footer>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.practice-shell {
  display: grid;
  width: 100%;
  height: 100vh;
  min-height: 0;
  grid-template-rows: 64px minmax(0, 1fr);
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 6%, rgba(81, 201, 135, .18), transparent 30%),
    var(--wash);
  color: var(--ink);
}

.practice-topbar {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .72);
  padding: 10px;
  backdrop-filter: blur(16px);
}

.practice-topbar button,
.question-nav button,
.question-actions button,
.practice-error button,
.ai-composer button {
  display: inline-flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  background: var(--deep);
  color: #80f3a8;
  padding: 0 14px;
  font-weight: 800;
}

.practice-topbar strong {
  display: block;
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.practice-topbar span {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.practice-layout {
  display: grid;
  min-height: 0;
  grid-template-columns: 1fr;
  gap: 10px;
  overflow-y: auto;
  padding: 10px;
}

.question-nav,
.question-stage,
.ai-tutor-panel,
.practice-error {
  border: 1px solid rgba(255, 255, 255, .78);
  background: rgba(255, 255, 255, .76);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.question-nav {
  display: flex;
  min-height: 66px;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  border-radius: 14px;
  padding: 10px;
}

.question-nav strong {
  margin-right: 2px;
  white-space: nowrap;
}

.question-nav button {
  flex: 0 0 44px;
  border: 1px solid var(--line);
  background: #f8fcf9;
  color: var(--ink);
  padding: 0;
}

.question-nav button.answered {
  border-color: rgba(47, 172, 102, .42);
  background: var(--mint);
  color: var(--green);
}

.question-nav button.active {
  background: var(--deep);
  color: white;
}

.question-stage {
  display: grid;
  min-height: 520px;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border-radius: 14px;
}

.question-head {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  padding: 0 16px;
}

.question-head span,
.question-head em {
  color: var(--muted);
  font-size: 13px;
  font-style: normal;
  font-weight: 800;
}

.question-card {
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
}

.question-card h1 {
  font-family: var(--font-serif);
  font-size: 24px;
  line-height: 1.45;
}

.option-list {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}

.option-list button {
  min-height: 54px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(244, 250, 246, .92);
  color: var(--ink);
  padding: 12px 14px;
  text-align: left;
  font-weight: 700;
}

.option-list button.selected {
  border-color: rgba(47, 172, 102, .58);
  background: var(--mint);
  color: var(--green);
  box-shadow: inset 0 0 0 1px rgba(47, 172, 102, .24);
}

.blank-answer {
  display: grid;
  gap: 10px;
  margin-top: 24px;
}

.blank-answer span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.blank-answer textarea {
  width: 100%;
  min-height: 150px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: none;
  background: rgba(248, 252, 249, .94);
  padding: 14px;
  color: var(--ink);
  font-size: 16px;
  line-height: 1.55;
}

.question-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--line);
  padding: 12px;
}

.question-actions div {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.question-actions button:disabled,
.ai-composer button:disabled {
  opacity: .58;
}

.ai-tutor-panel {
  display: grid;
  min-height: 520px;
  grid-template-rows: 58px minmax(0, 1fr) auto;
  overflow: hidden;
  border-radius: 14px;
}

.ai-tutor-panel header {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid var(--line);
  padding: 0 14px;
}

.ai-tutor-panel header strong,
.ai-tutor-panel header span {
  display: block;
}

.ai-tutor-panel header span {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
}

.ai-feed {
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
}

.ai-message {
  width: fit-content;
  max-width: 92%;
  margin-bottom: 10px;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.ai-message.ai {
  border: 1px solid var(--line);
  background: white;
  color: var(--muted);
}

.ai-message.student {
  margin-left: auto;
  background: var(--deep);
  color: white;
}

.ai-composer {
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding: 10px;
}

.ai-composer textarea {
  width: 100%;
  min-height: 82px;
  resize: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  outline: none;
  background: rgba(248, 252, 249, .96);
  padding: 10px;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.45;
}

.question-loading,
.practice-error {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: var(--muted);
  padding: 24px;
  text-align: center;
}

.practice-error {
  width: min(680px, calc(100% - 20px));
  margin: 20px auto;
  border-radius: 14px;
  gap: 12px;
}

@media (min-width: 768px) {
  .question-actions {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .question-card {
    padding: 24px;
  }
}

@media (min-width: 1024px) {
  .practice-layout {
    grid-template-columns: 78px minmax(0, 1fr) minmax(300px, 360px);
    overflow: hidden;
    padding: 14px;
  }

  .question-nav {
    display: grid;
    align-content: start;
    justify-items: center;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .question-nav strong {
    margin: 0 0 4px;
  }

  .question-stage,
  .ai-tutor-panel {
    height: calc(100vh - 92px);
    min-height: 0;
  }
}
</style>
