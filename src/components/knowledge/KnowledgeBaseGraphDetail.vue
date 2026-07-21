<script setup>
import { computed } from 'vue';

const props = defineProps({
  node: { type: Object, default: null },
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] }
});

const emit = defineEmits(['select-node']);

const nodeMap = computed(() => new Map(props.nodes.map((node) => [node.id, node])));

const incoming = computed(() => (
  props.node
    ? props.edges
      .filter((edge) => edge.target === props.node.id)
      .map((edge) => ({ ...edge, node: nodeMap.value.get(edge.source) }))
      .filter((edge) => edge.node)
    : []
));

const outgoing = computed(() => (
  props.node
    ? props.edges
      .filter((edge) => edge.source === props.node.id)
      .map((edge) => ({ ...edge, node: nodeMap.value.get(edge.target) }))
      .filter((edge) => edge.node)
    : []
));

const relationLabels = {
  prerequisite: '前置知识',
  derivation: '推导关系',
  application: '应用于'
};

function relationLabel(edge) {
  return edge.label || relationLabels[edge.type] || '相关';
}
</script>

<template>
  <aside class="knowledge-base-graph-detail">
    <template v-if="node">
      <header class="detail-head">
        <div>
          <span class="small-chip">只读详情</span>
          <h2>{{ node.label }}</h2>
        </div>
        <span class="detail-count">{{ node.questionCount }} 条资料</span>
      </header>

      <section class="detail-section detail-overview">
        <span>{{ node.category }}</span>
        <p>{{ node.description }}</p>
      </section>

      <section class="detail-section">
        <h3>知识点别名</h3>
        <div class="detail-tags">
          <span v-for="alias in node.aliases" :key="alias">{{ alias }}</span>
        </div>
      </section>

      <section class="detail-section">
        <h3>引用资料</h3>
        <ul class="material-list">
          <li v-for="material in node.materialRefs" :key="material">
            <span class="material-symbols-outlined">description</span>
            {{ material }}
          </li>
        </ul>
      </section>

      <section class="detail-section">
        <h3>前置知识 <em>{{ incoming.length }}</em></h3>
        <div v-if="incoming.length" class="path-list">
          <button
            v-for="edge in incoming"
            :key="edge.id"
            type="button"
            @click="emit('select-node', edge.node)"
          >
            <strong>{{ edge.node.label }}</strong>
            <span>{{ relationLabel(edge) }}</span>
          </button>
        </div>
        <p v-else class="empty-path">这是当前路径的基础知识点。</p>
      </section>

      <section class="detail-section">
        <h3>后续路径 <em>{{ outgoing.length }}</em></h3>
        <div v-if="outgoing.length" class="path-list">
          <button
            v-for="edge in outgoing"
            :key="edge.id"
            type="button"
            @click="emit('select-node', edge.node)"
          >
            <strong>{{ edge.node.label }}</strong>
            <span>{{ relationLabel(edge) }}</span>
          </button>
        </div>
        <p v-else class="empty-path">这是当前路径的综合应用节点。</p>
      </section>
    </template>

    <div v-else class="detail-empty">
      <span class="small-chip">知识点详情</span>
      <span class="material-symbols-outlined">ads_click</span>
      <strong>点击画布查看详情</strong>
      <p>选择一个知识点，查看说明、引用资料和上下游知识路径。</p>
    </div>
  </aside>
</template>

<style scoped>
.knowledge-base-graph-detail {
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, .76);
  box-shadow: var(--shadow-soft);
  scrollbar-width: none;
}

.knowledge-base-graph-detail::-webkit-scrollbar { display: none; }

.detail-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--line);
}

.detail-head h2 {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: 23px;
  line-height: 1.2;
}

.detail-count {
  flex: 0 0 auto;
  border-radius: 999px;
  background: #edf6f1;
  color: #176b49;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 800;
}

.detail-section {
  display: grid;
  gap: 10px;
  padding: 15px 18px;
  border-bottom: 1px solid rgba(218, 226, 221, .74);
}

.detail-section:last-child { border-bottom: 0; }

.detail-section h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ink);
  font-size: 12px;
  font-weight: 850;
}

.detail-section h3 em {
  color: var(--muted);
  font-family: var(--font-number);
  font-size: 11px;
  font-style: normal;
}

.detail-overview > span {
  width: max-content;
  border-radius: 6px;
  background: #f1f4f2;
  color: #476456;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 800;
}

.detail-overview p,
.detail-empty p,
.empty-path {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.detail-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.detail-tags span {
  border: 1px solid #d6e3dc;
  border-radius: 999px;
  color: #315846;
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 700;
}

.material-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.material-list li {
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 10px;
  background: #f7f9f8;
  color: #405a4e;
  padding: 8px 9px;
  font-size: 11px;
  font-weight: 700;
}
.material-list .material-symbols-outlined { color: #56806c; font-size: 16px; }

.path-list { display: grid; gap: 7px; }
.path-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #f7f9f8;
  color: var(--ink);
  padding: 8px 9px;
  text-align: left;
}
.path-list button:hover { border-color: #a9cbb9; background: #f1f7f4; }
.path-list strong { font-size: 11px; }
.path-list span { color: var(--muted); font-size: 9px; white-space: nowrap; }

.detail-empty {
  display: grid;
  min-height: 100%;
  place-items: center;
  align-content: center;
  gap: 12px;
  padding: 32px 24px;
  text-align: center;
}
.detail-empty > .material-symbols-outlined { color: #36a675; font-size: 44px; }
.detail-empty strong { color: var(--ink); font-size: 18px; }

@media (max-width: 1180px) {
  .knowledge-base-graph-detail { max-height: none; overflow: visible; }
}
</style>
