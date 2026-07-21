<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import KnowledgeBaseGraphDetail from '../components/knowledge/KnowledgeBaseGraphDetail.vue';
import KnowledgeGraphRenderer from '../components/knowledge/KnowledgeGraphRenderer.vue';
import {
  knowledgeBaseGraphData,
  knowledgeBaseGraphSummary
} from '../data/knowledgeBaseGraphMock.js';

const router = useRouter();
const searchText = ref('');
const categoryFilter = ref('all');
const selectedNodeId = ref('');
const layoutKey = ref(0);
const fitRequest = ref(0);

const nodes = knowledgeBaseGraphData.nodes;
const edges = knowledgeBaseGraphData.edges;
const categories = [...new Set(nodes.map((node) => node.category))].sort();
const selectedNode = computed(() => (
  nodes.find((node) => node.id === selectedNodeId.value) || null
));

const filteredGraphData = computed(() => {
  const query = searchText.value.trim().toLowerCase();
  const visibleNodes = nodes.filter((node) => {
    const searchable = [
      node.label,
      node.category,
      node.description,
      ...(node.aliases || [])
    ].join(' ').toLowerCase();
    return (!query || searchable.includes(query)) && (
      categoryFilter.value === 'all' || node.category === categoryFilter.value
    );
  });
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  return {
    nodes: visibleNodes,
    edges: edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
  };
});

function selectNode(node) {
  selectedNodeId.value = node?.id || '';
}

function relayoutGraph() {
  layoutKey.value += 1;
}

function fitGraph() {
  fitRequest.value += 1;
}
</script>

<template>
  <main class="knowledge-base-graph-page">
    <header class="graph-head">
      <div>
        <button class="back-link" type="button" @click="router.push('/knowledge-base')">
          <span class="material-symbols-outlined">arrow_back</span>
          返回知识库
        </button>
        <span class="small-chip"><span class="material-symbols-outlined">account_tree</span>知识路径图</span>
        <h1>{{ knowledgeBaseGraphSummary.title }}</h1>
        <p>{{ knowledgeBaseGraphSummary.description }}</p>
      </div>
      <div class="static-note">
        <span class="material-symbols-outlined">verified</span>
        <div><strong>静态教学示例</strong><p>展示教材资料之间的知识关联</p></div>
      </div>
    </header>

    <section class="graph-status">
      <div><strong>{{ knowledgeBaseGraphSummary.materialCount }}</strong><span>知识库资料</span></div>
      <div><strong>{{ nodes.length }}</strong><span>知识点</span></div>
      <div><strong>{{ edges.length }}</strong><span>路径关系</span></div>
      <div><strong>4</strong><span>教学阶段</span></div>
      <p><span class="material-symbols-outlined">info</span>当前为写死的演示数据，不调用数据库或 AI 服务。</p>
    </section>

    <section class="graph-toolbar">
      <label class="graph-search">
        <span class="material-symbols-outlined">search</span>
        <input v-model="searchText" type="search" placeholder="搜索知识点、别名或说明" />
      </label>
      <select v-model="categoryFilter" aria-label="主题筛选">
        <option value="all">全部主题</option>
        <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
      </select>
      <button class="toolbar-btn" type="button" @click="relayoutGraph">
        <span class="material-symbols-outlined">route</span>重新分层
      </button>
      <button class="toolbar-btn" type="button" @click="fitGraph">
        <span class="material-symbols-outlined">fit_screen</span>适应画布
      </button>
    </section>

    <section class="graph-workspace">
      <div class="graph-canvas-card">
        <div v-if="!filteredGraphData.nodes.length" class="graph-empty">
          <span class="material-symbols-outlined">search_off</span>
          <strong>没有匹配的知识点</strong>
          <p>调整搜索词或主题筛选后再试。</p>
        </div>
        <KnowledgeGraphRenderer
          v-else
          :graph-data="filteredGraphData"
          :active-node-id="selectedNodeId"
          :search-text="searchText"
          :layout-key="layoutKey"
          :fit-request="fitRequest"
          count-unit="条资料"
          count-legend="关联资料越多，节点证据越充分"
          @select-node="selectNode"
        />
      </div>

      <KnowledgeBaseGraphDetail
        :node="selectedNode"
        :nodes="nodes"
        :edges="edges"
        @select-node="selectNode"
      />
    </section>
  </main>
</template>

<style scoped>
.knowledge-base-graph-page {
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
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
}

.static-note {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 230px;
  border: 1px solid #cfdfd7;
  border-radius: 14px;
  background: rgba(255, 255, 255, .68);
  padding: 11px 13px;
}
.static-note > span { color: #2b9368; font-size: 24px; }
.static-note strong { font-size: 12px; }
.static-note p { margin-top: 2px; font-size: 10px; }

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
  min-width: 84px;
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
.graph-status p .material-symbols-outlined { color: #2b9368; font-size: 18px; }

.graph-toolbar { display: flex; align-items: center; gap: 8px; min-width: 0; }
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
.graph-empty .material-symbols-outlined { color: #2b9368; font-size: 40px; }
.graph-empty strong { color: var(--ink); font-size: 18px; }
.graph-empty p { font-size: 12px; }

@media (max-width: 1180px) {
  .knowledge-base-graph-page {
    grid-template-rows: auto auto auto auto;
    align-content: start;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .knowledge-base-graph-page::-webkit-scrollbar { display: none; }
  .graph-toolbar { flex-wrap: wrap; }
  .graph-workspace { grid-template-columns: 1fr; }
  .graph-canvas-card { height: 680px; }
}

@media (max-width: 760px) {
  .graph-head { align-items: stretch; flex-direction: column; }
  .static-note { min-width: 0; }
  .graph-status { flex-wrap: wrap; }
  .graph-status p { width: 100%; margin-left: 0; }
  .graph-search { flex-basis: 100%; }
  .graph-canvas-card { height: 560px; padding: 8px; }
}
</style>
