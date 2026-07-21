<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiChat from '../components/AiChat.vue';
import CourseWorkflowRail from '../components/CourseWorkflowRail.vue';
import {
  appendCourseChatMessage,
  getCourseChat,
  getOutline,
  markDraftMaterialUploaded,
  notify,
  setCourseOutline,
  setCourseChatScriptStep,
  streamCourseChatMessage,
  updateDraftCourseFromChat
} from '../data/mockStore';
import { updateCourse } from '../data/courseApiClient';
import {
  extractOutlineJsonBlock,
  normalizeOutlinePayload,
  requestOutlineAgent,
  stripOutlineJsonBlock
} from '../data/outlineAgentClient';
import {
  loadWorkspaceCourse,
  resolveWorkspaceFallbackCourse
} from '../data/workspaceCourseLoader';

const route = useRoute();
const router = useRouter();
const draft = ref('');
const aiLoading = ref(false);
const outlineLoading = ref(false);
const materialLoading = ref(false);
const fileInput = ref(null);
const workspaceCourse = ref(resolveWorkspaceFallbackCourse(route.params.courseId));
const workspaceLoadError = ref('');

const newCourseScript = [
  {
    label: '第 1 句：说明课程主题',
    teacher: '我想新建一节高中物理课，主题是牛顿第二定律。',
    ai: '好的，我先把这门课的主题记录为高中物理《牛顿第二定律》。接下来请补充授课对象、课时时长和你希望达成的课堂目标，我会把这些信息作为后续大纲、PPT 和教案的共同上下文。'
  },
  {
    label: '第 2 句：补充年级和目标',
    teacher: '面向高一学生，45分钟，希望通过实验探究理解力、质量和加速度的关系，并能用F=ma解决基础问题。',
    ai: '已确认：高一物理，45 分钟，课堂重点是通过实验探究建构 F=ma，并完成基础应用。我已经整理出这门课的基础知识点。接下来请在左侧点击「AI 生成大纲」；如果你手上有教材、课标或原始课件，也可以先上传资料，我会把解析结果继续并入这门课的上下文。'
  },
  {
    label: '可选：上传教材资料',
    teacher: '我上传教材片段和课标要求。',
    ai: '资料解析完成。我已把教材中的实验要求、课标表述和易错点补进这门课的上下文。接下来生成大纲时，会优先参考这些材料；后续进入 PPT 和教案编辑时，也会继续沿用这份上下文。'
  }
];

const courseId = computed(() => String(route.params.courseId));
const course = computed(() => workspaceCourse.value);
const courseChat = computed(() => getCourseChat(courseId.value));
const outline = computed(() => course.value.outline || getOutline(course.value.id));
const topic = computed(() => course.value.title.match(/《(.+)》/)?.[1] || course.value.shortTitle.split(' ・ ').pop());
const isNewDraft = computed(() => course.value.isDraft && !course.value.hasOutline);
const canGenerateOutline = computed(() => !course.value.isDraft || course.value.infoReady);
const lockedWorkflowSteps = computed(() => course.value?.hasOutline && outline.value
  ? []
  : ['mindmap', 'ppt', 'lesson-plan']);
const messages = computed(() => courseChat.value.messages);
const scriptStep = computed({
  get: () => courseChat.value.scriptStep,
  set: (value) => {
    setCourseChatScriptStep(courseId.value, value);
  }
});
const draftStage = computed(() => {
  if (!course.value.isDraft) return 'ready';
  if (!course.value.infoReady) return 'chat';
  return 'generate';
});
const draftFields = computed(() => [
  ['课程主题', course.value.infoReady ? topic.value : '待确认'],
  ['年级', course.value.infoReady ? course.value.grade : '待确认'],
  ['学科', course.value.infoReady ? course.value.subject : '待确认'],
  ['时长', course.value.infoReady ? course.value.duration : '待确认'],
  ['资料', course.value.materialUploaded ? course.value.materialName : '未上传'],
  ['知识点', course.value.knowledge.length ? `${course.value.knowledge.length} 个已识别` : '待 AI 解析']
]);

let courseLoadToken = 0;
let outlineAgentTypingTimer = 0;

