<script setup>
import { Graph } from '@antv/g6';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { projectTeachingPathGraph } from './teachingPathProjection.js';

const props = defineProps({
  graphData: { type: Object, default: null },
  activeNodeId: { type: String, default: '' },
  activeEdgeId: { type: String, default: '' },
  searchText: { type: String, default: '' },
  layoutKey: { type: Number, default: 0 },
  fitRequest: { type: Number, default: 0 }
});

const emit = defineEmits(['select-node', 'select-edge']);
const containerRef = ref(null);
let graph = null;
let resizeObserver = null;

const palette = ['#2c8a62', '#347fb2', '#bd7c38', '#8e6ab5', '#bf6c6a', '#2f9b96', '#7a8660'];
const pathColors = {
  prerequisite: '#2e7659',
  derivation: '#337fa0',
  application: '#b56f30'
};
const stageColors = [
  { fill: '#f2f8f4', stroke: '#bdd9ca', label: '#225f45' },
  { fill: '#f3f7fb', stroke: '#bfd3e2', label: '#2a6389' },
  { fill: '#fbf7f1', stroke: '#e3ceb4', label: '#8d5b28' },
  { fill: '#f8f4fb', stroke: '#d8c9e5', label: '#704d8e' }
];
const COMPACT_LAYOUT = {
  minNodeWidth: 116,
  maxNodeWidth: 172,
  fitPadding: 28
};
const PATH_HIGHLIGHT_STATE = 'path-highlight';

function categoryColor(category) {
  const text = String(category || '未分类');
  let hash = 0;
  for (const character of text) hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function nodeWidth(label) {
  const length = [...String(label || '')].length;
  return Math.min(
    COMPACT_LAYOUT.maxNodeWidth,
    Math.max(COMPACT_LAYOUT.minNodeWidth, 78 + length * 13)
  );
}

function eventElementId(event) {
  return event?.target?.id || event?.target?.attributes?.id || event?.itemId || event?.id || '';
}

const projectedGraph = computed(() => projectTeachingPathGraph(props.graphData || {}));

const pathNeighbors = computed(() => {
  const neighbors = new Set();
  if (!props.activeNodeId) return neighbors;
  for (const edge of projectedGraph.value.edges) {
    if (edge.source === props.activeNodeId) neighbors.add(edge.target);
    if (edge.target === props.activeNodeId) neighbors.add(edge.source);
  }
  return neighbors;
});

const normalizedData = computed(() => {
  const source = projectedGraph.value;

  return {
    nodes: [
      ...source.stageLanes.map((lane) => ({
        id: lane.id,
        style: { x: lane.x, y: lane.y },
        data: {
          isStageLane: true,
          stageIndex: lane.index,
          label: lane.label,
          nodeCount: lane.nodeCount,
          width: lane.width,
          height: lane.height
        }
      })),
      ...source.nodes.map((node) => ({
        id: node.id,
        style: { x: node.x, y: node.y },
        data: {
          label: node.label || node.name || node.id,
          category: node.category || '未分类',
          source: node.source || 'ai',
          locked: Boolean(node.locked || node.manualLocked),
          questionCount: Number(node.questionCount || 0),
          orphan: Boolean(node.orphan),
          layer: node.layer,
          stageIndex: node.stageIndex,
          raw: node
        }
      }))
    ],
    edges: source.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: {
        label: edge.label || '',
        type: edge.type || 'related',
        sourceKind: edge.sourceKind || 'ai',
        supportCount: Number(edge.supportCount || 0),
        locked: Boolean(edge.locked),
        defaultVisible: Boolean(edge.defaultVisible),
        stageDistance: edge.stageDistance,
        raw: edge
      }
    }))
  };
});

