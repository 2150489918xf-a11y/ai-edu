<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import KnowledgeGraphInspector from '../components/knowledge/KnowledgeGraphInspector.vue';
import KnowledgeGraphRenderer from '../components/knowledge/KnowledgeGraphRenderer.vue';
import { projectKnowledgePathGraph } from '../components/knowledge/knowledgePathProjection.js';
import {
  analyzePendingQuestionKnowledge,
  createQuestionBankKnowledgePoint,
  createQuestionBankKnowledgeRelation,
  deleteQuestionBankKnowledgeRelation,
  getQuestionBankKnowledgeGraph,
  getQuestionBankKnowledgePoint,
  mergeQuestionBankKnowledgePoint,
  reconcileQuestionBankKnowledgeGraph,
  removeQuestionBankKnowledgePoint,
  saveQuestionBankKnowledgeGraphLayout,
  updateQuestionBankKnowledgePoint,
  updateQuestionBankKnowledgeRelation
} from '../data/questionBankApiClient';
import { notify } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const graphData = ref(null);
const selectedNodeId = ref('');
const selectedEdgeId = ref('');
const selectedNodeDetail = ref(null);
const loading = ref(false);
const detailLoading = ref(false);
const savingAction = ref('');
const error = ref('');
const searchText = ref('');
const sourceFilter = ref('all');
const categoryFilter = ref('all');
const layoutKey = ref(0);
const fitRequest = ref(0);
let pollTimer = null;
let layoutTimer = null;
const pendingLayouts = new Map();

const bankId = computed(() => String(route.params.bankId || ''));
const nodes = computed(() => graphData.value?.nodes || []);
const edges = computed(() => graphData.value?.edges || []);
const stats = computed(() => graphData.value?.stats || {
  questionCount: 0,
  analyzedCount: 0,
  pendingCount: 0,
  processingCount: 0,
  failedCount: 0,
  nodeCount: 0,
  edgeCount: 0
});
const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value) || null);
const selectedEdge = computed(() => edges.value.find((edge) => edge.id === selectedEdgeId.value) || null);
const categories = computed(() => [...new Set(nodes.value.map((node) => node.category).filter(Boolean))].sort());
const isParsing = computed(() => stats.value.pendingCount + stats.value.processingCount > 0);
const pathGraph = computed(() => projectKnowledgePathGraph(graphData.value || {}));
const pathStats = computed(() => pathGraph.value.stats);

const filteredGraphData = computed(() => {
  const query = searchText.value.trim().toLowerCase();
  const visibleNodes = pathGraph.value.nodes.filter((node) => {
    const text = `${node.label} ${node.category} ${(node.aliases || []).join(' ')}`.toLowerCase();
    const matchesText = !query || text.includes(query);
    const matchesSource = sourceFilter.value === 'all' || node.source === sourceFilter.value;
    const matchesCategory = categoryFilter.value === 'all' || node.category === categoryFilter.value;
    return matchesText && matchesSource && matchesCategory;
  });
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  return {
    nodes: visibleNodes,
    edges: pathGraph.value.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
  };
});

function clearPolling() {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = null;
}

function schedulePolling() {
  clearPolling();
  if (!isParsing.value) return;
  pollTimer = window.setTimeout(() => loadGraph({ silent: true }), 2000);
}

async function loadSelectedDetail() {
  if (!selectedNodeId.value) {
    selectedNodeDetail.value = null;
    return;
  }
  detailLoading.value = true;
  try {
    selectedNodeDetail.value = await getQuestionBankKnowledgePoint(bankId.value, selectedNodeId.value);
  } catch {
    selectedNodeDetail.value = selectedNode.value;
  } finally {
    detailLoading.value = false;
  }
}

async function loadGraph({ silent = false } = {}) {
  if (!bankId.value) return;
  if (!silent && !graphData.value) loading.value = true;
  error.value = '';
  try {
    const next = await getQuestionBankKnowledgeGraph(bankId.value);
    graphData.value = next;
    if (selectedNodeId.value && !next.nodes.some((node) => node.id === selectedNodeId.value)) {
      selectedNodeId.value = '';
      selectedNodeDetail.value = null;
    }
    if (selectedEdgeId.value && !next.edges.some((edge) => edge.id === selectedEdgeId.value)) {
      selectedEdgeId.value = '';
    }
    if (selectedNodeId.value) await loadSelectedDetail();
  } catch (loadError) {
    error.value = loadError.message || '知识图谱加载失败';
  } finally {
    loading.value = false;
    schedulePolling();
  }
}

