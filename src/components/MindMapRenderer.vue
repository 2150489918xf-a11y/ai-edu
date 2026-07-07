<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  markdown: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['node-select']);

const svgRef = ref(null);
const errorMessage = ref('');
let markmap = null;
let transformer = null;
let MarkmapCtor = null;
let loader = null;
let renderVersion = 0;

function handleSvgClick(event) {
  let nodeElement = event.target;
  while (nodeElement && nodeElement !== svgRef.value) {
    if (nodeElement.classList?.contains('markmap-node')) break;
    nodeElement = nodeElement.parentNode;
  }
  if (!nodeElement || nodeElement === svgRef.value) return;
  const label = nodeElement.textContent?.replace(/\s+/g, ' ').trim();
  if (label) {
    emit('node-select', { label });
  }
}

async function loadRenderer() {
  if (!loader) {
    loader = Promise.all([
      import('markmap-lib'),
      import('markmap-view')
    ]).then(([lib, view]) => {
      transformer = new lib.Transformer();
      MarkmapCtor = view.Markmap;
    });
  }
  await loader;
}

async function render() {
  const version = ++renderVersion;
  if (!svgRef.value) return;
  const source = props.markdown.trim();
  errorMessage.value = '';

  if (!source) {
    markmap?.destroy();
    markmap = null;
    svgRef.value.innerHTML = '';
    return;
  }

  try {
    await loadRenderer();
    if (version !== renderVersion) return;
    const { root } = transformer.transform(source);
    if (!markmap) {
      svgRef.value.innerHTML = '';
      markmap = MarkmapCtor.create(svgRef.value, {
        autoFit: true,
        color: (node) => {
          const palette = ['#2b84bf', '#00a6b2', '#df9d24', '#8c63d7', '#35b875', '#e48b35', '#d94b5d'];
          const parts = (node?.state?.path || '').split('.').filter(Boolean);
          if (parts.length <= 1) return '#075637';
          const firstBranchId = Number(parts[1]);
          const index = Number.isFinite(firstBranchId)
            ? Math.max(0, Math.floor((firstBranchId - 2) / 3))
            : 0;
          return palette[index % palette.length];
        },
        duration: 420,
        embedGlobalCSS: true,
        fitRatio: .9,
        initialExpandLevel: 4,
        maxInitialScale: 1.5,
        maxWidth: 260,
        nodeMinHeight: 18,
        paddingX: 12,
        spacingHorizontal: 92,
        spacingVertical: 12,
        pan: true,
        zoom: true
      });
    }
    if (version !== renderVersion) return;
    await markmap.setData(root);
    await nextTick();
    if (version !== renderVersion) return;
    await markmap.fit();
  } catch (error) {
    if (version !== renderVersion) return;
    errorMessage.value = error instanceof Error ? error.message : '思维导图渲染失败';
  }
}

watch(() => props.markdown, render, { immediate: true });
onMounted(render);

onBeforeUnmount(() => {
  markmap?.destroy();
  markmap = null;
});
</script>

<template>
  <div class="mm-renderer">
    <svg ref="svgRef" class="mm-renderer-svg" aria-label="思维导图渲染结果" @click="handleSvgClick"></svg>
    <div v-if="errorMessage" class="mm-renderer-error">{{ errorMessage }}</div>
  </div>
</template>

<style scoped>
.mm-renderer {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.mm-renderer-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.mm-renderer :deep(.markmap) {
  font-family: var(--font-ui);
}

.mm-renderer :deep(.markmap-node) {
  cursor: pointer;
}

.mm-renderer :deep(.markmap-node > circle) {
  r: 4;
}

.mm-renderer :deep(.markmap-node > text) {
  fill: var(--ink);
  font-size: 14px;
  font-weight: 800;
}

.mm-renderer :deep(.markmap-node[data-depth="0"] > text),
.mm-renderer :deep(.markmap-node:first-child > text) {
  font-size: 22px;
  font-weight: 900;
}

.mm-renderer :deep(.markmap-link) {
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mm-renderer-error {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 12px;
  background: rgba(255, 239, 241, .96);
  color: #b33b42;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 800;
}
</style>
