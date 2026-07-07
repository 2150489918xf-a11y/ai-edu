<script setup>
import { computed, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiChat from '../components/AiChat.vue';
import { lessonCards, lessonSections, lessonSteps } from '../data/lessonPlanMock';
import { appendCourseChatMessage, getCourse, getCourseChat, notify, streamCourseChatMessage } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => String(route.params.courseId));
const course = computed(() => getCourse(route.params.courseId));
const courseChat = computed(() => getCourseChat(courseId.value));

const draft = ref('');
const lessonGenerated = ref(false);
const generatingLesson = ref(false);
const activeSectionId = ref(1);
const mainScroller = ref(null);
const messages = computed(() => courseChat.value.messages);

const completedSteps = computed(() => lessonSteps.filter((step) => step.done || step.active).length);
const progress = computed(() => `${Math.round((completedSteps.value / lessonSteps.length) * 100)}%`);

function generateLessonPlan() {
  if (generatingLesson.value) return;
  generatingLesson.value = true;
  window.setTimeout(() => {
    lessonGenerated.value = true;
    generatingLesson.value = false;
    streamCourseChatMessage(courseId.value, {
      id: Date.now(),
      role: 'ai',
      time: '12:10',
      text: '教案已生成。我已沿用课程目标、大纲结构和资料解析结果，生成教学目标、重点难点、教师活动和学生活动。'
    }, { delay: 3000 });
    notify('AI 教案已生成');
    nextTick(() => {
      mainScroller.value?.scrollTo({ top: 0, behavior: 'smooth' });
      activeSectionId.value = 1;
    });
  }, 10000);
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
  let current = lessonSections[0]?.id ?? 1;
  lessonSections.forEach((section) => {
    const node = document.getElementById(`lesson-section-${section.id}`);
    if (!node) return;
    const offset = node.getBoundingClientRect().top - scrollerTop;
    if (offset <= 96) current = section.id;
  });
  activeSectionId.value = current;
}

function sendCoachMessage(text = draft.value) {
  const value = text.trim();
  if (!value) return;
  appendCourseChatMessage(courseId.value, { id: Date.now(), role: 'teacher', text: value });
  streamCourseChatMessage(courseId.value, {
    id: Date.now() + 1,
    role: 'ai',
    time: '12:11',
    text: '我会沿用这门课已经确认的目标、大纲和资料上下文，基于当前教案环节改写，并优先保持重点、活动结构和课堂节奏不变。'
  }, { delay: 3000 });
  draft.value = '';
}

