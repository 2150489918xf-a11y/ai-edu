<script setup>
import { computed, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { generateMindMap } from '../data/mockApi';
import { getCourse, notify } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => String(route.params.courseId || 'math-quadratic'));
const course = computed(() => getCourse(courseId.value));

const generating = ref(false);
const generated = ref(false);
const currentStep = ref(-1);
const mindMap = ref(null);
const activeNodeId = ref('root');
const revealedNodeCount = ref(0);
let stepTimer = 0;
let revealTimer = 0;

const fallbackSources = [
  { id: 'src-1', title: '二次函数图像与性质教材节选', type: '教材资料', status: '已引用', evidence: 42 },
  { id: 'src-2', title: '高一二次函数错题样本与错因分析', type: '学情报告', status: '已引用', evidence: 25 },
  { id: 'src-3', title: '二次函数单元教学设计初稿', type: '教师资料', status: '待解析', evidence: 0 }
];

const generationSteps = [
  '读取知识库引用资料',
  '抽取知识点与公式',
  '识别知识点层级关系',
  '合并学生薄弱点',
  '生成可编辑思维导图'
];

const sources = computed(() => mindMap.value?.sources || fallbackSources);
const nodes = computed(() => mindMap.value?.nodes || []);
const nodeLayout = {
  root: { x: 50, y: 50, side: 'center', level: 0, order: 0 },
  definition: { x: 33, y: 31, side: 'left', level: 1, order: 1 },
  intersection: { x: 16, y: 22, side: 'left', level: 2, order: 2 },
  graph: { x: 31, y: 47, side: 'left', level: 1, order: 3 },
  axis: { x: 33, y: 66, side: 'left', level: 1, order: 4 },
  'mistake-axis': { x: 17, y: 76, side: 'left', level: 2, order: 5 },
  square: { x: 67, y: 29, side: 'right', level: 1, order: 6 },
  teaching: { x: 80, y: 20, side: 'right', level: 2, order: 7 },
  monotonic: { x: 68, y: 45, side: 'right', level: 1, order: 8 },
  opening: { x: 83, y: 38, side: 'right', level: 2, order: 9 },
  vertex: { x: 67, y: 63, side: 'right', level: 1, order: 10 },
  'mistake-square': { x: 84, y: 76, side: 'right', level: 2, order: 11 }
};
const mindTreeLinks = [
  ['root', 'definition'],
  ['definition', 'intersection'],
  ['root', 'graph'],
  ['root', 'axis'],
  ['axis', 'mistake-axis'],
  ['root', 'square'],
  ['square', 'teaching'],
  ['root', 'monotonic'],
  ['monotonic', 'opening'],
  ['root', 'vertex'],
  ['vertex', 'mistake-square']
];
const orderedNodes = computed(() => (
  nodes.value
    .filter((node) => nodeLayout[node.id])
    .map((node) => ({ ...node, ...nodeLayout[node.id] }))
    .sort((a, b) => a.order - b.order)
));
const visibleNodes = computed(() => (
  generated.value || generating.value
    ? orderedNodes.value.slice(0, revealedNodeCount.value)
    : []
));
const activeNode = computed(() => visibleNodes.value.find((node) => node.id === activeNodeId.value) || visibleNodes.value[0] || null);
const links = computed(() => {
  if (!mindMap.value) return [];
  return mindTreeLinks
    .map(([from, to]) => ({
      from: visibleNodes.value.find((node) => node.id === from),
      to: visibleNodes.value.find((node) => node.id === to)
    }))
    .filter((link) => link.from && link.to);
});
const loadingMessage = computed(() => generationSteps[Math.max(0, currentStep.value)] || generationSteps[0]);

function linkPath(link) {
  const dir = link.to.side === 'left' ? -1 : 1;
  const fromPad = link.from.level === 0 ? 8 : 6;
  const toPad = link.to.level === 1 ? 7 : 5;
  const startX = link.from.x + dir * fromPad;
  const startY = link.from.y;
  const endX = link.to.x + dir * toPad;
  const endY = link.to.y;
  const jointX = startX + dir * Math.min(9, Math.max(5, Math.abs(endX - startX) * .32));
  const turnX = jointX + dir * 5;

  return [
    `M ${startX} ${startY}`,
    `H ${jointX}`,
    `C ${jointX} ${startY}, ${jointX} ${endY}, ${turnX} ${endY}`,
    `H ${endX}`
  ].join(' ');
}