const graphRenderKey = computed(() => JSON.stringify({
  nodes: projectedGraph.value.nodes.map((node) => [
    node.id,
    node.label,
    node.category,
    node.source,
    Boolean(node.locked || node.manualLocked),
    Number(node.questionCount || 0),
    Boolean(node.orphan),
    node.layer,
    node.stageIndex,
    node.x,
    node.y
  ]),
  edges: projectedGraph.value.edges.map((edge) => [
    edge.id,
    edge.source,
    edge.target,
    edge.type,
    edge.label,
    edge.sourceKind,
    Number(edge.supportCount || 0),
    Boolean(edge.locked),
    Boolean(edge.defaultVisible),
    edge.stageDistance
  ]),
  lanes: projectedGraph.value.stageLanes.map((lane) => [
    lane.id,
    lane.x,
    lane.y,
    lane.width,
    lane.height,
    lane.nodeCount
  ])
}));

function isNodeDimmed(node) {
  if (!props.activeNodeId) return false;
  return node.id !== props.activeNodeId && !pathNeighbors.value.has(node.id);
}

function isEdgeActive(edge) {
  return edge.id === props.activeEdgeId || (
    props.activeNodeId && (edge.source === props.activeNodeId || edge.target === props.activeNodeId)
  );
}

function isEdgeDimmed(edge) {
  return Boolean(props.activeNodeId) && !isEdgeActive(edge);
}

async function fitCanvas(animation = false) {
  if (!graph) return;
  await graph.fitView({ animation, padding: COMPACT_LAYOUT.fitPadding });
}

async function zoomIn() {
  if (!graph) return;
  await graph.zoomTo(Math.min(2, graph.getZoom() * 1.16), { duration: 160 });
}

async function zoomOut() {
  if (!graph) return;
  await graph.zoomTo(Math.max(0.35, graph.getZoom() / 1.16), { duration: 160 });
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
      type: 'rect',
      state: {
        [PATH_HIGHLIGHT_STATE]: {}
      },
      style: (datum) => {
        const node = datum.data || {};
        if (node.isStageLane) {
          const stageColor = stageColors[node.stageIndex] || stageColors[0];
          return {
            size: [node.width, node.height],
            radius: 22,
            fill: stageColor.fill,
            fillOpacity: 0.72,
            stroke: stageColor.stroke,
            strokeOpacity: 0.85,
            lineWidth: 1.2,
            lineDash: [7, 6],
            zIndex: -10,
            pointerEvents: 'none',
            labelText: `0${node.stageIndex + 1}  ${node.label}  ·  ${node.nodeCount} 个知识点`,
            labelPlacement: 'top-left',
            labelOffsetX: 16,
            labelOffsetY: 17,
            labelFontSize: 12,
            labelFontWeight: 800,
            labelFill: stageColor.label,
            labelBackground: false
          };
        }
        const active = datum.id === props.activeNodeId;
        const dimmed = isNodeDimmed(datum);
        const matchesSearch = Boolean(
          props.searchText && String(node.label).toLowerCase().includes(props.searchText.toLowerCase())
        );
        const color = categoryColor(node.category);
        return {
          size: [nodeWidth(node.label), 54],
          radius: 14,
          fill: node.orphan ? '#f0f3ef' : `${color}22`,
          fillOpacity: dimmed ? 0.26 : active || matchesSearch ? 1 : 0.94,
          stroke: active ? '#123f2d' : node.locked ? '#7659c5' : node.source === 'manual' ? '#7659c5' : color,
          lineWidth: active ? 3 : node.locked || node.source === 'manual' ? 2 : 1.5,
          lineDash: node.orphan ? [5, 4] : [],
          shadowColor: active ? 'rgba(18, 63, 45, .22)' : 'rgba(18, 63, 45, .10)',
          shadowBlur: active ? 18 : 8,
          opacity: dimmed ? 0.34 : 1,
          labelText: `${node.label}\n${node.questionCount} 道题`,
          labelPlacement: 'center',
          labelMaxWidth: nodeWidth(node.label) - 18,
          labelMaxLines: 2,
          labelWordWrap: true,
          labelTextOverflow: 'ellipsis',
          labelFontSize: active ? 13 : 11,
          labelFontWeight: active || matchesSearch ? 800 : 700,
          labelFill: active ? '#123f2d' : '#20392e',
          labelLineHeight: 18,
          labelBackground: false
        };
      }
    },
    edge: {
      type: 'cubic-horizontal',
      style: (datum) => {
        const edge = datum.data || {};
        const active = isEdgeActive(datum);
        const dimmed = isEdgeDimmed(datum);
        const visible = edge.defaultVisible || isEdgeActive(datum);
        const isSecondaryPath = Math.abs(Number(edge.stageDistance || 0)) !== 1;
        return {
          visibility: visible ? 'visible' : 'hidden',
          stroke: pathColors[edge.type] || '#7d9487',
          strokeOpacity: dimmed ? 0.08 : active ? (isSecondaryPath ? 0.72 : 0.95) : 0.52,
          lineWidth: active ? 3 : 1.6,
          lineDash: active && isSecondaryPath ? [7, 5] : [],
          endArrow: true,
          labelText: active ? edge.label : '',
          labelFontSize: 10,
          labelFontWeight: 700,
          labelFill: '#365a4a',
          labelBackground: active,
          labelBackgroundFill: 'rgba(255,255,255,.94)',
          labelBackgroundRadius: 5,
          labelPadding: [2, 5]
        };
      }
    },
    behaviors: ['drag-canvas', 'zoom-canvas']
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
  graph.on('canvas:dblclick', () => fitCanvas(true));

  await graph.render();
  await fitCanvas(false);
}