function goBack() {
  router.push(`/preclass/courses/${course.value.id}/workspace`);
}
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
        <h1>{{ course.shortTitle }}</h1>
        <p>{{ lessonGenerated ? '教案 ・ 高一物理 ・ 第 3 课时 / 共 12 课时 ・ 45 分钟' : '教案尚未生成，将沿用课程大纲和资料上下文。' }}</p>
      </div>
    </header>

    <section class="lp-shell" :class="{ 'is-generated': lessonGenerated }">
      <nav class="lp-course-rail" aria-label="课程工作台步骤">
        <button class="lp-course-step" type="button" @click="router.push(`/preclass/courses/${course.id}/workspace`)">
          <span class="material-symbols-outlined">auto_awesome</span>
          生成
        </button>
        <button class="lp-course-step" type="button" @click="router.push(`/preclass/courses/${course.id}/ppt`)">
          <span class="material-symbols-outlined">desktop_windows</span>
          PPT
        </button>
        <button class="lp-course-step active" type="button">
          <span class="material-symbols-outlined">article</span>
          教案
        </button>
        <button class="lp-course-step" type="button" @click="router.push(`/preclass/courses/${course.id}/analysis`)">
          <span class="material-symbols-outlined">analytics</span>
          题析
        </button>
        <div class="lp-ai-mark">AI</div>
      </nav>

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
            :class="{ active: activeSectionId === step.id, done: step.done || activeSectionId > step.id }"
            type="button"
            @click="scrollToSection(step.id)"
          >
            <span class="lp-step-index">
              <span v-if="step.done" class="material-symbols-outlined">check</span>
              <b v-else>{{ step.id }}</b>
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
          <p>系统会沿用前面已经确认的课程目标、上传资料和四段式大纲，生成教学目标、重点难点、教师活动、学生活动和后续环节。</p>
          <div class="lp-empty-grid">
            <section><strong>课程目标</strong><span>F=ma ・ 实验探究 ・ 基础应用</span></section>
            <section><strong>大纲结构</strong><span>导入 / 探究 / 建构 / 检测</span></section>
            <section><strong>资料依据</strong><span>教材实验要求、课标表述、易错点</span></section>
          </div>
          <button class="lp-primary" type="button" :disabled="generatingLesson" @click="generateLessonPlan">
            <span class="material-symbols-outlined">{{ generatingLesson ? 'progress_activity' : 'auto_awesome' }}</span>
            {{ generatingLesson ? '正在生成教案...' : 'AI 生成教案' }}
          </button>
        </article>

        <template v-else>
        <div class="lp-filter-row">
          <span>学段 <strong>高一</strong></span>
          <span>学科 <strong>物理</strong></span>
          <span>教材 <strong>人教版 2019 ・ 必修 1</strong></span>
          <span>课时 <strong>45 分钟</strong></span>
            <button type="button" @click="notify('课标对齐详情已展开')">
              <span class="material-symbols-outlined">auto_awesome</span>
              AI 已对齐课标
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
            <section>
              <strong>{{ lessonCards.objective.chips[0] }}</strong>
              <p>{{ lessonCards.objective.text }}</p>
            </section>
            <section>
              <strong>{{ lessonCards.objective.chips[1] }}</strong>
              <p>通过购物车和小车实验，完成观察、实验、图像、归纳的探究路径。</p>
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
            <section>
              <strong>课件联动</strong>
              <p>四段大纲已经映射到 PPT 页面，可按教学环节逐页授课。</p>
            </section>
            <section>
              <strong>题目联动</strong>
              <p>课堂检测题可在授课时下发，并记录答题正确率。</p>
            </section>
            <section>
              <strong>课后联动</strong>
              <p>课堂表现、错因标签和作业订正会进入课后分析。</p>
            </section>
          </div>
        </article>
        </template>
      </section>

      <AiChat
        class="lp-coach"
        title="AI 教学助手"
        :messages="messages"
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
  grid-template-columns: 80px minmax(0, 1fr) var(--edu-side-panel);
  overflow: hidden;
}

.lp-shell.is-generated {
  grid-template-columns: 80px 190px minmax(0, 1fr) var(--edu-side-panel);
}

.lp-course-rail {
  position: relative;
  display: grid;
  grid-auto-rows: 72px;
  align-content: start;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, .64);
}

.lp-course-step {
  display: grid;
  place-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--soft);
  font-size: 11px;
  font-weight: 750;
}

.lp-course-step .material-symbols-outlined {
  font-size: 22px;
}

.lp-course-step.active {
  width: 72px;
  height: 60px;
  margin: 10px 8px 2px 0;
  border-radius: 0 var(--edu-radius-md) var(--edu-radius-md) 0;
  background: var(--deep);
  color: #7df0a0;
}

.lp-ai-mark {
  position: absolute;
  left: 50%;
  bottom: 22px;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
  font-family: var(--font-number);
  font-size: 13px;
  font-weight: 800;
  transform: translateX(-50%);
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
    grid-template-columns: minmax(0, 1fr) 320px;
  }

  .lp-shell.is-generated {
    grid-template-columns: 168px minmax(0, 1fr) 320px;
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
    grid-template-columns: minmax(0, 1fr) 316px;
  }

  .lp-shell.is-generated {
    grid-template-columns: 72px minmax(0, 1fr) 316px;
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