async function startGeneration() {
  if (generating.value) return;
  generated.value = false;
  generating.value = true;
  currentStep.value = 0;
  activeNodeId.value = 'root';
  mindMap.value = null;
  revealedNodeCount.value = 0;
  window.clearInterval(stepTimer);
  window.clearInterval(revealTimer);
  stepTimer = window.setInterval(() => {
    currentStep.value = Math.min(generationSteps.length - 1, currentStep.value + 1);
  }, 720);
  const result = await generateMindMap(courseId.value);
  mindMap.value = result.mindMap;
  revealedNodeCount.value = 1;
  activeNodeId.value = 'root';
  revealTimer = window.setInterval(() => {
    revealedNodeCount.value = Math.min(orderedNodes.value.length, revealedNodeCount.value + 1);
    if (revealedNodeCount.value >= orderedNodes.value.length) {
      window.clearInterval(revealTimer);
    }
  }, 260);
  window.setTimeout(() => {
    window.clearInterval(stepTimer);
    window.clearInterval(revealTimer);
    revealedNodeCount.value = orderedNodes.value.length;
    currentStep.value = generationSteps.length - 1;
    generated.value = true;
    generating.value = false;
    notify('思维导图已生成');
  }, 2200);
}

function selectNode(nodeId) {
  activeNodeId.value = nodeId;
}

function goBack() {
  router.push(`/preclass/courses/${course.value.id}/workspace`);
}

onUnmounted(() => {
  window.clearInterval(stepTimer);
  window.clearInterval(revealTimer);
});
</script>