async function refreshGraphState() {
  if (!graph) return;
  await graph.draw();
}

onMounted(() => {
  renderGraph();
  resizeObserver = new ResizeObserver(() => {
    graph?.resize();
    fitCanvas(false);
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  graph?.destroy();
  graph = null;
});

watch(graphRenderKey, renderGraph);
watch(() => props.layoutKey, renderGraph);
watch(() => props.fitRequest, () => fitCanvas(true));

watch(
  () => [props.activeNodeId, props.activeEdgeId, props.searchText],
  refreshGraphState
);
</script>

<template>
  <div class="knowledge-graph-renderer">
    <div class="graph-tools" aria-label="图谱工具">
      <button class="graph-tool" data-action="fit-canvas" type="button" title="适应画布" aria-label="适应画布" @click="fitCanvas(true)">
        <span class="material-symbols-outlined">fit_screen</span>
      </button>
      <button class="graph-tool" type="button" title="放大" aria-label="放大" @click="zoomIn">
        <span class="material-symbols-outlined">add</span>
      </button>
      <button class="graph-tool" type="button" title="缩小" aria-label="缩小" @click="zoomOut">
        <span class="material-symbols-outlined">remove</span>
      </button>
    </div>
    <div ref="containerRef" class="knowledge-graph-canvas"></div>
    <div class="graph-legend" aria-label="知识路径图例">
      <span><i class="prerequisite"></i>前置知识</span>
      <span><i class="derivation"></i>推导关系</span>
      <span><i class="application"></i>应用于</span>
      <span><b></b>节点越大表示关联题目越多</span>
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
  background-color: rgba(255, 255, 255, .72);
  background-image:
    linear-gradient(rgba(10, 53, 34, .045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10, 53, 34, .045) 1px, transparent 1px);
  background-size: 34px 34px;
}

.knowledge-graph-canvas { width: 100%; height: 100%; min-height: inherit; }

.graph-tools {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
}

.graph-tool {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgba(216, 225, 220, .92);
  border-radius: 9px;
  background: rgba(255, 255, 255, .92);
  color: #315846;
  box-shadow: 0 4px 10px rgba(25, 62, 46, .08);
}

.graph-tool:hover { border-color: #8eb8a4; color: #176b49; }
.graph-tool .material-symbols-outlined { font-size: 17px; }

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
.graph-legend i.prerequisite { border-color: #2e7659; }
.graph-legend i.derivation { border-color: #337fa0; }
.graph-legend i.application { border-color: #b56f30; }
.graph-legend b { width: 9px; height: 9px; border-radius: 50%; background: var(--green); }

@media (max-width: 760px) {
  .graph-tools { top: 8px; right: 8px; }
  .graph-tool { width: 30px; height: 30px; }
  .graph-legend { bottom: 8px; left: 8px; }
}
</style>
