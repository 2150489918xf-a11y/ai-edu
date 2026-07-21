<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiChat from '../components/AiChat.vue';
import CourseWorkflowRail from '../components/CourseWorkflowRail.vue';
import { getCourse as fetchCourseDetail } from '../data/courseApiClient';
import { getLessonPlanAssistantText, streamLessonPlan } from '../data/lessonPlanAgentClient';
import { appendCourseChatMessage, getCourseChat, notify } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => String(route.params.courseId));
const courseDetail = ref(null);
const course = computed(() => courseDetail.value);
const courseChat = computed(() => getCourseChat(courseId.value));
const courseLoading = ref(false);
const courseLoadError = ref('');

const draft = ref('');
const generatingLesson = ref(false);
const generatedLessonPlan = ref(null);
const activeSectionId = ref('');
const mainScroller = ref(null);
const messages = computed(() => courseChat.value.messages);
const displayMessages = computed(() => messages.value.map((message) => {
  if (!['ai', 'assistant'].includes(message.role) || !message.text) return message;
  const cleaned = getLessonPlanAssistantText(message.text);
  return {
    ...message,
    text: cleaned || (/["{](teacher|student|steps|objectives|meta)/.test(message.text) ? '结构化教案已同步到左侧页面。' : message.text)
  };
}));
const lessonGenerated = computed(() => Boolean(generatedLessonPlan.value));
const courseTitle = computed(() => course.value?.shortTitle || course.value?.title || courseId.value);
const courseGoal = computed(() => course.value?.goal || '');
const displayMeta = computed(() => ({
  grade: generatedLessonPlan.value?.meta?.grade || course.value?.grade || '未提供',
  subject: generatedLessonPlan.value?.meta?.subject || course.value?.subject || '未提供',
  textbook: generatedLessonPlan.value?.meta?.textbook || '待 AI 生成',
  duration: generatedLessonPlan.value?.meta?.duration || course.value?.duration || '未提供'
}));
const lessonSections = computed(() => generatedLessonPlan.value?.steps || []);
const lessonSteps = computed(() => lessonSections.value.map((step, index) => ({
  id: step.id,
  number: index + 1,
  title: step.title,
  desc: step.intent || 'AI 正在补全',
  time: step.time || '—',
  done: step.status !== 'generating'
})));
const lessonCards = computed(() => ({
  objective: {
    title: '教学目标',
    subtitle: '核心素养 ・ AI 根据课程上下文生成',
    items: generatedLessonPlan.value?.objectives?.length
      ? generatedLessonPlan.value.objectives
      : [{ title: '生成中', content: 'AI 正在对齐课程目标和大纲结构。' }]
  },
  focus: {
    title: '教学重点',
    chips: generatedLessonPlan.value?.focus?.length ? generatedLessonPlan.value.focus : ['AI 正在生成']
  },
  hard: {
    title: '教学难点',
    items: generatedLessonPlan.value?.difficulties?.length ? generatedLessonPlan.value.difficulties : ['AI 正在生成']
  },
  materials: generatedLessonPlan.value?.materials?.length
    ? generatedLessonPlan.value.materials
    : [{ label: '课程依据', value: 'AI 正在读取课程大纲、资料和知识点。' }]
}));
const lessonClosing = computed(() => generatedLessonPlan.value?.closing?.length
  ? generatedLessonPlan.value.closing
  : [
    { title: '课件联动', content: '生成完成后可继续串联 PPT。' },
    { title: '题目联动', content: '课堂检测题可进入题库生成。' },
    { title: '课后联动', content: '课堂表现会进入课后分析。' }
  ]);

const completedSteps = computed(() => lessonSteps.value.filter((step) => step.done || step.active).length);
const progress = computed(() => {
  if (!lessonSteps.value.length) return '0%';
  return `${Math.round((completedSteps.value / lessonSteps.value.length) * 100)}%`;
});

function createEmptyLessonPlan() {
  return {
    version: 'streaming',
    meta: {
      grade: course.value?.grade || '',
      subject: course.value?.subject || '',
      textbook: '',
      duration: course.value?.duration || ''
    },
    objectives: [],
    materials: [],
    focus: [],
    difficulties: [],
    steps: [],
    closing: []
  };
}

function hasRenderableLessonPlan(lessonPlan) {
  return Array.isArray(lessonPlan?.steps) && lessonPlan.steps.length > 0;
}

function applyLessonPlanEvent(type, payload) {
  if (!generatedLessonPlan.value) generatedLessonPlan.value = createEmptyLessonPlan();
  if (type === 'meta') {
    generatedLessonPlan.value.meta = { ...generatedLessonPlan.value.meta, ...payload };
  }
  if (type === 'objectives') generatedLessonPlan.value.objectives = payload;
  if (type === 'materials') generatedLessonPlan.value.materials = payload;
  if (type === 'focus') {
    generatedLessonPlan.value.focus = payload.focus || [];
    generatedLessonPlan.value.difficulties = payload.difficulties || [];
  }
  if (type === 'section' && payload?.id) {
    const index = generatedLessonPlan.value.steps.findIndex((step) => step.id === payload.id);
    if (index >= 0) generatedLessonPlan.value.steps.splice(index, 1, payload);
    else generatedLessonPlan.value.steps.push(payload);
    if (!activeSectionId.value) activeSectionId.value = payload.id;
  }
  if (type === 'closing') generatedLessonPlan.value.closing = payload;
  if (type === 'lessonPlan') {
    generatedLessonPlan.value = payload;
    activeSectionId.value = payload.steps?.[0]?.id || activeSectionId.value;
  }
}

async function ensureCoursePersisted() {
  try {
    const detail = await fetchCourseDetail(courseId.value, { force: true });
    courseDetail.value = detail;
    courseLoadError.value = '';
    return detail;
  } catch (error) {
    courseLoadError.value = error.message || '课程信息加载失败';
    throw new Error('课程信息加载失败，无法生成教案');
  }
}

async function loadPersistedLessonPlan() {
  courseLoading.value = true;
  courseLoadError.value = '';
  try {
    const detail = await fetchCourseDetail(courseId.value, { force: true });
    courseDetail.value = detail;
    if (hasRenderableLessonPlan(detail.lessonPlan)) {
      generatedLessonPlan.value = detail.lessonPlan;
      activeSectionId.value = detail.lessonPlan.steps?.[0]?.id || '';
    } else {
      generatedLessonPlan.value = null;
      activeSectionId.value = '';
    }
  } catch (error) {
    courseDetail.value = null;
    generatedLessonPlan.value = null;
    activeSectionId.value = '';
    courseLoadError.value = error.message || '课程信息加载失败';
  } finally {
    courseLoading.value = false;
  }
}

async function generateLessonPlan(prompt = '生成第一版完整教案') {
  if (generatingLesson.value) return;
  generatingLesson.value = true;
  if (!generatedLessonPlan.value) generatedLessonPlan.value = createEmptyLessonPlan();
  const assistantMessage = {
    id: Date.now(),
    role: 'ai',
    title: 'AI 正在生成教案',
    text: ''
  };
  appendCourseChatMessage(courseId.value, assistantMessage);
  let rawReply = '';
  try {
    await ensureCoursePersisted();
    await streamLessonPlan(courseId.value, {
      prompt,
      currentLessonPlan: generatedLessonPlan.value,
      messages: messages.value.map((message) => ({
        role: message.role,
        text: message.text
      }))
    }, {
      onDelta: (delta) => {
        rawReply += delta;
        assistantMessage.text = getLessonPlanAssistantText(rawReply) || '正在生成结构化教案，左侧会逐块更新。';
      },
      onMeta: (meta) => applyLessonPlanEvent('meta', meta),
      onObjectives: (objectives) => applyLessonPlanEvent('objectives', objectives),
      onMaterials: (materials) => applyLessonPlanEvent('materials', materials),
      onFocus: (payload) => applyLessonPlanEvent('focus', payload),
      onSection: (section) => applyLessonPlanEvent('section', section),
      onClosing: (closing) => applyLessonPlanEvent('closing', closing),
      onLessonPlan: (lessonPlan) => applyLessonPlanEvent('lessonPlan', lessonPlan),
      onDone: (meta) => {
        assistantMessage.title = [meta.provider, meta.model].filter(Boolean).join(' · ') || 'AI 教案已生成';
        assistantMessage.text = getLessonPlanAssistantText(rawReply) || '教案已生成，并已保存到课程。';
        if (meta.course) {
          courseDetail.value = meta.course;
          if (meta.course.lessonPlan) applyLessonPlanEvent('lessonPlan', meta.course.lessonPlan);
        }
      }
    });
    notify('AI 教案已生成');
    await nextTick();
    mainScroller.value?.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    assistantMessage.title = '生成失败';
    assistantMessage.text = error.message || 'AI 教案生成失败，请检查 DeepSeek 配置。';
    notify(error.message || 'AI 教案生成失败');
    if (!generatedLessonPlan.value?.steps?.length) generatedLessonPlan.value = null;
  } finally {
    generatingLesson.value = false;
  }
}

function scrollToSection(id) {
  activeSectionId.value = id;
  const target = document.getElementById(`lesson-section-${id}`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function syncActiveSection() {
  if (!lessonGenerated.value || !mainScroller.value) return;
  const scrollerTop = mainScroller.value.getBoundingClientRect().top;
  let current = lessonSections.value[0]?.id ?? '';
  lessonSections.value.forEach((section) => {
    const node = document.getElementById(`lesson-section-${section.id}`);
    if (!node) return;
    const offset = node.getBoundingClientRect().top - scrollerTop;
    if (offset <= 96) current = section.id;
  });
  activeSectionId.value = current;
}

function shouldStartLessonPlanGeneration(text) {
  if (lessonGenerated.value) return true;
  return /生成|教案|设计|重写|修改|优化|补充|调整|改成|改为/.test(text);
}

function sendCoachMessage(text = draft.value) {
  const value = text.trim();
  if (!value || generatingLesson.value) return;
  appendCourseChatMessage(courseId.value, { id: Date.now(), role: 'teacher', text: value });
  draft.value = '';
  if (!shouldStartLessonPlanGeneration(value)) {
    appendCourseChatMessage(courseId.value, {
      id: Date.now() + 1,
      role: 'ai',
      title: 'AI 教学助手',
      text: '教案还没有生成。请先点击左侧“AI 生成教案”，或直接告诉我“生成这节课的教案”。'
    });
    return;
  }
  generateLessonPlan(value);
}

function goBack() {
  router.push(`/preclass/courses/${courseId.value}/workspace`);
}

onMounted(loadPersistedLessonPlan);
</script>

<template>
  <main class="lp-page">
    <header class="lp-top">
      <button class="lp-btn back-btn" type="button" @click="goBack">
        <span class="material-symbols-outlined">chevron_left</span>
        返回大纲
      </button>
      <span class="lp-save"><i></i>已自动保存</span>
      <div class="lp-title">
        <h1>{{ courseTitle }}</h1>
        <p>{{ lessonGenerated ? `教案 ・ ${displayMeta.grade}${displayMeta.subject} ・ ${displayMeta.duration}` : '教案尚未生成，将沿用课程大纲和资料上下文。' }}</p>
      </div>
    </header>

    <section class="lp-shell" :class="{ 'is-generated': lessonGenerated }">
      <CourseWorkflowRail :course-id="courseId" active-step="lesson-plan" />

      <aside v-if="lessonGenerated" class="lp-rail">
        <header class="lp-rail-head">
          <div>
            <strong>教学环节</strong>
            <span>{{ lessonSteps.length }} 项</span>
          </div>
        </header>

        <div class="lp-progress-row">
          <span>完成度</span>
          <strong>{{ completedSteps }} / {{ lessonSteps.length }}</strong>
        </div>
        <div class="lp-progress"><i :style="{ width: progress }"></i></div>

        <div class="lp-step-list">
          <button
            v-for="step in lessonSteps"
            :key="step.id"
            class="lp-step"
            :class="{ active: activeSectionId === step.id, done: step.done }"
            type="button"
            @click="scrollToSection(step.id)"
          >
            <span class="lp-step-index">
              <span v-if="step.done" class="material-symbols-outlined">check</span>
              <b v-else>{{ step.number }}</b>
            </span>
            <span class="lp-step-copy">
              <strong>{{ step.title }}</strong>
              <small>{{ step.desc }}</small>
            </span>
            <em>{{ step.time }}</em>
          </button>
        </div>
      </aside>

      <section ref="mainScroller" class="lp-main" @scroll.passive="syncActiveSection">
        <article v-if="!lessonGenerated" class="lp-empty">
          <span class="small-chip">AI 教案生成</span>
          <h2>基于课程上下文生成第一版教案</h2>
          <p>系统会沿用前面已经确认的课程目标、上传资料和课程大纲，流式生成教学目标、重点难点、教师活动、学生活动和后续环节。</p>
          <p v-if="courseLoadError" class="lp-error-text">{{ courseLoadError }}</p>
          <div class="lp-empty-grid">
            <section><strong>课程目标</strong><span>{{ courseGoal || '等待数据库返回课程目标' }}</span></section>
            <section><strong>大纲结构</strong><span>根据当前大纲自动判断环节数量</span></section>
            <section><strong>资料依据</strong><span>教材实验要求、课标表述、易错点</span></section>
          </div>
          <button class="lp-primary" type="button" :disabled="generatingLesson || courseLoading || Boolean(courseLoadError)" @click="generateLessonPlan">
            <span class="material-symbols-outlined">{{ generatingLesson || courseLoading ? 'progress_activity' : 'auto_awesome' }}</span>
            {{ generatingLesson ? '正在生成教案...' : 'AI 生成教案' }}
          </button>
        </article>

        <template v-else>
        <div class="lp-filter-row">
          <span>学段 <strong>{{ displayMeta.grade }}</strong></span>
          <span>学科 <strong>{{ displayMeta.subject }}</strong></span>
          <span>教材 <strong>{{ displayMeta.textbook }}</strong></span>
          <span>课时 <strong>{{ displayMeta.duration }}</strong></span>
            <button type="button" @click="notify('课标对齐详情已展开')">
              <span class="material-symbols-outlined">auto_awesome</span>
              {{ generatingLesson ? 'AI 正在生成' : 'AI 已对齐课标' }}
            </button>
        </div>

        <article class="lp-card lp-objective">
          <header class="lp-card-head">
            <div>
              <h2>{{ lessonCards.objective.title }}</h2>
              <p>{{ lessonCards.objective.subtitle }}</p>
            </div>
          </header>
          <div class="lp-objective-grid">
            <section v-for="item in lessonCards.objective.items" :key="item.title">
              <strong>{{ item.title }}</strong>
              <p>{{ item.content }}</p>
            </section>
          </div>
        </article>

        <article class="lp-card lp-materials">
          <h2>课程依据</h2>
          <div class="lp-material-grid">
            <section v-for="item in lessonCards.materials" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </section>
          </div>
        </article>

        <div class="lp-focus-grid">
          <article class="lp-card">
            <h2>{{ lessonCards.focus.title }}</h2>
            <div class="lp-chips">
              <span v-for="chip in lessonCards.focus.chips" :key="chip">{{ chip }}</span>
            </div>
          </article>
          <article class="lp-card">
            <h2>{{ lessonCards.hard.title }}</h2>
            <div class="lp-hard-list">
              <span v-for="item in lessonCards.hard.items" :key="item">{{ item }}</span>
            </div>
          </article>
        </div>

        <article
          v-for="section in lessonSections"
          :id="`lesson-section-${section.id}`"
          :key="section.id"
          class="lp-card lp-activity"
          :class="{ active: activeSectionId === section.id }"
        >
          <header class="lp-activity-head">
            <span class="lp-activity-index">{{ section.id }}</span>
            <div>
              <h2>{{ section.title }} <em>{{ section.time }}</em></h2>
              <p>{{ section.intent }}</p>
            </div>
          </header>
          <div class="lp-activity-grid">
            <section>
              <h3><span class="material-symbols-outlined">groups</span>教师活动</h3>
              <ul>
                <li v-for="item in section.teacher" :key="item">{{ item }}</li>
              </ul>
            </section>
            <section>
              <h3><span class="material-symbols-outlined">sentiment_satisfied</span>学生活动</h3>
              <ul>
                <li v-for="item in section.student" :key="item">{{ item }}</li>
              </ul>
            </section>
          </div>
          <footer class="lp-section-foot">
            <span><b>板书</b>{{ section.board }}</span>
            <span><b>观察点</b>{{ section.check }}</span>
          </footer>
        </article>

        <article class="lp-card lp-next">
          <header class="lp-card-head">
            <div>
              <h2>课堂收束</h2>
              <p>生成后的教案可直接串联课件、题目和课后分析。</p>
            </div>
          </header>
          <div class="lp-next-grid">
            <section v-for="item in lessonClosing" :key="item.title">
              <strong>{{ item.title }}</strong>
              <p>{{ item.content }}</p>
            </section>
          </div>
        </article>
        </template>
      </section>

      <AiChat
        class="lp-coach"
        title="AI 教学助手"
        :messages="displayMessages"
        :loading="generatingLesson"
        loading-label="生成中"
        placeholder="教案生成后可继续追问"
        @send="sendCoachMessage"
      />
    </section>
  </main>
</template>

<style scoped>
.lp-page {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: var(--edu-topbar-h) minmax(0, 1fr);
  overflow: hidden;
  background: #f4faf6;
  color: var(--ink);
}

.lp-top {
  min-width: 0;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: var(--edu-gap-md);
  padding: 0 var(--edu-page-pad);
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .92);
}

.lp-title {
  min-width: 0;
}

.lp-title h1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--edu-title);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: 0;
}

.lp-title p {
  margin-top: 6px;
  overflow: hidden;
  color: var(--soft);
  font-size: var(--edu-body);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-actions,
.lp-filter-row,
.lp-card-head,
.lp-activity-head {
  display: flex;
  align-items: center;
  gap: var(--edu-gap-sm);
}

.lp-actions {
  justify-content: end;
}

.lp-btn,
.lp-primary,
.lp-card-head button,
.lp-activity-head button {
  display: inline-flex;
  height: var(--edu-control-compact-h);
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--edu-radius-sm);
  padding: 0 14px;
  font-size: var(--edu-body);
  font-weight: 750;
  white-space: nowrap;
}

.lp-btn,
.lp-card-head button,
.lp-activity-head button {
  border: 1px solid var(--line);
  background: #f8fcf9;
  color: var(--ink);
}

.lp-primary {
  border: 0;
  background: var(--deep);
  color: #80f3a8;
  box-shadow: 0 14px 26px rgba(10, 53, 34, .18);
}

.lp-save {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--mint);
  color: #229956;
  font-size: var(--edu-caption);
  font-weight: 700;
  white-space: nowrap;
}

