<script setup>
import { Graph } from '@antv/g6';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  graphData: { type: Object, default: null },
  activeNodeId: { type: String, default: '' },
  activeEdgeId: { type: String, default: '' },
  searchText: { type: String, default: '' },
  neighborhoodDepth: { type: Number, default: 0 }
});

const emit = defineEmits(['select-node', 'select-edge', 'layout-change']);
const containerRef = ref(null);
let graph = null;
let resizeObserver = null;

const palette = ['#2fac66', '#2384f6', '#e08a3e', '#7b61ff', '#d86f72', '#14a6a1', '#9a6b3c'];

function categoryColor(category) {
  const text = String(category || '未分类');
  let hash = 0;
  for (const character of text) hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function nodeSize(data) {
  const questionCount = Math.max(0, Number(data?.questionCount || 0));
  return Math.min(58, Math.max(28, 28 + Math.log2(questionCount + 1) * 8));
}

function eventElementId(event) {
  return event?.target?.id || event?.target?.attributes?.id || event?.itemId || event?.id || '';
}

const normalizedData = computed(() => {
  const source = props.graphData || {};
  return {
    nodes: (source.nodes || []).map((node) => ({
      id: node.id,
      ...(node.position?.pinned ? { style: { x: node.position.x, y: node.position.y } } : {}),
      data: {
        label: node.label || node.name || node.id,
        category: node.category || '未分类',
        source: node.source || 'ai',
        locked: Boolean(node.locked || node.manualLocked),
        questionCount: Number(node.questionCount || 0),
        orphan: Boolean(node.orphan),
        raw: node
      }
    })),
    edges: (source.edges || []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: {
        label: edge.label || '',
        type: edge.type || 'related',
        sourceKind: edge.sourceKind || 'ai',
        supportCount: Number(edge.supportCount || 0),
        locked: Boolean(edge.locked),
        raw: edge
      }
    }))
  };
});

const focusNodeId = computed(() => {
  return [...normalizedData.value.nodes]
    .sort((left, right) => right.data.questionCount - left.data.questionCount)[0]?.id || '';
});

function isActiveEdge(datum) {
  return datum.id === props.activeEdgeId || (
    props.activeNodeId && (datum.source === props.activeNodeId || datum.target === props.activeNodeId)
  );
}