<template>
  <main class="mind-page">
    <header class="mind-top">
      <button class="mind-btn back-btn" type="button" @click="goBack">
        <span class="material-symbols-outlined">chevron_left</span>
        返回备课
      </button>
      <div class="mind-title">
        <h1>{{ course.shortTitle }} · 思维导图</h1>
        <p>{{ generated ? '已基于知识库资料生成，可继续用于 PPT、题目和讲解脚本。' : '从已引用资料中提取知识点、关系和薄弱点，生成可演示的备课思维导图。' }}</p>
      </div>
      <div class="mind-actions">
        <button class="mind-btn" type="button" :disabled="!generated || generating" @click="startGeneration">
          <span class="material-symbols-outlined">refresh</span>
          重新生成
        </button>
        <button class="mind-primary" type="button" :disabled="!generated" @click="router.push(`/preclass/courses/${course.id}/ppt`)">
          <span class="material-symbols-outlined">desktop_windows</span>
          生成 PPT
        </button>
      </div>
    </header>

    <section class="mind-shell">
      <nav class="mind-rail" aria-label="课程工作台步骤">
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/workspace`)">
          <span class="material-symbols-outlined">auto_awesome</span>
          生成
        </button>
        <button class="mind-step active" type="button">
          <span class="material-symbols-outlined">account_tree</span>
          导图
        </button>
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/ppt`)">
          <span class="material-symbols-outlined">desktop_windows</span>
          PPT
        </button>
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/lesson-plan`)">
          <span class="material-symbols-outlined">article</span>
          教案
        </button>
        <button class="mind-step" type="button" @click="router.push(`/preclass/courses/${course.id}/analysis`)">
          <span class="material-symbols-outlined">analytics</span>
          题析
        </button>
        <div class="mind-ai-mark">AI</div>
      </nav>

      <aside class="mind-sources">
        <header>
          <span class="small-chip">知识库来源</span>
          <h2>引用资料</h2>
        </header>
        <div class="mind-source-list">
          <article v-for="source in sources" :key="source.id" class="mind-source">
            <div>
              <strong>{{ source.title }}</strong>
              <span>{{ source.type }} · {{ source.status }}</span>
            </div>
            <em>{{ source.evidence }}</em>
          </article>
        </div>
        <section class="mind-source-summary">
          <span>Evidence 覆盖</span>
          <strong>92%</strong>
          <i><b></b></i>
        </section>
      </aside>

      <section class="mind-canvas-panel">
        <div class="mind-canvas-head">
          <div>
            <span class="small-chip">
              <span class="material-symbols-outlined">hub</span>
              AI MindMap
            </span>
            <h2>{{ mindMap?.title || '等待生成思维导图' }}</h2>
          </div>
          <button class="mind-generate" type="button" :disabled="generating" @click="startGeneration">
            <span class="material-symbols-outlined" :class="{ spinning: generating }">{{ generating ? 'progress_activity' : 'auto_awesome' }}</span>
            {{ generating ? '正在生成...' : generated ? '重新生成导图' : 'AI 生成思维导图' }}
          </button>
        </div>

        <div class="mind-canvas" :class="{ generated, generating }">
          <template v-if="mindMap && visibleNodes.length">
            <svg class="mind-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path
                v-for="(link, index) in links"
                :key="`${link.from.id}-${link.to.id}-${index}`"
                :class="link.to.side"
                :d="linkPath(link)"
              />
            </svg>
            <button
              v-for="node in visibleNodes"
              :key="node.id"
              class="mind-node"
              :class="[node.type, node.side, `level-${node.level}`, { active: activeNode?.id === node.id }]"
              type="button"
              :style="{ left: `${node.x}%`, top: `${node.y}%`, '--delay': `${node.order * 42}ms` }"
              @click="selectNode(node.id)"
            >
              {{ node.label }}
            </button>
            <div v-if="generating" class="mind-stream-status">
              <span class="material-symbols-outlined spinning">progress_activity</span>
              <strong>{{ loadingMessage }}</strong>
              <em>{{ visibleNodes.length }} / {{ orderedNodes.length }}</em>
            </div>
          </template>

          <div v-else class="mind-empty">
            <span class="material-symbols-outlined" :class="{ spinning: generating }">{{ generating ? 'progress_activity' : 'account_tree' }}</span>
            <strong>{{ generating ? 'AI 正在生成导图' : '从课程资料生成第一版思维导图' }}</strong>
            <p>{{ generating ? '系统正在提取知识点、关系和学生薄弱点。' : '点击生成后，将模拟资料读取、知识点抽取和导图成型过程。' }}</p>
          </div>
        </div>
      </section>

      <aside class="mind-side">
        <section class="mind-progress-card">
          <span class="small-chip">生成过程</span>
          <div class="mind-step-list">
            <article
              v-for="(step, index) in generationSteps"
              :key="step"
              :class="{ done: generated || index < currentStep, active: generating && index === currentStep }"
            >
              <i>
                <span v-if="generated || index < currentStep" class="material-symbols-outlined">check</span>
                <b v-else>{{ index + 1 }}</b>
              </i>
              <strong>{{ step }}</strong>
            </article>
          </div>
        </section>

        <section class="mind-detail-card">
          <span class="small-chip">{{ activeNode ? '节点详情' : '导图详情' }}</span>
          <template v-if="activeNode">
            <h2>{{ activeNode.label }}</h2>
            <p>{{ activeNode.detail }}</p>
            <div class="mind-evidence">
              <span v-for="item in activeNode.evidence" :key="item">{{ item }}</span>
            </div>
          </template>
          <template v-else>
            <h2>尚未生成</h2>
            <p>生成完成后，点击任一节点可查看教学说明和引用来源。</p>
          </template>
        </section>

        <div class="mind-next-actions">
          <button class="mind-primary" type="button" :disabled="!generated" @click="router.push(`/preclass/courses/${course.id}/ppt`)">
            用于生成 PPT
          </button>
          <button class="mind-btn" type="button" :disabled="!generated" @click="notify('已进入题目生成队列')">
            生成配套题目
          </button>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.mind-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, rgba(162, 226, 190, .56), transparent 28%),
    var(--wash);
  color: var(--ink);
}

.mind-top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  height: var(--edu-topbar-h);
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .78);
  backdrop-filter: blur(20px);
}

.mind-title {
  min-width: 0;
}

.mind-title h1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 25px;
  line-height: 1.1;
}

.mind-title p {
  margin-top: 5px;
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.mind-actions,
.mind-next-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mind-btn,
.mind-primary,
.mind-generate {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 9px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.mind-btn {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .76);
  color: var(--ink);
}

.mind-primary,
.mind-generate {
  border: 0;
  background: var(--deep);
  color: white;
  box-shadow: 0 12px 24px rgba(7, 52, 32, .16);
}

.mind-btn:disabled,
.mind-primary:disabled,
.mind-generate:disabled {
  opacity: .52;
}

.mind-page .material-symbols-outlined {
  position: relative;
  display: inline-flex;
  width: 20px;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: currentColor;
  font-size: 0;
  line-height: 1;
}

.mind-page .material-symbols-outlined::before {
  content: "";
  display: block;
  width: 13px;
  height: 13px;
  border: 2px solid currentColor;
  border-radius: 5px;
  opacity: .85;
}

.mind-page .spinning::before {
  border-radius: 50%;
  border-right-color: transparent;
}

.mind-shell {
  display: grid;
  grid-template-columns: 80px 280px minmax(0, 1fr) 330px;
  height: calc(100vh - var(--edu-topbar-h));
  min-height: 0;
}

.mind-rail {
  display: grid;
  align-content: start;
  gap: 10px;
  padding-top: 18px;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, .36);
}

.mind-step {
  display: grid;
  width: 72px;
  min-height: 60px;
  place-items: center;
  gap: 4px;
  border: 0;
  border-radius: 0 12px 12px 0;
  background: transparent;
  color: var(--soft);
  font-size: 11px;
  font-weight: 700;
}

.mind-step.active {
  background: var(--deep);
  color: white;
  box-shadow: 0 14px 26px rgba(7, 52, 32, .18);
}

.mind-ai-mark {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  margin: 16px auto 0;
  border-radius: 50%;
  background: var(--mint);
  color: var(--green);
  font-family: var(--font-number);
  font-weight: 900;
}

.mind-sources,
.mind-side {
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--line);
  padding: 18px;
  background: rgba(255, 255, 255, .54);
}

.mind-sources header h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 22px;
}

.mind-source-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.mind-source {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 86px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, .62);
  padding: 14px;
}

.mind-source strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.35;
}

.mind-source span {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.mind-source em {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: var(--mint);
  color: var(--green);
  font-style: normal;
  font-weight: 900;
}

.mind-source-summary {
  display: grid;
  gap: 10px;
  margin-top: 20px;
  border-top: 1px solid var(--line);
  padding-top: 16px;
}

.mind-source-summary span {
  color: var(--muted);
  font-size: 12px;
}

.mind-source-summary strong {
  font-family: var(--font-number);
  font-size: 28px;
}

.mind-source-summary i {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(47, 172, 102, .12);
}

.mind-source-summary b {
  display: block;
  width: 92%;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.mind-canvas-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  padding: 18px;
}

.mind-canvas-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.mind-canvas-head h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 25px;
}

.mind-canvas {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background:
    linear-gradient(rgba(47, 172, 102, .07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(47, 172, 102, .07) 1px, transparent 1px),
    rgba(255, 255, 255, .62);
  background-size: 34px 34px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .72);
}

.mind-links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.mind-links path {
  fill: none;
  stroke-width: .34;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 170;
  stroke-dashoffset: 170;
  filter: drop-shadow(0 1px 2px rgba(10, 53, 34, .06));
  animation: branch-draw .74s ease forwards;
}

.mind-links path.left {
  stroke: rgba(36, 113, 163, .42);
}

.mind-links path.right {
  stroke: rgba(47, 172, 102, .46);
}

.mind-node {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  min-width: 112px;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(47, 172, 102, .2);
  border-radius: 999px;
  background: rgba(255, 255, 255, .96);
  color: var(--ink);
  padding: 0 15px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.25;
  box-shadow: 0 12px 26px rgba(15, 40, 30, .1);
  animation: node-pop .34s ease both;
  animation-delay: var(--delay);
  transition: transform .18s ease, border-color .18s ease, background .18s ease, color .18s ease;
}

.mind-node:hover,
.mind-node.active {
  transform: translate(-50%, -50%) scale(1.05);
  border-color: var(--green);
  background: var(--deep);
  color: white;
}

.mind-node.level-0 {
  min-width: 188px;
  min-height: 70px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--deep), #136b45);
  color: white;
  padding: 0 22px;
  font-size: 16px;
  box-shadow: 0 20px 38px rgba(7, 52, 32, .22);
}

.mind-node.level-1 {
  min-width: 148px;
  min-height: 42px;
  border-width: 2px;
  font-size: 13px;
}

.mind-node.level-1.left {
  border-color: rgba(36, 113, 163, .28);
  background: #edf6ff;
  color: #17527d;
}

.mind-node.level-1.right {
  border-color: rgba(47, 172, 102, .28);
  background: #eefaf3;
  color: #0d6840;
}

.mind-node.level-2 {
  min-width: 108px;
  min-height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, .92);
  font-size: 11px;
}

.mind-node.level-2.left {
  border-color: rgba(36, 113, 163, .2);
  color: #315f81;
}

.mind-node.level-2.right {
  border-color: rgba(47, 172, 102, .22);
  color: #26764e;
}

.mind-node.formula.level-1,
.mind-node.formula.level-2 {
  background: rgba(255, 246, 224, .96);
  border-color: rgba(219, 154, 48, .28);
  color: #8b5a13;
}

.mind-node.weak-point.level-2 {
  background: rgba(255, 239, 241, .98);
  border-color: rgba(179, 59, 66, .24);
  color: #b33b42;
}

.mind-node.activity.level-2 {
  background: rgba(227, 248, 237, .96);
  border-color: rgba(47, 172, 102, .25);
  color: var(--green);
}

.mind-stream-status {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transform: translateX(-50%);
  border: 1px solid rgba(47, 172, 102, .2);
  border-radius: 999px;
  background: rgba(255, 255, 255, .88);
  color: var(--ink);
  padding: 8px 12px;
  box-shadow: 0 14px 28px rgba(15, 40, 30, .1);
  backdrop-filter: blur(12px);
}

.mind-stream-status .material-symbols-outlined {
  color: var(--green);
  font-size: 20px;
}

.mind-stream-status strong {
  font-size: 12px;
  white-space: nowrap;
}

.mind-stream-status em {
  border-radius: 999px;
  background: var(--mint);
  color: var(--green);
  padding: 3px 8px;
  font-family: var(--font-number);
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}

.mind-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--muted);
  text-align: center;
}

.mind-empty .material-symbols-outlined {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 18px;
  background: var(--mint);
  color: var(--green);
  font-size: 34px;
}

.mind-empty strong {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 24px;
}

.mind-empty p {
  max-width: 420px;
  font-size: 13px;
  line-height: 1.6;
}

.spinning {
  animation: spin .9s linear infinite;
}

@keyframes spin {
  to {
    rotate: 360deg;
  }
}

@keyframes branch-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes node-pop {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(.78);
  }

  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.mind-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-right: 0;
  border-left: 1px solid var(--line);
}

.mind-progress-card,
.mind-detail-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, .62);
  padding: 16px;
}

.mind-step-list {
  display: grid;
  gap: 9px;
  margin-top: 14px;
}

.mind-step-list article {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 38px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.mind-step-list i {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: rgba(234, 239, 236, .88);
  font-style: normal;
  font-size: 11px;
}

.mind-step-list article.done i,
.mind-step-list article.active i {
  background: var(--deep);
  color: white;
}

.mind-step-list article.done strong,
.mind-step-list article.active strong {
  color: var(--ink);
}

.mind-detail-card h2 {
  margin-top: 12px;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.25;
}

.mind-detail-card p {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
}

.mind-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.mind-evidence span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  background: var(--mint);
  color: var(--green);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.mind-next-actions {
  display: grid;
  margin-top: auto;
}

.mind-next-actions .mind-primary,
.mind-next-actions .mind-btn {
  width: 100%;
}

@media (max-height: 760px) {
  .mind-sources,
  .mind-side,
  .mind-canvas-panel {
    padding: 14px;
  }

  .mind-source {
    min-height: 76px;
  }
}
</style>