.lp-save i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
}

.lp-shell {
  min-height: 0;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) var(--edu-side-panel);
  overflow: hidden;
}

.lp-shell.is-generated {
  grid-template-columns: 64px 190px minmax(0, 1fr) var(--edu-side-panel);
}

.lp-rail,
.lp-coach {
  min-height: 0;
  border-color: var(--line);
  background: rgba(255, 255, 255, .76);
}

.lp-rail {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  border-right: 1px solid var(--line);
}

.lp-rail-head {
  display: flex;
  min-width: 0;
  height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: var(--edu-gap-sm);
  padding: 0 12px 0 16px;
}

.lp-rail-head strong {
  font-size: var(--edu-subheading);
  font-weight: 800;
  letter-spacing: 0;
}

.lp-rail-head span {
  display: inline-flex;
  height: 22px;
  align-items: center;
  margin-left: 8px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--mint);
  color: #6f8a7e;
  font-size: var(--edu-caption);
  font-weight: 700;
}

.lp-coach-head button {
  display: grid;
  flex: 0 0 auto;
  width: var(--edu-icon-h);
  height: var(--edu-icon-h);
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: #f8fcf9;
  color: var(--green);
}

.lp-progress-row {
  display: flex;
  justify-content: space-between;
  padding: 0 18px;
  color: var(--muted);
  font-size: var(--edu-caption);
  font-weight: 700;
}