async function renderGraph() {
  await nextTick();
  const container = containerRef.value;
  if (!container) return;

  if (graph) {
    graph.destroy();
    graph = null;
  }
  const data = normalizedData.value;
  if (!data.nodes.length) return;

  graph = new Graph({
    container,
    data,
    node: {
      type: 'circle',
      style: (datum) => {
        const node = datum.data || {};
        const active = datum.id === props.activeNodeId;
        const matchesSearch = props.searchText && String(node.label).toLowerCase().includes(props.searchText.toLowerCase());
        const color = categoryColor(node.category);
        return {
          size: nodeSize(node),
          fill: node.orphan ? '#f5f2eb' : color,
          fillOpacity: active || matchesSearch ? 1 : 0.9,
          stroke: node.locked ? '#50359a' : node.source === 'manual' ? '#7659c5' : '#ffffff',
          lineWidth: active ? 4 : node.locked ? 3 : 2,
          shadowColor: active ? 'rgba(10, 53, 34, .28)' : 'rgba(10, 53, 34, .13)',
          shadowBlur: active ? 20 : 8,
          labelText: node.label,
          labelPlacement: 'bottom',
          labelMaxWidth: active ? 150 : 116,
          labelWordWrap: true,
          labelMaxLines: 2,
          labelTextOverflow: 'ellipsis',
          labelFontSize: active ? 13 : 11,
          labelFontWeight: active || matchesSearch ? 800 : 650,
          labelFill: '#18211d',
          labelBackground: true,
          labelBackgroundFill: active ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.78)',
          labelBackgroundRadius: 6,
          labelPadding: [2, 6]
        };
      }
    },
    edge: {
      type: 'line',
      style: (datum) => {
        const edge = datum.data || {};
        const active = isActiveEdge(datum);
        const manual = edge.sourceKind === 'manual';
        const coOccurrence = edge.type === 'co_occurrence';
        return {
          stroke: manual ? '#7659c5' : active ? '#537469' : '#94a49d',
          strokeOpacity: active ? 0.88 : manual ? 0.58 : 0.25,
          lineWidth: active ? Math.min(5, 1.6 + edge.supportCount * 0.45) : Math.min(3, 1 + edge.supportCount * 0.25),
          lineDash: coOccurrence || manual ? [] : [6, 5],
          endArrow: active && !coOccurrence,
          labelText: active ? edge.label : '',
          labelFontSize: 10,
          labelFill: '#40564d',
          labelBackground: active,
          labelBackgroundFill: 'rgba(255,255,255,.94)',
          labelBackgroundRadius: 5,
          labelPadding: [1, 5]
        };
      }
    },
    layout: {
      type: 'radial',
      focusNode: focusNodeId.value,
      unitRadius: 126,
      preventOverlap: true,
      strictRadial: false,
      nodeSize: 82,
      nodeSpacing: 34,
      sortBy: 'questionCount',
      sortStrength: 28,
      maxIteration: 800
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
  });

  graph.on('node:click', (event) => {
    const id = eventElementId(event);
    const node = props.graphData?.nodes?.find((item) => item.id === id);
    if (node) emit('select-node', node);
  });
  graph.on('edge:click', (event) => {
    const id = eventElementId(event);
    const edge = props.graphData?.edges?.find((item) => item.id === id);
    if (edge) emit('select-edge', edge);
  });
  graph.on('node:dragend', (event) => {
    const id = eventElementId(event);
    const attributes = event?.target?.attributes || {};
    const x = Number(attributes.x ?? event?.canvas?.x);
    const y = Number(attributes.y ?? event?.canvas?.y);
    if (id && Number.isFinite(x) && Number.isFinite(y)) emit('layout-change', { id, x, y });
  });

  await graph.render();
  await graph.fitCenter(false);
}

async function refreshGraphState() {
  if (!graph) return;
  await graph.draw();
}

onMounted(() => {
  renderGraph();
  resizeObserver = new ResizeObserver(() => graph?.resize());
  if (containerRef.value) resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  graph?.destroy();
  graph = null;
});

watch(() => props.graphData, renderGraph, { deep: true });

watch(
  () => [props.activeNodeId, props.activeEdgeId, props.searchText],
  refreshGraphState
);
</script>

<template>
  <div class="knowledge-graph-renderer">
    <div ref="containerRef" class="knowledge-graph-canvas"></div>
    <div class="graph-legend" aria-label="知识图谱图例">
      <span><i class="solid"></i>共同考查</span>
      <span><i class="dashed"></i>AI 语义关系</span>
      <span><i class="manual"></i>人工关系</span>
      <span><b></b>节点越大，关联题目越多</span>
    </div>
  </div>
</template>

<style scoped>
.knowledge-graph-renderer {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  overflow: hidden;
  border-radius: 14px;
  background-color: rgba(255, 255, 255, .66);
  background-image:
    linear-gradient(rgba(10, 53, 34, .055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 53, 34, .055) 1px, transparent 1px);
  background-size: 34px 34px;
}

.knowledge-graph-canvas { width: 100%; height: 100%; min-height: inherit; }

.graph-legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  max-width: calc(100% - 24px);
  pointer-events: none;
}
.graph-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(216, 225, 220, .85);
  border-radius: 999px;
  background: rgba(255, 255, 255, .88);
  color: var(--muted);
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 700;
  backdrop-filter: blur(8px);
}
.graph-legend i { display: inline-block; width: 18px; border-top: 2px solid #7e9188; }
.graph-legend i.dashed { border-top-style: dashed; }
.graph-legend i.manual { border-color: #7659c5; }
.graph-legend b { width: 9px; height: 9px; border-radius: 50%; background: var(--green); }
</style>