async function refreshWorkspaceCourse(id) {
  const token = ++courseLoadToken;
  workspaceLoadError.value = '';
  const result = await loadWorkspaceCourse(String(id));
  if (token === courseLoadToken) {
    workspaceCourse.value = result.course;
    workspaceLoadError.value = result.course ? '' : (result.error?.message || '课程加载失败');
  }
}

async function persistWorkspaceCourseState(patch) {
  try {
    const updated = await updateCourse(courseId.value, patch);
    const result = await loadWorkspaceCourse(courseId.value, {
      fetchCourse: async () => updated
    });
    workspaceCourse.value = result.course;
  } catch {
    // Mock-only courses cannot be persisted to the API; keep the local interaction usable.
  }
}

function toAgentRole(role) {
  if (role === 'teacher' || role === 'user') return 'user';
  if (role === 'ai' || role === 'assistant') return 'assistant';
  return '';
}

function toOutlineAgentMessages(chatMessages = []) {
  return chatMessages
    .map((message) => {
      const role = toAgentRole(message.role);
      const content = stripOutlineJsonBlock(message.text || message.content || '');
      return role && content ? { role, content } : null;
    })
    .filter(Boolean);
}

function streamOutlineAgentReply(messageId, content) {
  window.clearInterval(outlineAgentTypingTimer);
  const fullText = String(content || '');
  const chat = getCourseChat(courseId.value);
  const target = chat.messages.find((message) => message.id === messageId);
  if (!target) return Promise.resolve();

  return new Promise((resolve) => {
    target.text = '';
    target.isStreaming = true;
    if (!fullText) {
      target.isStreaming = false;
      resolve();
      return;
    }

    let cursor = 0;
    outlineAgentTypingTimer = window.setInterval(() => {
      cursor = Math.min(fullText.length, cursor + 2);
      target.text = fullText.slice(0, cursor);
      target.isStreaming = cursor < fullText.length;
      if (cursor >= fullText.length) {
        window.clearInterval(outlineAgentTypingTimer);
        outlineAgentTypingTimer = 0;
        resolve();
      }
    }, 24);
  });
}

async function sendOutlineAgentMessage(text) {
  appendCourseChatMessage(courseId.value, { role: 'teacher', text });
  const history = toOutlineAgentMessages(getCourseChat(courseId.value).messages);
  aiLoading.value = true;

  try {
    const result = await requestOutlineAgent({
      course: {
        id: course.value.id,
        title: course.value.title,
        shortTitle: course.value.shortTitle,
        grade: course.value.grade,
        subject: course.value.subject,
        duration: course.value.duration,
        goal: course.value.goal
      },
      currentOutline: course.value.hasOutline ? outline.value : null,
      messages: history
    });

    const replyContent = String(result.content || '').trim();
    const outlineJson = extractOutlineJsonBlock(replyContent);
    const visibleReply = stripOutlineJsonBlock(replyContent) || (
      outlineJson ? '已根据你的要求更新课程大纲，并同步到左侧大纲区域。' : '我已收到，会继续结合当前大纲处理。'
    );

    const messageId = Date.now() + 1;
    appendCourseChatMessage(courseId.value, {
      id: messageId,
      role: 'ai',
      text: '',
      isStreaming: true
    });
    await streamOutlineAgentReply(messageId, visibleReply);

    if (!outlineJson) return;

    const nextOutline = normalizeOutlinePayload(JSON.parse(outlineJson));
    setCourseOutline(course.value.id, nextOutline);
    course.value.hasOutline = true;
    course.value.outline = nextOutline;
    course.value.progress = Math.max(course.value.progress || 0, 58);
    persistWorkspaceCourseState({
      hasOutline: true,
      progress: course.value.progress,
      outline: nextOutline
    });
    notify('AI 大纲已更新');
  } catch (error) {
    window.clearInterval(outlineAgentTypingTimer);
    outlineAgentTypingTimer = 0;
    appendCourseChatMessage(courseId.value, {
      role: 'ai',
      text: error instanceof Error ? error.message : 'AI 大纲修改失败，请检查 DeepSeek 配置后重试。'
    });
  } finally {
    aiLoading.value = false;
  }
}

function getTagText(tag) {
  return typeof tag === 'string' ? tag : String(tag?.text || tag?.label || '');
}

