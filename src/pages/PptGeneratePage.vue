<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PptTopBar from '../components/PptTopBar.vue';
import SlidePreviewRail from '../components/SlidePreviewRail.vue';
import PptCanvas from '../components/PptCanvas.vue';
import BottomSlideControls from '../components/BottomSlideControls.vue';
import AiChat from '../components/AiChat.vue';
import { voiceInputMock } from '../data/pptMock';
import { appendCourseChatMessage, getCourseChat, notify, streamCourseChatMessage } from '../data/mockStore';
import { loadWorkspaceCourse, resolveWorkspaceFallbackCourse } from '../data/workspaceCourseLoader';

const route = useRoute();
const router = useRouter();

const courseId = computed(() => String(route.params.courseId));
const course = ref(resolveWorkspaceFallbackCourse(route.params.courseId));
const courseChat = computed(() => getCourseChat(courseId.value));
const messages = computed(() => courseChat.value.messages);
const slides = ref([]);
const currentIndex = ref(0);
const generatedSlideCount = ref(0);
const pptGenerating = ref(true);
const courseLoading = ref(false);
const courseLoadError = ref('');
const aiLoading = ref(false);
const pickerMode = ref(false);
const selectedElement = ref(null);
const appliedEdits = ref({});
const coverReplacing = ref(false);
let pptTimer = 0;
let courseLoadToken = 0;

const courseTitle = computed(() => course.value?.shortTitle || course.value?.title || courseId.value);
const currentSlide = computed(() => slides.value[currentIndex.value] || slides.value[0] || null);
const currentSlideLabel = computed(() => `${String((currentSlide.value?.id || currentIndex.value + 1)).padStart(2, '0')} · ${currentSlide.value?.label || '幻灯片'}`);
const visibleSlides = computed(() => slides.value.slice(0, Math.max(generatedSlideCount.value, 1)));

function getCourseTopic(courseValue) {
  const rawTitle = String(courseValue?.title || courseValue?.shortTitle || courseId.value || '课程课件');
  const titleMatch = rawTitle.match(/《([^》]+)》/);
  if (titleMatch) return titleMatch[1];
  return rawTitle.split(/[·・•\-]/).map((item) => item.trim()).filter(Boolean).at(-1) || rawTitle;
}

function getFallbackSlideImage(slideNumber) {
  const normalized = Math.min(Math.max(Number(slideNumber) || 1, 1), 16);
  return `/assets/newton-ppt/slide-${String(normalized).padStart(2, '0')}.png`;
}

function normalizePersistedSlide(slide, index) {
  const meta = [course.value?.grade, course.value?.subject, course.value?.duration].filter(Boolean).join(' · ');
  return {
    id: slide.id || index + 1,
    label: slide.label || slide.title || `第 ${index + 1} 页`,
    title: slide.title || getCourseTopic(course.value),
    subtitle: slide.subtitle || slide.desc || '',
    footer: slide.footer || meta,
    bullets: Array.isArray(slide.bullets) ? slide.bullets : [],
    imageSrc: slide.imageSrc || slide.image || null,
    marker: slide.marker || String(index + 1).padStart(2, '0'),
    generated: !slide.imageSrc && !slide.image
  };
}

function buildCourseSlides(courseValue) {
  const topic = getCourseTopic(courseValue);
  const meta = [courseValue?.grade, courseValue?.subject, courseValue?.duration].filter(Boolean).join(' · ');
  const knowledge = Array.isArray(courseValue?.knowledge) && courseValue.knowledge.length
    ? courseValue.knowledge
    : ['课程目标', '核心概念', '课堂检测'];
  const outlineSections = Array.isArray(courseValue?.outline?.sections) ? courseValue.outline.sections : [];
  const sectionSlides = outlineSections.slice(0, 8).map((section, index) => ({
    id: index + 3,
    label: section.phase || `环节 ${index + 1}`,
    title: section.title || `教学环节 ${index + 1}`,
    subtitle: section.time || '',
    bullets: (section.cards || []).slice(0, 3).map((card) => (
      Array.isArray(card) ? `${card[0]}：${card[1]}` : `${card.label || card.title}：${card.content || card.desc || ''}`
    )),
    imageSrc: getFallbackSlideImage(index + 3),
    marker: String(index + 3).padStart(2, '0'),
    generated: false
  }));
  const bodySlides = sectionSlides.length ? sectionSlides : [
    {
      id: 3,
      label: '目标',
      title: '教学目标',
      subtitle: courseValue?.goal || '等待课程目标补充',
      bullets: [courseValue?.summary || '结合课程基础信息组织教学活动']
    },
    {
      id: 4,
      label: '知识点',
      title: '核心知识点',
      subtitle: `${knowledge.length} 个知识点`,
      bullets: knowledge
    },
    {
      id: 5,
      label: '检测',
      title: '课堂检测与反馈',
      subtitle: '题目、作答和学情分析联动',
      bullets: ['选择题即时检测', '填空题巩固表达', '错因进入学情画像']
    }
  ].map((slide) => ({ ...slide, imageSrc: getFallbackSlideImage(slide.id), marker: String(slide.id).padStart(2, '0'), generated: false }));

  return [
    {
      id: 1,
      label: '封面',
      title: topic,
      subtitle: courseValue?.goal || courseValue?.summary || '基于课程信息生成的 PPT 课件',
      footer: meta,
      imageSrc: getFallbackSlideImage(1),
      marker: '01',
      generated: false
    },
    {
      id: 2,
      label: '目录',
      title: '课堂结构',
      subtitle: outlineSections.length ? '沿用课程大纲组织课件页' : '围绕目标、知识点、活动和检测展开',
      bullets: outlineSections.length ? outlineSections.slice(0, 5).map((section) => section.title) : ['课程目标对齐', '核心知识建构', '课堂活动推进', '题目检测反馈'],
      imageSrc: getFallbackSlideImage(2),
      marker: '02',
      generated: false
    },
    ...bodySlides,
    {
      id: bodySlides.length + 3,
      label: '总结',
      title: '总结与延伸',
      subtitle: '回到课程目标，形成课后数据回流',
      bullets: knowledge.slice(0, 3),
      footer: meta,
      imageSrc: getFallbackSlideImage(bodySlides.length + 3),
      marker: String(bodySlides.length + 3).padStart(2, '0'),
      generated: false
    }
  ];
}