.lp-progress {
  height: 4px;
  margin: 8px 16px 14px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7f1eb;
}

.lp-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.lp-step-list {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: var(--edu-gap-xs);
  overflow-y: auto;
  padding: 0 10px 12px;
}

.lp-step {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  min-height: 50px;
  align-items: center;
  gap: var(--edu-gap-sm);
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--edu-radius-sm);
  background: transparent;
  text-align: left;
}

.lp-step.active {
  border-color: var(--green);
  background: #e7f7ee;
}

.lp-step-index {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #edf7f1;
  color: #1aa65b;
  font-size: 12px;
  font-weight: 800;
}

.lp-step.active .lp-step-index {
  background: var(--green);
  color: #fff;
}

.lp-step-copy {
  min-width: 0;
}

.lp-step-copy strong,
.lp-step-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-step-copy strong {
  font-size: var(--edu-body);
  font-weight: 800;
}

.lp-step-copy small,
.lp-step em {
  color: var(--soft);
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
}

.lp-main {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--edu-page-pad);
  scroll-behavior: smooth;
}

.lp-empty {
  display: grid;
  align-content: center;
  min-height: 100%;
  max-width: 820px;
  margin: 0 auto;
}

.lp-empty h2 {
  margin-top: 16px;
  font-family: var(--font-serif);
  font-size: 32px;
  line-height: 1.18;
}