function getTone(value) {
  const tone = String(value || '').trim();
  return ['focus', 'warning', 'success', 'muted'].includes(tone) ? tone : 'default';
}

function tagToneClass(tag) {
  return `tone-${getTone(typeof tag === 'string' ? 'default' : tag?.tone)}`;
}

const hasExplicitActiveSection = computed(() => outline.value?.sections?.some((section) => section.active) || false);

function isCurrentSection(section, index) {
  return Boolean(section.active) || (!hasExplicitActiveSection.value && index === 1);
}

function getSectionStatus(section, index) {
  return section.status || (isCurrentSection(section, index) ? 'optimized' : '');
}

function getCardLabel(card) {
  return Array.isArray(card) ? card[0] : card?.label;
}

function getCardContent(card) {
  return Array.isArray(card) ? card[1] : card?.content;
}

function cardToneClass(card, section, index) {
  if (!Array.isArray(card) && card?.tone) return `tone-${getTone(card.tone)}`;
  const label = getCardLabel(card);
  if (label === '风险知识点') return 'tone-warning';
  if (isCurrentSection(section, index) && label === '关键内容') return 'tone-focus';
  return 'tone-default';
}

onMounted(() => {
  refreshWorkspaceCourse(route.params.courseId);
});

onBeforeUnmount(() => {
  window.clearInterval(outlineAgentTypingTimer);
});

watch(
  () => route.params.courseId,
  (courseIdValue) => {
    workspaceCourse.value = resolveWorkspaceFallbackCourse(courseIdValue);
    workspaceLoadError.value = '';
    refreshWorkspaceCourse(courseIdValue);
  }
);

async function generateOutline() {
  if (outlineLoading.value || aiLoading.value) return;
  if (!canGenerateOutline.value) {
    notify('请先和 AI 确认课程基础信息');
    return;
  }
  outlineLoading.value = true;
  try {
    await sendOutlineAgentMessage('请根据当前课程信息生成课程大纲。不要强制四段式，请根据课时、课型和教学目标生成 3-6 个教学环节。');
  } finally {
    outlineLoading.value = false;
  }
}

function sendMessage(inputText = draft.value) {
  if (aiLoading.value) return;
  const text = inputText.trim();
  if (!text) return;
  draft.value = '';
  sendOutlineAgentMessage(text);
}

function openMaterialPicker() {
  if (materialLoading.value) return;
  if (course.value.isDraft && !course.value.infoReady) {
    notify('请先告诉 AI 课程主题和基础信息');
    return;
  }
  if (course.value.materialUploaded) {
    notify('资料已解析，可直接生成大纲');
    return;
  }
  fileInput.value?.click();
}

function handleMaterialSelected(event) {
  const [file] = Array.from(event.target.files || []);
  event.target.value = '';
  if (!file || materialLoading.value) return;
  const materialName = file.name;
  appendCourseChatMessage(courseId.value, { role: 'teacher', text: `我上传了资料：${materialName}` });
  materialLoading.value = true;
  window.setTimeout(() => {
    markDraftMaterialUploaded(course.value.id, materialName);
    course.value.materialUploaded = true;
    course.value.materialName = materialName;
    persistWorkspaceCourseState({
      materialUploaded: true,
      materialName,
      progress: Math.max(course.value.progress || 0, 34)
    });
    streamCourseChatMessage(courseId.value, { role: 'ai', text: newCourseScript[2].ai }, { delay: 3000 });
    scriptStep.value = 3;
    materialLoading.value = false;
    notify('资料解析完成');
  }, 10000);
}

function handleWorkflowBlocked() {
  notify('请先生成课程大纲');
}

function handleChatSuggestion(suggestion) {
  if (suggestion?.text) return;
  if (typeof suggestion === 'string') {
    draft.value = suggestion;
  }
}
</script>