function syncSlidesFromCourse() {
  const persistedSlides = course.value?.ppt?.slides;
  const nextSlides = Array.isArray(persistedSlides) && persistedSlides.length
    ? persistedSlides.map(normalizePersistedSlide)
    : buildCourseSlides(course.value);
  slides.value = nextSlides;
  currentIndex.value = Math.min(currentIndex.value, Math.max(nextSlides.length - 1, 0));
  generatedSlideCount.value = Math.min(Math.max(generatedSlideCount.value || 1, 1), nextSlides.length);
}

async function refreshCourse(id) {
  const token = ++courseLoadToken;
  courseLoading.value = true;
  courseLoadError.value = '';
  try {
    const result = await loadWorkspaceCourse(String(id));
    if (token !== courseLoadToken) return;
    course.value = result.course;
    courseLoadError.value = result.course ? '' : (result.error?.message || '课程加载失败');
    syncSlidesFromCourse();
  } finally {
    if (token === courseLoadToken) courseLoading.value = false;
  }
}

function selectSlide(index) {
  currentIndex.value = index;
  selectedElement.value = null;
}

function goPrev() {
  currentIndex.value = Math.max(0, currentIndex.value - 1);
}

function goNext() {
  currentIndex.value = Math.min(slides.value.length - 1, currentIndex.value + 1);
}

function applyAiSuggestion() {
  if (aiLoading.value || !slides.value.length) return;
  aiLoading.value = true;
  window.setTimeout(() => {
    const cover = slides.value[0];
    if (cover) cover.subtitle = '基于当前课程的教学目标和课堂节奏优化首页文案';
    streamCourseChatMessage(courseId.value, {
      id: Date.now(),
      role: 'ai',
      time: '04:24',
      title: '已采纳',
      text: '我已把修改同步到封面和当前页面，可继续预览或进入下一页。'
    }, {
      delay: 1400,
      onDone: () => {
        aiLoading.value = false;
      }
    });
  }, 500);
}

function sendMessage(text) {
  if (aiLoading.value) return;
  const value = String(text || '').trim();
  if (!value) return;

  appendCourseChatMessage(courseId.value, {
    id: Date.now(),
    role: 'teacher',
    text: value
  });
  aiLoading.value = true;

  if (currentIndex.value === 0 && slides.value[0]) {
    coverReplacing.value = true;
    window.setTimeout(() => {
      slides.value[0] = {
        ...slides.value[0],
        subtitle: `${getCourseTopic(course.value)} · 当前课程的封面已更新`,
        imageSrc: '/assets/newton-ppt/slide-01-revised.png'
      };
      coverReplacing.value = false;
      streamCourseChatMessage(courseId.value, {
        id: Date.now() + 1,
        role: 'ai',
        time: '04:25',
        title: '封面已更新',
        text: '我已根据当前课程信息替换封面文案，后续页面会继续沿用这门课的上下文。'
      }, {
        delay: 1200,
        onDone: () => {
          aiLoading.value = false;
        }
      });
    }, 1200);
    return;
  }

  window.setTimeout(() => {
    streamCourseChatMessage(courseId.value, {
      id: Date.now() + 1,
      role: 'ai',
      time: '04:25',
      title: '收到修改',
      text: '我已记录你的修改要求，后续页面会继续保持和当前课程一致。'
    }, {
      delay: 1200,
      onDone: () => {
        aiLoading.value = false;
      }
    });
  }, 500);
}

function goBack() {
  router.push(`/preclass/courses/${courseId.value}/workspace`);
}

function selectElement(element) {
  selectedElement.value = element;
  pickerMode.value = false;
}

