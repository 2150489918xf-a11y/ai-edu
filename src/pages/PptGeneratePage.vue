<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PptTopBar from '../components/PptTopBar.vue';
import SlidePreviewRail from '../components/SlidePreviewRail.vue';
import PptCanvas from '../components/PptCanvas.vue';
import BottomSlideControls from '../components/BottomSlideControls.vue';
import AiChat from '../components/AiChat.vue';
import { voiceInputMock } from '../data/pptMock';
import { appendCourseChatMessage, getCourse, getCourseChat, notify, store, streamCourseChatMessage } from '../data/mockStore';

const route = useRoute();
const router = useRouter();

const courseId = computed(() => String(route.params.courseId));
const course = computed(() => getCourse(route.params.courseId));
const courseChat = computed(() => getCourseChat(courseId.value));
const slides = ref(store.slides.map((slide) => ({ ...slide })));
const messages = computed(() => courseChat.value.messages);
const currentIndex = ref(0);
const aiLoading = ref(false);
const pickerMode = ref(false);
const selectedElement = ref(null);
const appliedEdits = ref({});
const generatedSlideCount = ref(0);
const pptGenerating = ref(true);
const coverReplacing = ref(false);
let pptTimer = 0;

const currentSlide = computed(() => slides.value[currentIndex.value]);
const currentSlideLabel = computed(() => `${String(currentSlide.value.id).padStart(2, '0')} ・ ${currentSlide.value.label}`);
const visibleSlides = computed(() => slides.value.slice(0, Math.max(generatedSlideCount.value, 1)));

onMounted(() => {
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
  if (aiLoading.value) return;
  aiLoading.value = true;
  window.setTimeout(() => {
    const cover = slides.value[0];
    cover.subtitle = '同样推一下，为什么有的物体更难加速？';
    streamCourseChatMessage(courseId.value, {
      id: Date.now(),
      role: 'ai',
      time: '04:24',
      title: '已采纳',
      text: '我已将改动同步到封面副标题，当前页可继续预览或进入下一页。'
    }, {
      delay: 3000,
      onDone: () => {
        aiLoading.value = false;
      }
    });
  }, 800);
}

function sendMessage(text) {
  if (aiLoading.value) return;
  appendCourseChatMessage(courseId.value, {
    id: Date.now(),
    role: 'teacher',
    text
  });
  aiLoading.value = true;
  if (currentIndex.value === 0) {
    coverReplacing.value = true;
    window.setTimeout(() => {
      slides.value[0] = {
        ...slides.value[0],
        title: '牛顿第二定律',
        subtitle: '力改变运动：从现象到定律',
        imageSrc: '/assets/newton-ppt/slide-01-revised.png'
      };
      coverReplacing.value = false;
      streamCourseChatMessage(courseId.value, {
        id: Date.now() + 1,
        role: 'ai',
        time: '04:25',
        title: '首页已替换',
        text: '已按你的修改要求替换第一页首页，新的封面使用“力改变运动：从现象到定律”的视觉版本，并保留后续页面不变。'
      }, {
        delay: 3000,
        onStart: () => {
          aiLoading.value = false;
        },
        onDone: () => {
          aiLoading.value = false;
        }
      });
      notify('首页已替换');
    }, 2600);
    return;
  }
  window.setTimeout(() => {
    if (selectedElement.value) {
      const page = currentIndex.value + 1;
      const element = selectedElement.value;
      const nextText = element.text === '牛顿第二定律'
        ? '牛顿第二定律：力如何改变运动'
        : '用课堂语言重新表达';
      appliedEdits.value = {
        ...appliedEdits.value,
        [page]: [
          ...(appliedEdits.value[page] || []).filter((edit) => edit.id !== element.id),
          {
            id: element.id,
            role: element.role,
            text: nextText,
            style: {
              left: `${element.bounds.x / 1280 * 100}%`,
              top: `${element.bounds.y / 720 * 100}%`,
              width: `${element.bounds.width / 1280 * 100}%`,
              height: `${element.bounds.height / 720 * 100}%`
            }
          }
        ]
      };
    }
    streamCourseChatMessage(courseId.value, {
      id: Date.now() + 1,
      role: 'ai',
      time: '04:25',
      title: selectedElement.value ? '已应用修改' : '收到修改要求',
      text: selectedElement.value
        ? `已根据这门课的教学目标和大纲节奏，优化当前引用的课件元素，并保留原 PPT 版式。`
        : '我会结合这门课已经沉淀的目标、大纲和资料内容，基于当前页生成一版更清晰的表达，并优先保持版式不变。'
    }, {
      delay: 3000,
      onDone: () => {
        aiLoading.value = false;
      }
    });
  }, 850);
}

function goBack() {
  router.push(`/preclass/courses/${course.value.id}/workspace`);
}

function selectElement(element) {
  selectedElement.value = element;
  pickerMode.value = false;
}
</script>

<template>
  <section class="ppt-page">
    <PptTopBar
      :course-title="course.shortTitle"
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
          :slide="currentSlide"
          :current="currentIndex + 1"
          :picker-mode="pickerMode"
          :selected-element="selectedElement"
          :applied-edits="appliedEdits"
          @select-element="selectElement"
        />
        <div v-if="coverReplacing" class="cover-replace-loading">
          <span class="material-symbols-outlined">auto_awesome</span>
          <strong>正在替换首页</strong>
          <p>AI 正在读取修改要求，并用新版 PPT 首页替换当前第一页。</p>
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
        <strong>正在生成 PPT</strong>
        <p>已生成 {{ generatedSlideCount }} / {{ slides.length }} 页，系统会约每 5 秒生成一页。</p>
        <i><b :style="{ width: `${generatedSlideCount / slides.length * 100}%` }"></b></i>
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
  background: rgba(244, 250, 246, .68);
  backdrop-filter: blur(8px);
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

.cover-replace-loading {
  align-content: center;
  gap: 12px;
  text-align: center;
}

.cover-replace-loading strong {
  font-family: var(--font-serif);
  font-size: 24px;
}

.cover-replace-loading p {
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

.ppt-generate-overlay strong {
  font-family: var(--font-serif);
  font-size: 24px;
}

.ppt-generate-overlay p {
  color: var(--soft);
  font-size: 13px;
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