<template>
  <main class="ws-page">
    <section v-if="!course" class="ws-course-loading">
      <span class="material-symbols-outlined">{{ workspaceLoadError ? 'error' : 'progress_activity' }}</span>
      <strong>{{ workspaceLoadError ? '课程加载失败' : '正在读取课程信息' }}</strong>
      <p>{{ workspaceLoadError || '正在从课程数据库获取基础信息与大纲状态。' }}</p>
      <button v-if="workspaceLoadError" class="ws-btn" type="button" @click="refreshWorkspaceCourse(courseId)">
        <span class="material-symbols-outlined">refresh</span>
        重新加载
      </button>
    </section>

    <template v-else>
    <header class="ws-top">
      <button class="ws-btn back-btn" type="button" @click="router.push('/preclass/courses')">
        <span class="material-symbols-outlined">chevron_left</span>
        返回我的课程
      </button>
      <div class="ws-title">
        <h1>{{ isNewDraft ? '新建课程 · AI 备课工作台' : course.hasOutline && outline ? topic : course.shortTitle }}</h1>
        <p>{{ isNewDraft ? '先和 AI 对话确认基本信息，可选上传资料增强上下文' : `${course.grade} ・ ${course.subject} ・ ${course.duration} ・ ${course.hasOutline && outline ? 'AI 已生成课程大纲' : '先填写基础信息，AI 帮你起草大纲'}` }}</p>
      </div>
      <div v-if="course.hasOutline && outline" class="ws-actions">
        <button class="ws-complete-status" type="button" disabled>
          <span class="material-symbols-outlined">check</span>
          完成大纲
        </button>
      </div>
    </header>

    <section class="ws-shell">
      <CourseWorkflowRail
        :course-id="course.id"
        active-step="generate"
        :locked-steps="lockedWorkflowSteps"
        @blocked="handleWorkflowBlocked"
      />

      <section class="ws-main">
        <article v-if="!course.hasOutline || !outline" class="ws-empty-card">
          <section class="ws-empty-copy">
            <span class="ws-chip"><span class="material-symbols-outlined">auto_awesome</span>{{ isNewDraft ? '从 0 开始' : 'AI 起草' }}</span>
            <h2>{{ isNewDraft ? '先和 AI 聊出课程基本信息' : '和 AI 先聊清楚，再生成第一版大纲' }}</h2>
            <p>{{ isNewDraft ? '新建课程不会预填内容。请先告诉 AI 主题、年级、学科和课时时长；有资料可以上传增强，没有资料也能先生成大纲。' : '这一步只做课堂结构，不直接跳 PPT。确认知识点、班级水平和教学节奏后，AI 会按课时生成可编辑的大纲。' }}</p>

            <div v-if="isNewDraft" class="ws-draft-status">
              <article v-for="[label, value] in draftFields" :key="label" :class="{ done: value !== '待确认' && value !== '未上传' && !value.startsWith('待 AI') }">
                <span>{{ label }}</span>
                <strong>{{ value }}</strong>
              </article>
            </div>

            <div v-else class="ws-form-grid">
              <label>
                <span>课程标题</span>
                <strong>{{ topic }}</strong>
              </label>
              <label>
                <span>学段</span>
                <strong>{{ course.grade }}</strong>
              </label>
              <label>
                <span>学科</span>
                <strong>{{ course.subject }}</strong>
              </label>
              <label>
                <span>时长</span>
                <strong>{{ course.duration }}</strong>
              </label>
            </div>

            <div v-if="!isNewDraft || course.knowledge.length" class="ws-field">
              <span>核心知识点</span>
              <div class="ws-tags">
                <b v-for="item in course.knowledge" :key="item">{{ item }} ×</b>
                <em>再添加...</em>
              </div>
            </div>

            <div class="ws-empty-actions">
              <button v-if="canGenerateOutline" class="ws-generate" type="button" :disabled="outlineLoading || aiLoading" @click="generateOutline">
                <span class="material-symbols-outlined">auto_awesome</span>
                {{ outlineLoading || aiLoading ? '正在生成大纲...' : 'AI 生成大纲' }}
              </button>
            </div>
          </section>

          <aside class="ws-empty-preview">
            <span>{{ isNewDraft ? '新建课流程' : '将生成的课堂骨架' }}</span>
            <h3>{{ isNewDraft ? '对话 · 上传 · 解析 · 生成' : '按课时自动组织环节' }}</h3>
            <ol v-if="isNewDraft">
              <li :class="{ active: scriptStep === 0 }"><strong>1. 说清主题</strong><em>高中物理《牛顿第二定律》</em></li>
              <li :class="{ active: scriptStep === 1 }"><strong>2. 补充目标</strong><em>高一、45 分钟、实验探究</em></li>
              <li :class="{ active: scriptStep === 2 && !course.materialUploaded }"><strong>3. 可选资料</strong><em>有教材/课标可增强</em></li>
              <li :class="{ active: scriptStep >= 2 }"><strong>4. 生成大纲</strong><em>基础信息确认后即可生成</em></li>
            </ol>
            <ol v-else>
              <li><strong>环节数量由 AI 判断</strong><em>通常根据课时生成 3-6 个教学环节</em></li>
              <li><strong>环节名称不固定</strong><em>可按探究课、复习课、讲评课等课型调整</em></li>
              <li><strong>内容跟随目标变化</strong><em>每个环节包含教师动作、学生产出和风险点</em></li>
              <li><strong>可继续对话修改</strong><em>生成后仍可让 AI 增删、合并或重排环节</em></li>
            </ol>
            <div>
              <b>{{ draftStage === 'chat' ? '先对话，不急着生成' : canGenerateOutline ? '已具备生成大纲条件' : '生成后才能进入 PPT' }}</b>
              <small>{{ isNewDraft ? 'PPT、教案、题目都依赖这一步沉淀的课程上下文。' : '大纲是后续课件、教案和题目的共同上下文。' }}</small>
            </div>
          </aside>
        </article>

        <article v-else class="ws-outline">
          <header class="ws-outline-head">
            <div>
              <h2>{{ topic }}课程大纲</h2>
              <p>AI 已生成 {{ outline.version }} ・ {{ outline.sections.length }} 教学环节 ・ {{ outline.tags.length - 1 }} 个核心知识点</p>
              <div class="ws-tags compact">
                <b
                  v-for="(tag, index) in outline.tags"
                  :key="getTagText(tag)"
                  :class="[tagToneClass(tag), { quiet: index > 1 }]"
                >
                  {{ getTagText(tag) }}
                </b>
              </div>
            </div>
            <div class="ws-outline-actions">
              <button class="ws-btn" type="button" @click="generateOutline">
                <span class="material-symbols-outlined">refresh</span>
                重新生成
              </button>
              <button class="ws-btn" type="button" @click="router.push(`/preclass/courses/${course.id}/mindmap`)">
                <span class="material-symbols-outlined">account_tree</span>
                生成思维导图
              </button>
              <button class="ws-primary" type="button" @click="router.push(`/preclass/courses/${course.id}/ppt`)">
                <span class="material-symbols-outlined">desktop_windows</span>
                去生成 PPT
              </button>
            </div>
          </header>

          <div class="ws-outline-list">
            <section
              v-for="(section, index) in outline.sections"
              :key="section.title"
              class="ws-outline-row"
              :class="{ current: isCurrentSection(section, index) }"
            >
              <div class="ws-index">
                <strong>{{ String(index + 1).padStart(2, '0') }}</strong>
                <span>{{ section.time }}</span>
                <em>{{ section.phase }}</em>
              </div>
              <div class="ws-row-main">
                <h3>
                  {{ section.title }}
                  <span v-if="getSectionStatus(section, index) === 'optimized'">AI 已优化</span>
                </h3>
                <div class="ws-note-grid">
                  <article
                    v-for="card in section.cards"
                    :key="getCardLabel(card)"
                    :class="cardToneClass(card, section, index)"
                  >
                    <strong>{{ getCardLabel(card) }}</strong>
                    <p>{{ getCardContent(card) }}</p>
                  </article>
                </div>
              </div>
            </section>
          </div>
        </article>
      </section>

      <AiChat
        class="ws-chat"
        title="AI 教学助手"
        :messages="messages"
        :loading="aiLoading || materialLoading"
        :loading-label="materialLoading ? '解析中' : '思考中'"
        placeholder="继续告诉 AI 你想调整的内容..."
        @send="sendMessage"
        @suggestion="handleChatSuggestion"
      >
        <template #tools>
              <button
                v-if="!course.hasOutline || !outline"
                class="ws-upload-btn"
                type="button"
                :disabled="materialLoading"
                @click="openMaterialPicker"
              >
                <span class="material-symbols-outlined">{{ course.materialUploaded ? 'task_alt' : 'upload_file' }}</span>
                {{ materialLoading ? '解析中' : course.materialUploaded ? '已解析' : '上传资料' }}
              </button>
              <input
                v-if="!course.hasOutline || !outline"
                ref="fileInput"
                class="ws-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                @change="handleMaterialSelected"
              />
        </template>
      </AiChat>
    </section>
    </template>
  </main>