onMounted(() => {
  syncSlidesFromCourse();
  refreshCourse(courseId.value);
  generatedSlideCount.value = 1;
  pptTimer = window.setInterval(() => {
    generatedSlideCount.value = Math.min(slides.value.length, generatedSlideCount.value + 1);
    if (generatedSlideCount.value >= slides.value.length) {
      window.clearInterval(pptTimer);
      pptGenerating.value = false;
      notify('PPT 已生成完成');
    }
  }, 5000);
});

onUnmounted(() => {
  window.clearInterval(pptTimer);
});

watch(
  () => route.params.courseId,
  (nextCourseId) => {
    course.value = resolveWorkspaceFallbackCourse(nextCourseId);
    currentIndex.value = 0;
    generatedSlideCount.value = 1;
    pptGenerating.value = true;
    syncSlidesFromCourse();
    refreshCourse(nextCourseId);
  }
);
</script>

<template>
  <section class="ppt-page">
    <PptTopBar
      :course-title="courseTitle"
      :current="currentIndex + 1"
      :total="slides.length"
      @back="goBack"
      @export="notify('PPT 已导出到演示下载队列')"
    />

    <main class="ppt-workspace">
      <SlidePreviewRail
        :slides="visibleSlides"
        :current-index="currentIndex"
        @select="selectSlide"
      />

      <section class="canvas-column">
        <PptCanvas
          :slide="currentSlide || {}"
          :current="currentIndex + 1"
          :picker-mode="pickerMode"
          :selected-element="selectedElement"
          :applied-edits="appliedEdits"
          @select-element="selectElement"
        />
        <div v-if="coverReplacing" class="cover-replace-loading">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>正在替换封面</strong>
          <p>AI 正在读取修改要求，并用新的课程封面更新当前第一页。</p>
        </div>
        <BottomSlideControls
          :current="currentIndex + 1"
          :total="slides.length"
          @prev="goPrev"
          @next="goNext"
        />
      </section>

      <AiChat
        :messages="messages"
        :current-slide-label="currentSlideLabel"
        :loading="aiLoading"
        :picker-mode="pickerMode"
        :selected-element="selectedElement"
        :voice-input="voiceInputMock"
        show-voice
        @apply="applyAiSuggestion"
        @toggle-picker="pickerMode = !pickerMode"
        @clear-selection="selectedElement = null"
        @send="sendMessage"
      />
    </main>

    <div v-if="pptGenerating" class="ppt-generate-overlay">
      <div>
        <span class="material-symbols-outlined">auto_awesome</span>
        <strong>{{ courseLoading ? '正在读取课程信息' : '正在生成 PPT' }}</strong>
        <p>{{ courseLoadError || `已生成 ${generatedSlideCount} / ${slides.length} 页，系统会约每 5 秒生成一页。` }}</p>
        <i><b :style="{ width: `${generatedSlideCount / Math.max(slides.length, 1) * 100}%` }"></b></i>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ppt-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(10, 53, 34, .08), transparent 36%),
    var(--wash);
}

.ppt-workspace {
  display: grid;
  grid-template-columns: clamp(172px, 13vw, 198px) minmax(0, 1fr) var(--edu-side-panel);
  height: calc(100vh - var(--edu-topbar-h));
}

.canvas-column {
  position: relative;
  min-width: 0;
  border-right: 1px solid var(--line);
  overflow: hidden;
  background: #edf7f1;
}

.cover-replace-loading {
  position: absolute;
  inset: 0 0 56px;
  z-index: 22;
  display: grid;
  place-items: center;
  gap: 12px;
  background: rgba(244, 250, 246, .68);
  backdrop-filter: blur(8px);
  align-content: center;
  text-align: center;
}

.cover-replace-loading > span {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
  font-size: 28px;
  animation: pulse-generate 1.2s ease-in-out infinite;
}

.cover-replace-loading strong,
.ppt-generate-overlay strong {
  font-family: var(--font-serif);
  font-size: 24px;
}

.cover-replace-loading p,
.ppt-generate-overlay p {
  max-width: 360px;
  color: var(--soft);
  font-size: 13px;
  line-height: 1.7;
}

.ppt-generate-overlay {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 50;
  pointer-events: none;
}

.ppt-generate-overlay div {
  display: grid;
  min-width: 300px;
  gap: 14px;
  justify-items: center;
  border: 1px solid rgba(255, 255, 255, .74);
  border-radius: 18px;
  background: rgba(255, 255, 255, .86);
  padding: 20px;
  box-shadow: 0 28px 80px rgba(10, 53, 34, .18);
  backdrop-filter: blur(14px);
}

.ppt-generate-overlay .material-symbols-outlined {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
  font-size: 28px;
  animation: pulse-generate 1.2s ease-in-out infinite;
}

.ppt-generate-overlay i {
  width: 280px;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(10, 53, 34, .08);
}

.ppt-generate-overlay b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
  transition: width .3s ease;
}

@keyframes pulse-generate {
  50% {
    transform: scale(1.06);
  }
}

@media (max-width: 1280px) {
  .ppt-workspace {
    grid-template-columns: 158px minmax(0, 1fr) 318px;
  }
}
</style>