async function selectNode(node) {
  selectedNodeId.value = node?.id || '';
  selectedEdgeId.value = '';
  selectedNodeDetail.value = node || null;
  await loadSelectedDetail();
}

function selectEdge(edge) {
  selectedEdgeId.value = edge?.id || '';
  selectedNodeId.value = '';
  selectedNodeDetail.value = null;
}

async function runMutation(label, action, { keepNodeId = selectedNodeId.value } = {}) {
  if (savingAction.value) return;
  savingAction.value = label;
  try {
    await action();
    await loadGraph({ silent: true });
    if (keepNodeId && nodes.value.some((node) => node.id === keepNodeId)) {
      selectedNodeId.value = keepNodeId;
      await loadSelectedDetail();
    }
    notify(`${label}成功`);
  } catch (mutationError) {
    notify(mutationError.message || `${label}失败`);
    if (String(mutationError.message || '').includes('更新')) await loadGraph({ silent: true });
  } finally {
    savingAction.value = '';
  }
}

function analyzePending() {
  return runMutation('解析待处理题目', () => analyzePendingQuestionKnowledge(bankId.value), { keepNodeId: '' });
}

function reconcileGraph() {
  if (!window.confirm('重新协调会按单题重新检查当前题库，确定继续吗？')) return;
  return runMutation('重新协调图谱', () => reconcileQuestionBankKnowledgeGraph(bankId.value), { keepNodeId: '' });
}

function addManualPoint() {
  const name = window.prompt('请输入知识点名称');
  if (!name?.trim()) return;
  return runMutation('新增知识点', () => createQuestionBankKnowledgePoint(bankId.value, {
    name: name.trim(),
    graphRevision: graphData.value.revision
  }), { keepNodeId: '' });
}

function saveNode(payload) {
  return runMutation('保存节点', () => updateQuestionBankKnowledgePoint(
    bankId.value,
    selectedNodeId.value,
    payload
  ));
}

function mergeNode(payload) {
  if (!window.confirm('合并后，题目关联和关系会迁移到目标节点，确定继续吗？')) return;
  const sourceId = selectedNodeId.value;
  return runMutation('合并节点', () => mergeQuestionBankKnowledgePoint(bankId.value, sourceId, payload), {
    keepNodeId: payload.targetPointId
  });
}

function hideNode(payload) {
  return runMutation('隐藏节点', () => removeQuestionBankKnowledgePoint(
    bankId.value,
    selectedNodeId.value,
    'hide',
    payload
  ), { keepNodeId: '' });
}

function unlinkNode(payload) {
  if (!window.confirm('确定解除该节点与题目的关联吗？人工节点会继续保留为待关联状态。')) return;
  return runMutation('解除关联', () => removeQuestionBankKnowledgePoint(
    bankId.value,
    selectedNodeId.value,
    'unlink',
    payload
  ));
}

function createRelation(payload) {
  return runMutation('建立关系', () => createQuestionBankKnowledgeRelation(bankId.value, payload));
}

function saveRelation(payload) {
  return runMutation('保存关系', () => updateQuestionBankKnowledgeRelation(
    bankId.value,
    selectedEdgeId.value,
    payload
  ), { keepNodeId: '' });
}

function deleteRelation(payload) {
  return runMutation('移除关系', () => deleteQuestionBankKnowledgeRelation(
    bankId.value,
    selectedEdgeId.value,
    payload
  ), { keepNodeId: '' });
}

function queueLayoutChange(change) {
  if (!change?.id) return;
  pendingLayouts.set(change.id, {
    knowledgePointId: change.id,
    x: change.x,
    y: change.y,
    pinned: true
  });
  if (layoutTimer) window.clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(flushLayout, 400);
}