.lp-empty p {
  margin-top: 12px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.72;
}

.lp-error-text {
  color: #b42318 !important;
  font-weight: 750;
}

.lp-empty-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--edu-gap-sm);
  margin: 26px 0 24px;
}

.lp-empty-grid section {
  min-height: 92px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: rgba(255, 255, 255, .72);
  padding: 14px;
}

.lp-empty-grid strong,
.lp-empty-grid span {
  display: block;
}

.lp-empty-grid strong {
  font-size: 14px;
}

.lp-empty-grid span {
  margin-top: 9px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.lp-empty .lp-primary {
  justify-self: start;
  height: var(--edu-control-h);
  padding: 0 18px;
}

.lp-empty .lp-primary:disabled .material-symbols-outlined {
  animation: lp-spin 1.1s linear infinite;
}

@keyframes lp-spin {
  to {
    transform: rotate(360deg);
  }
}

.lp-filter-row {
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.lp-filter-row span,
.lp-filter-row button {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 8px;
  border-radius: var(--edu-radius-sm);
  padding: 0 12px;
  font-size: var(--edu-caption);
  font-weight: 700;
}

.lp-filter-row span {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .82);
  color: var(--soft);
}

.lp-filter-row span strong {
  color: var(--ink);
}

.lp-filter-row button {
  margin-left: auto;
  border: 0;
  background: var(--mint);
  color: #229956;
}

.lp-card {
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-lg);
  background: rgba(255, 255, 255, .78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .68);
}