</template>

<style scoped>
.ws-page {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: var(--edu-topbar-h) minmax(0, 1fr);
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(220, 246, 232, .52), transparent 42%),
    #f4faf6;
  color: var(--ink);
}

.ws-course-loading {
  grid-row: 1 / -1;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
}

.ws-course-loading > .material-symbols-outlined {
  color: var(--green);
  font-size: 42px;
  animation: ws-loading-spin 1s linear infinite;
}

.ws-course-loading strong {
  font-family: var(--font-serif);
  font-size: 24px;
}

.ws-course-loading p {
  max-width: 420px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.ws-course-loading .ws-btn { margin-top: 4px; }

@keyframes ws-loading-spin { to { transform: rotate(360deg); } }

.ws-top {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--edu-gap-md);
  padding: 0 var(--edu-page-pad);
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .88);
  backdrop-filter: blur(18px);
}

.ws-title {
  min-width: 0;
}

.ws-title h1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: var(--edu-title);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}

.ws-title p {
  margin-top: 6px;
  overflow: hidden;
  color: var(--soft);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--edu-body);
}

.ws-actions,
.ws-outline-actions,
.ws-empty-actions {
  display: flex;
  align-items: center;
  gap: var(--edu-gap-sm);
}

.ws-btn,
.ws-primary,
.ws-complete-status,
.ws-generate {
  display: inline-flex;
  height: var(--edu-control-compact-h);
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--edu-radius-sm);
  padding: 0 14px;
  font-size: var(--edu-body);
  font-weight: 600;
  white-space: nowrap;
}