async function flushLayout() {
  layoutTimer = null;
  if (!pendingLayouts.size || !graphData.value) return;
  const changes = [...pendingLayouts.values()];
  pendingLayouts.clear();
  try {
    await saveQuestionBankKnowledgeGraphLayout(bankId.value, {
      graphRevision: graphData.value.revision,
      nodes: changes
    });
    await loadGraph({ silent: true });
  } catch (layoutError) {
    notify(layoutError.message || '节点位置保存失败');
  }
}

function resetLayout() {
  return runMutation('恢复自动布局', () => saveQuestionBankKnowledgeGraphLayout(bankId.value, {
    graphRevision: graphData.value.revision,
    nodes: nodes.value.map((node) => ({ knowledgePointId: node.id, pinned: false }))
  }));
}

function relayoutGraph() {
  layoutKey.value += 1;
}

function fitGraph() {
  fitRequest.value += 1;
}

function openQuestion(question) {
  if (question?.id) router.push(`/questions/${question.id}`);
}

watch(bankId, () => {
  graphData.value = null;
  selectedNodeId.value = '';
  selectedEdgeId.value = '';
  loadGraph();
});

onMounted(loadGraph);
onBeforeUnmount(() => {
  clearPolling();
  if (layoutTimer) window.clearTimeout(layoutTimer);
});
</script>

<template>
  <main class="question-graph-page">
    <header class="graph-head">
      <div>
        <button class="back-link" type="button" @click="router.push(`/question-banks/${bankId}`)">
          <span class="material-symbols-outlined">arrow_back</span>
          返回题库
        </button>
        <span class="small-chip"><span class="material-symbols-outlined">account_tree</span>知识路径图</span>
        <h1>{{ graphData?.bank?.title || '题库知识路径图' }}</h1>
        <p>沿着基础知识、核心规律与综合应用查看当前题库的学习路径。</p>
      </div>
      <div class="head-actions">
        <button class="soft-btn" type="button" :disabled="Boolean(savingAction)" @click="addManualPoint">
          <span class="material-symbols-outlined">add_circle</span>新增知识点
        </button>
        <button class="primary-btn" type="button" :disabled="Boolean(savingAction)" @click="analyzePending">
          <span class="material-symbols-outlined">auto_awesome</span>
          {{ savingAction === '解析待处理题目' ? '正在提交' : '解析未完成题目' }}
        </button>
      </div>
    </header>

    <section class="graph-status">
      <div><strong>{{ stats.questionCount }}</strong><span>有效题目</span></div>
      <div><strong>{{ stats.analyzedCount }}</strong><span>已解析</span></div>
      <div><strong>{{ pathStats.nodeCount }}</strong><span>路径节点</span></div>
      <div><strong>{{ pathStats.edgeCount }}</strong><span>路径关系</span></div>
      <p v-if="isParsing"><span class="material-symbols-outlined spin">progress_activity</span>还有 {{ stats.pendingCount + stats.processingCount }} 道题正在解析，已有图谱可继续操作。</p>
      <p v-else-if="stats.failedCount"><span class="material-symbols-outlined">warning</span>{{ stats.failedCount }} 道题解析失败，可再次解析。</p>
      <p v-else><span class="material-symbols-outlined">check_circle</span>图谱已与当前题库同步</p>
    </section>

    <section class="graph-toolbar">
      <label class="graph-search">
        <span class="material-symbols-outlined">search</span>
        <input v-model="searchText" type="search" placeholder="搜索知识点或别名" />
      </label>
      <select v-model="sourceFilter">
        <option value="all">全部来源</option>
        <option value="explicit">题目标签</option>
        <option value="ai">AI 提取</option>
        <option value="manual">人工节点</option>
      </select>
      <select v-model="categoryFilter">
        <option value="all">全部主题</option>
        <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
      </select>
      <button class="toolbar-btn" type="button" @click="relayoutGraph"><span class="material-symbols-outlined">route</span>重新布局</button>
      <button class="toolbar-btn" type="button" @click="fitGraph"><span class="material-symbols-outlined">fit_screen</span>适应画布</button>
      <button class="toolbar-btn" type="button" @click="resetLayout"><span class="material-symbols-outlined">restart_alt</span>恢复自动布局</button>
      <button class="toolbar-btn" type="button" @click="reconcileGraph"><span class="material-symbols-outlined">sync</span>协调数据</button>
    </section>

    <p v-if="error" class="graph-error"><span class="material-symbols-outlined">error</span>{{ error }}</p>

    <section class="graph-workspace">
      <div class="graph-canvas-card">
        <div v-if="loading && !graphData" class="graph-empty">
          <span class="material-symbols-outlined spin">progress_activity</span>
          <strong>正在读取题库知识点</strong>
        </div>
        <div v-else-if="!filteredGraphData.nodes.length" class="graph-empty">
          <span class="material-symbols-outlined">hub</span>
          <strong>{{ stats.questionCount ? '还没有可展示的知识点' : '题库中还没有题目' }}</strong>
          <p>{{ stats.questionCount ? '点击“解析未完成题目”，或手动新增知识点。' : '先返回题库新增题目，再构建动态知识图谱。' }}</p>
        </div>
        <KnowledgeGraphRenderer
          v-else
          :graph-data="filteredGraphData"
          :active-node-id="selectedNodeId"
          :active-edge-id="selectedEdgeId"
          :search-text="searchText"
          :layout-key="layoutKey"
          :fit-request="fitRequest"
          @select-node="selectNode"
          @select-edge="selectEdge"
          @layout-change="queueLayoutChange"
        />
      </div>

      <KnowledgeGraphInspector
        :node="selectedNodeDetail || selectedNode"
        :edge="selectedEdge"
        :nodes="nodes"
        :edges="edges"
        :revision="graphData?.revision || 0"
        :saving="Boolean(savingAction) || detailLoading"
        @save-node="saveNode"
        @merge-node="mergeNode"
        @hide-node="hideNode"
        @unlink-node="unlinkNode"
        @create-relation="createRelation"
        @save-relation="saveRelation"
        @delete-relation="deleteRelation"
        @open-question="openQuestion"
      />
    </section>
  </main>