.lp-card + .lp-card,
.lp-focus-grid,
.lp-next,
.lp-materials {
  margin-top: 12px;
}

.lp-card {
  padding: 14px 16px;
}

.lp-card-head {
  justify-content: space-between;
  align-items: flex-start;
}

.lp-card h2,
.lp-activity h2 {
  font-family: var(--font-serif);
  font-size: var(--edu-subheading);
  line-height: 1.25;
  font-weight: 850;
  letter-spacing: 0;
}

.lp-activity h2 {
  font-size: var(--edu-heading);
}

.lp-card-head p,
.lp-activity-head p {
  margin-top: 6px;
  color: var(--soft);
  font-size: var(--edu-body);
  font-weight: 600;
  line-height: 1.5;
}

.lp-objective-grid,
.lp-focus-grid,
.lp-activity-grid,
.lp-next-grid {
  display: grid;
  gap: var(--edu-gap-md);
}

.lp-objective-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-top: 12px;
}

.lp-objective-grid section,
.lp-activity-grid section,
.lp-next-grid section {
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: #f6fbf8;
}

.lp-objective-grid section {
  min-height: 68px;
  padding: 12px;
}

.lp-objective-grid strong,
.lp-activity-grid h3 {
  color: #159251;
  font-size: var(--edu-body-lg);
  font-weight: 850;
}