.ws-btn {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .76);
  color: var(--ink);
}

.ws-primary,
.ws-generate {
  border: 0;
  background: var(--deep);
  color: #7df0a0;
  box-shadow: 0 12px 24px rgba(7, 52, 32, .16);
}

.ws-complete-status {
  border: 1px solid rgba(47, 172, 102, .18);
  background: rgba(255, 255, 255, .34);
  color: #1f8847;
  box-shadow: none;
  cursor: default;
}

.ws-complete-status:disabled {
  opacity: 1;
}

.ws-complete-status .material-symbols-outlined {
  font-size: 18px;
  font-variation-settings: "FILL" 0, "wght" 380, "GRAD" 0, "opsz" 20;
}

.ws-generate.disabled {
  background: rgba(10, 53, 34, .16);
  color: var(--muted);
  box-shadow: none;
}

.ws-shell {
  min-height: 0;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) var(--edu-side-panel);
}

.ws-main {
  min-width: 0;
  min-height: 0;
  display: grid;
  padding: 16px 18px;
  overflow: auto;
}

.ws-empty-card,
.ws-outline {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-lg);
  background: var(--surface-glass);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .76);
  backdrop-filter: blur(18px);
}

.ws-empty-card {
  align-self: stretch;
  justify-self: stretch;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 34%);
  gap: 18px;
  padding: 20px;
  overflow: hidden;
}

.ws-empty-copy {
  min-width: 0;
  align-self: center;
  max-width: 720px;
  padding: 8px 4px 8px 8px;
}

.ws-chip {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 6px;
  border-radius: var(--edu-radius-sm);
  padding: 0 10px;
  background: var(--mint);
  color: #219653;
  font-size: var(--edu-caption);
  font-weight: 650;
}

.ws-empty-card h2 {
  font-family: var(--font-serif);
  margin-top: 16px;
  font-size: 30px;
  line-height: 1.16;
  font-weight: 700;
}

.ws-empty-card > p {
  margin-top: 10px;
  color: var(--soft);
  font-size: var(--edu-body-lg);
  line-height: 1.62;
}

.ws-empty-copy > p {
  margin-top: 10px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}

.ws-form-grid {
  display: grid;
  grid-template-columns: 1.4fr repeat(3, minmax(90px, .6fr));
  gap: var(--edu-gap-md);
  margin-top: 22px;
}

.ws-draft-status {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--edu-gap-sm);
  margin-top: 22px;
}