</template>

<style scoped>
.question-graph-page {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 14px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 0 2px 14px;
}

.graph-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
}

.graph-head h1 {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: clamp(28px, 3vw, 42px);
}

.graph-head p { margin-top: 6px; color: var(--muted); font-size: 13px; }
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
}
.head-actions { display: flex; gap: 10px; }

.graph-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, .62);
}
.graph-status div {
  display: grid;
  min-width: 74px;
  gap: 2px;
  padding-right: 10px;
  border-right: 1px solid var(--line);
}
.graph-status strong { font-family: var(--font-number); font-size: 20px; }
.graph-status span { color: var(--muted); font-size: 11px; }
.graph-status p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
}
.graph-status p .material-symbols-outlined { color: var(--green); font-size: 18px; }

.graph-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.graph-search {
  display: flex;
  flex: 1;
  min-width: 180px;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .72);
  padding: 0 10px;
}
.graph-search input { flex: 1; min-width: 0; border: 0; background: transparent; padding: 10px 0; outline: none; }
.graph-toolbar select,
.toolbar-btn {
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(255, 255, 255, .72);
  color: var(--ink);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
}
.toolbar-btn { display: inline-flex; align-items: center; gap: 5px; }
.toolbar-btn .material-symbols-outlined { font-size: 17px; }

.graph-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  min-height: 0;
}
.graph-canvas-card {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, .62);
  box-shadow: var(--shadow-soft);
}
.graph-empty {
  display: grid;
  height: 100%;
  min-height: 420px;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: var(--muted);
  text-align: center;
}
.graph-empty .material-symbols-outlined { color: var(--green); font-size: 40px; }
.graph-empty strong { color: var(--ink); font-size: 18px; }
.graph-error {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 10px;
  background: #fff0ed;
  color: #a54839;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1180px) {
  .question-graph-page {
    grid-template-rows: auto auto auto auto;
    align-content: start;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .question-graph-page::-webkit-scrollbar { display: none; }
  .graph-toolbar { flex-wrap: wrap; }
  .graph-workspace { grid-template-columns: 1fr; }
  .graph-canvas-card { height: 680px; }
}

@media (max-width: 760px) {
  .graph-head { align-items: stretch; flex-direction: column; }
  .head-actions { flex-wrap: wrap; }
  .graph-status { flex-wrap: wrap; }
  .graph-status p { width: 100%; margin-left: 0; }
  .graph-search { flex-basis: 100%; }
  .graph-canvas-card { height: 560px; padding: 8px; }
}
</style>