.lp-objective-grid p {
  margin-top: 7px;
  color: var(--muted);
  font-size: var(--edu-body);
  line-height: 1.5;
}

.lp-focus-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.lp-material-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--edu-gap-sm);
  margin-top: 12px;
}

.lp-material-grid section {
  min-height: 66px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: #f6fbf8;
}

.lp-material-grid span,
.lp-material-grid strong {
  display: block;
}

.lp-material-grid span {
  color: var(--soft);
  font-size: var(--edu-caption);
  font-weight: 750;
}

.lp-material-grid strong {
  margin-top: 7px;
  color: var(--ink);
  font-size: var(--edu-body);
  font-weight: 800;
  line-height: 1.45;
}

.lp-chips,
.lp-hard-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--edu-gap-sm);
  margin-top: 12px;
}

.lp-chips span,
.lp-hard-list span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  padding: 0 12px;
  font-size: var(--edu-caption);
  font-weight: 800;
}

.lp-chips span {
  background: var(--mint);
  color: #229956;
}

.lp-hard-list span {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
}

.lp-activity-head {
  align-items: flex-start;
}

.lp-activity {
  scroll-margin-top: 16px;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.lp-activity.active {
  border-color: rgba(31, 181, 95, .46);
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 14px 34px rgba(31, 181, 95, .1), inset 0 1px 0 rgba(255, 255, 255, .72);
}

.lp-activity-index {
  display: grid;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: var(--green);
  color: #fff;
  font-family: var(--font-number);
  font-size: 18px;
  font-weight: 900;
}

.lp-activity-head > div {
  min-width: 0;
  flex: 1;
}

.lp-activity h2 em {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  margin-left: 8px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--mint);
  color: #229956;
  font-size: var(--edu-caption);
  font-style: normal;
  font-weight: 800;
  vertical-align: 2px;
}