.ws-draft-status article {
  min-width: 0;
  min-height: 62px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: rgba(244, 250, 246, .74);
  padding: 11px 13px;
}

.ws-draft-status article.done {
  border-color: rgba(47, 172, 102, .28);
  background: rgba(220, 246, 232, .70);
}

.ws-draft-status span {
  display: block;
  color: var(--muted);
  font-size: var(--edu-caption);
  font-weight: 600;
}

.ws-draft-status strong {
  display: block;
  margin-top: 7px;
  overflow: hidden;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 650;
}

.ws-form-grid label,
.ws-field {
  min-width: 0;
}

.ws-form-grid label {
  display: grid;
  gap: 8px;
}

.ws-form-grid span,
.ws-field > span {
  color: var(--muted);
  font-size: var(--edu-body);
  font-weight: 600;
}

.ws-form-grid strong {
  display: flex;
  min-height: 40px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: rgba(244, 250, 246, .84);
  padding: 0 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--edu-body-lg);
  font-weight: 600;
}

.ws-field {
  margin-top: 20px;
}

.ws-tags {
  display: flex;
  min-width: 0;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.ws-tags b,
.ws-tags em {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  padding: 0 12px;
  font-size: var(--edu-caption);
  font-weight: 600;
}

.ws-tags b {
  background: var(--mint);
  color: #1f8847;
}

.ws-tags b.tone-success,
.ws-tags b.tone-focus {
  background: var(--mint);
  color: #1f8847;
}

.ws-tags b.tone-warning {
  background: #ffe9c1;
  color: #9a5a00;
}

.ws-tags b.tone-muted {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .72);
  color: var(--muted);
}

.ws-tags b.quiet,
.ws-tags em {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .72);
  color: var(--muted);
  font-style: normal;
}

.ws-empty-actions {
  margin-top: 24px;
  flex-wrap: wrap;
}

.ws-empty-preview {
  position: relative;
  display: grid;
  align-content: space-between;
  gap: 16px;
  min-width: 0;
  overflow: hidden;
  border-radius: 14px;
  padding: 20px;
  background:
    linear-gradient(180deg, rgba(10, 53, 34, .94), rgba(14, 73, 46, .92)),
    var(--deep);
  color: white;
}

.ws-empty-preview::after {
  content: "";
  position: absolute;
  right: -56px;
  bottom: -70px;
  width: 210px;
  height: 210px;
  border: 1px solid rgba(126, 240, 160, .18);
  border-radius: 50%;
  box-shadow: 0 0 0 24px rgba(126, 240, 160, .05);
}

.ws-empty-preview > span,
.ws-empty-preview h3,
.ws-empty-preview ol,
.ws-empty-preview div {
  position: relative;
  z-index: 1;
}

.ws-empty-preview > span {
  color: #9be9b4;
  font-size: var(--edu-caption);
  font-weight: 600;
}

.ws-empty-preview h3 {
  margin-top: 10px;
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 1.08;
  font-weight: 400;
}

.ws-empty-preview ol {
  display: grid;
  gap: 10px;
  margin: 20px 0;
  padding: 0;
  list-style: none;
}

.ws-empty-preview li {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 12px;
  background: rgba(255, 255, 255, .07);
}

.ws-empty-preview strong,
.ws-empty-preview b {
  font-size: 14px;
  font-weight: 650;
}

.ws-empty-preview em,
.ws-empty-preview small {
  color: rgba(255, 255, 255, .66);
  font-size: 12px;
  font-style: normal;
  line-height: 1.5;
}

.ws-empty-preview div {
  display: grid;
  gap: 6px;
  border-top: 1px solid rgba(255, 255, 255, .14);
  padding-top: 14px;
}

.ws-generate {
  height: var(--edu-control-h);
  padding: 0 18px;
  font-size: var(--edu-body);
}

.ws-outline {
  align-self: stretch;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.ws-outline-head {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--edu-gap-lg);
  align-items: start;
  padding: var(--edu-card-pad);
  border-bottom: 1px solid var(--line);
}

.ws-outline-head h2 {
  font-family: var(--font-serif);
  font-size: 25px;
  line-height: 1.12;
  font-weight: 700;
}

.ws-outline-head p {
  margin-top: 8px;
  color: var(--soft);
  font-size: var(--edu-body);
}