.lp-activity-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.lp-activity-grid section {
  padding: 12px;
}

.lp-activity-grid h3 {
  display: flex;
  align-items: center;
  gap: var(--edu-gap-xs);
  font-size: var(--edu-body-lg);
}

.lp-activity-grid ul {
  display: grid;
  gap: var(--edu-gap-xs);
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.lp-activity-grid li {
  position: relative;
  padding-left: 14px;
  color: var(--muted);
  font-size: var(--edu-body);
  line-height: 1.52;
}

.lp-activity-grid li::before {
  content: "";
  position: absolute;
  left: 0;
  top: .62em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--green);
}

.lp-section-foot {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--edu-gap-sm);
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.lp-section-foot span {
  display: block;
  min-height: 52px;
  padding: 11px 12px;
  border-radius: var(--edu-radius-md);
  background: #eef8f2;
  color: var(--muted);
  font-size: var(--edu-body);
  line-height: 1.5;
}

.lp-section-foot b {
  display: block;
  margin-bottom: 5px;
  color: #159251;
  font-size: var(--edu-caption);
  font-weight: 850;
}

.lp-next-grid {
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  margin-top: 12px;
}

.lp-next-grid section {
  min-height: 88px;
  padding: 11px;
}

.lp-next-grid strong {
  font-size: var(--edu-body);
  line-height: 1.4;
}

.lp-next-grid em {
  margin-left: 5px;
  color: var(--soft);
  font-style: normal;
}

.lp-next-grid p {
  margin-top: 8px;
  color: var(--muted);
  font-size: var(--edu-body);
  line-height: 1.45;
}

.lp-next-grid footer {
  display: flex;
  gap: 12px;
  margin-top: 9px;
  font-size: 12px;
}

.lp-next-grid section {
  display: block;
}

.lp-next-grid b {
  color: #159251;
}

.lp-next-grid span {
  color: var(--soft);
}

.lp-coach {
  min-width: 0;
  display: grid;
  grid-template-rows: 58px minmax(0, 1fr) auto;
  border-left: 1px solid var(--line);
}

.lp-coach-head {
  min-width: 0;
  display: grid;
  grid-template-columns: var(--edu-icon-h) minmax(0, 1fr) var(--edu-icon-h);
  align-items: center;
  gap: var(--edu-gap-sm);
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
}

.lp-coach-head strong,
.lp-coach-head span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-coach-head strong {
  font-size: 15px;
  font-weight: 850;
}

.lp-coach-head span {
  margin-top: 4px;
  color: var(--soft);
  font-size: var(--edu-caption);
}

@media (max-width: 1320px) {
  .lp-top {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .lp-save {
    display: none;
  }

  .lp-shell {
    grid-template-columns: 64px minmax(0, 1fr) 320px;
  }

  .lp-shell.is-generated {
    grid-template-columns: 64px 168px minmax(0, 1fr) 320px;
  }

  .lp-main {
    padding: 14px;
  }

  .lp-material-grid {
    grid-template-columns: 1fr;
  }

  .lp-actions .lp-btn {
    padding: 0 12px;
  }
}

@media (max-width: 1180px) {
  .lp-shell {
    grid-template-columns: 64px minmax(0, 1fr) 316px;
  }

  .lp-shell.is-generated {
    grid-template-columns: 64px 72px minmax(0, 1fr) 316px;
  }

  .lp-rail-head div,
  .lp-progress-row,
  .lp-progress,
  .lp-step-copy,
  .lp-step em {
    display: none;
  }

  .lp-rail-head {
    justify-content: center;
    padding: 0;
  }

  .lp-step {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 8px;
  }

  .lp-section-foot {
    grid-template-columns: 1fr;
  }

}
</style>