.ws-tags.compact {
  margin-top: 12px;
}

.ws-outline-list {
  min-height: 0;
  overflow: auto;
}

.ws-outline-row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  border-bottom: 1px solid var(--line);
}

.ws-outline-row:last-child {
  border-bottom: 0;
}

.ws-index {
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 14px 16px;
  background: rgba(235, 247, 240, .82);
}

.ws-outline-row.current .ws-index {
  background: rgba(235, 247, 240, .82);
  color: var(--ink);
}

.ws-index strong {
  color: var(--green);
  font-family: var(--font-mono);
  font-size: 31px;
  line-height: 1;
  font-weight: 700;
}

.ws-outline-row.current .ws-index strong {
  color: var(--green);
}

.ws-index span,
.ws-index em {
  font-size: var(--edu-caption);
  font-style: normal;
  line-height: 1.45;
}

.ws-row-main {
  min-width: 0;
  padding: 14px 18px;
}

.ws-row-main h3 {
  display: flex;
  align-items: center;
  gap: var(--edu-gap-sm);
  margin-bottom: 10px;
  font-family: var(--font-serif);
  font-size: 18px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: 0;
}

.ws-row-main h3 span {
  display: inline-flex;
  height: 24px;
  align-items: center;
  border-radius: 999px;
  background: var(--mint);
  color: #1f8847;
  padding: 0 10px;
  font-size: var(--edu-caption);
}

.ws-note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--edu-gap-sm);
}

.ws-note-grid article {
  min-width: 0;
  min-height: 58px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: rgba(255, 255, 255, .76);
  padding: 10px 12px;
}

.ws-note-grid article.focus,
.ws-note-grid article.tone-focus {
  border-color: var(--green);
  color: #0f5e32;
}

.ws-note-grid article.warn,
.ws-note-grid article.tone-warning {
  background: #ffe9c1;
}

.ws-note-grid article.tone-success {
  border-color: rgba(37, 171, 95, .34);
  background: rgba(222, 247, 232, .72);
}

.ws-note-grid article.tone-muted {
  background: rgba(247, 249, 247, .74);
  color: var(--muted);
}

.ws-note-grid strong {
  display: block;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: var(--edu-micro);
  font-weight: 600;
}

.ws-note-grid p {
  overflow: hidden;
  display: -webkit-box;
  color: var(--ink);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: var(--edu-body);
  line-height: 1.45;
}

.ws-chat {
  min-width: 0;
  min-height: 0;
}

.ws-file-input {
  display: none;
}

.ws-upload-btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(248, 252, 249, .82);
  color: var(--ink);
  font-weight: 600;
}

.ws-upload-btn .material-symbols-outlined {
  color: #229956;
  font-size: 18px;
  font-variation-settings: "FILL" 0, "wght" 360, "GRAD" 0, "opsz" 20;
}

.ws-upload-btn:disabled,
.ws-generate:disabled {
  opacity: .72;
}

@media (max-width: 1280px) {
  .ws-shell {
    grid-template-columns: 64px minmax(0, 1fr) 318px;
  }

  .ws-outline-actions .ws-btn {
    display: none;
  }

  .ws-empty-card {
    grid-template-columns: minmax(0, 1fr) 250px;
    gap: 14px;
    padding: 16px;
  }

  .ws-form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-height: 760px) {
  .ws-top {
    height: var(--edu-topbar-h);
  }

  .ws-page {
    grid-template-rows: var(--edu-topbar-h) minmax(0, 1fr);
  }

  .ws-main {
    padding: 12px 16px;
  }

  .ws-empty-card {
    padding: 14px;
  }

  .ws-empty-card h2 {
    margin-top: 12px;
    font-size: 26px;
  }

  .ws-empty-preview {
    padding: 16px;
  }

  .ws-empty-preview h3 {
    font-size: 25px;
  }

  .ws-empty-preview ol {
    gap: 8px;
    margin: 14px 0;
  }

  .ws-empty-preview li {
    padding: 9px 10px;
  }

  .ws-outline-head {
    padding: 16px 18px;
  }

  .ws-row-main {
    padding: 12px 16px;
  }

  .ws-note-grid article {
    min-height: 52px;
  }
}
</style>
