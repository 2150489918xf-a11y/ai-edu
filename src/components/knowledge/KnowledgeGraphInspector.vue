<script setup>
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps({
  node: { type: Object, default: null },
  edge: { type: Object, default: null },
  nodes: { type: Array, default: () => [] },
  revision: { type: Number, default: 0 },
  saving: { type: Boolean, default: false }
});

const emit = defineEmits([
  'save-node',
  'merge-node',
  'hide-node',
  'unlink-node',
  'create-relation',
  'save-relation',
  'delete-relation',
  'open-question'
]);

const nodeForm = reactive({ name: '', category: '', aliases: '', description: '', manualLocked: true });
const edgeForm = reactive({ label: '', type: 'related' });
const mergeTargetId = ref('');
const relationTargetId = ref('');
const relationType = ref('related');
const relationLabel = ref('相关');

const otherNodes = computed(() => props.nodes.filter((node) => node.id !== props.node?.id));
const canEditEdge = computed(() => props.edge?.sourceKind === 'manual' || props.edge?.locked);

watch(() => props.node, (node) => {
  nodeForm.name = node?.name || node?.label || '';
  nodeForm.category = node?.category === '未分类' ? '' : node?.category || '';
  nodeForm.aliases = (node?.aliases || []).join('，');
  nodeForm.description = node?.description || '';
  nodeForm.manualLocked = node?.manualLocked ?? node?.locked ?? true;
  mergeTargetId.value = '';
  relationTargetId.value = '';
}, { immediate: true, deep: true });

watch(() => props.edge, (edge) => {
  edgeForm.label = edge?.label || '';
  edgeForm.type = edge?.type || 'related';
}, { immediate: true, deep: true });

function parseAliases(value) {
  return String(value || '')
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function saveNode() {
  if (!props.node || !nodeForm.name.trim()) return;
  emit('save-node', {
    name: nodeForm.name.trim(),
    category: nodeForm.category.trim(),
    aliases: parseAliases(nodeForm.aliases),
    description: nodeForm.description.trim(),
    manualLocked: nodeForm.manualLocked,
    graphRevision: props.revision
  });
}

function mergeNode() {
  if (!props.node || !mergeTargetId.value) return;
  emit('merge-node', {
    targetPointId: mergeTargetId.value,
    graphRevision: props.revision
  });
}

function createRelation() {
  if (!props.node || !relationTargetId.value) return;
  emit('create-relation', {
    sourcePointId: props.node.id,
    targetPointId: relationTargetId.value,
    type: relationType.value,
    label: relationLabel.value.trim(),
    graphRevision: props.revision
  });
}

function saveRelation() {
  if (!props.edge || !canEditEdge.value) return;
  emit('save-relation', {
    label: edgeForm.label.trim(),
    type: edgeForm.type,
    graphRevision: props.revision
  });
}
</script>

<template>
  <aside class="graph-inspector">
    <header class="inspector-head">
      <div>
        <span class="small-chip">图谱编辑</span>
        <h2>{{ node ? '知识点详情' : edge ? '关系详情' : '选择一个节点' }}</h2>
      </div>
      <span v-if="node" class="source-badge" :class="node.source">{{ node.source === 'manual' ? '人工' : node.source === 'explicit' ? '题目标签' : 'AI' }}</span>
    </header>

    <div v-if="!node && !edge" class="inspector-empty">
      <span class="material-symbols-outlined">ads_click</span>
      <strong>点击画布查看详情</strong>
      <p>可以编辑知识点、合并重复节点，或建立跨题关系。</p>
    </div>

    <template v-if="node">
      <section class="inspector-section">
        <label>
          <span>知识点名称</span>
          <input v-model="nodeForm.name" :disabled="saving" />
        </label>
        <label>
          <span>知识主题</span>
          <input v-model="nodeForm.category" :disabled="saving" placeholder="例如：动力学" />
        </label>
        <label>
          <span>别名</span>
          <input v-model="nodeForm.aliases" :disabled="saving" placeholder="使用逗号分隔" />
        </label>
        <label>
          <span>说明</span>
          <textarea v-model="nodeForm.description" :disabled="saving" rows="3"></textarea>
        </label>
        <label class="lock-row">
          <input v-model="nodeForm.manualLocked" type="checkbox" :disabled="saving" />
          <span>锁定人工修改，防止 AI 覆盖</span>
        </label>
        <button class="primary-btn" type="button" :disabled="saving || !nodeForm.name.trim()" @click="saveNode">
          <span class="material-symbols-outlined">save</span>
          保存节点
        </button>
      </section>

      <section class="inspector-section">
        <div class="section-title">
          <strong>关联题目</strong>
          <span>{{ node.questions?.length || node.questionCount || 0 }} 道</span>
        </div>
        <div class="question-links">
          <button
            v-for="question in node.questions || []"
            :key="question.id"
            type="button"
            @click="emit('open-question', question)"
          >
            <strong>{{ question.title }}</strong>
            <span>{{ question.type }} · {{ question.difficulty }}</span>
          </button>
          <p v-if="!(node.questions || []).length">{{ node.orphan ? '待关联题目' : '加载节点后显示题目来源' }}</p>
        </div>
      </section>

      <section class="inspector-section">
        <div class="section-title"><strong>添加关系</strong><span>人工锁定</span></div>
        <select v-model="relationTargetId" :disabled="saving">
          <option value="">选择目标节点</option>
          <option v-for="item in otherNodes" :key="item.id" :value="item.id">{{ item.label || item.name }}</option>
        </select>
        <div class="two-fields">
          <select v-model="relationType" :disabled="saving">
            <option value="related">相关</option>
            <option value="prerequisite">前置知识</option>
            <option value="derivation">推导关系</option>
            <option value="application">应用于</option>
            <option value="confusable">易混淆</option>
          </select>
          <input v-model="relationLabel" :disabled="saving" placeholder="关系名称" />
        </div>
        <button class="soft-btn full" type="button" :disabled="saving || !relationTargetId" @click="createRelation">
          <span class="material-symbols-outlined">add_link</span>
          建立关系
        </button>
      </section>

      <section class="inspector-section danger-zone">
        <div class="section-title"><strong>节点整理</strong><span>谨慎操作</span></div>
        <select v-model="mergeTargetId" :disabled="saving">
          <option value="">选择重复节点的合并目标</option>
          <option v-for="item in otherNodes" :key="item.id" :value="item.id">{{ item.label || item.name }}</option>
        </select>
        <button class="soft-btn full" type="button" :disabled="saving || !mergeTargetId" @click="mergeNode">合并到目标节点</button>
        <div class="danger-actions">
          <button type="button" :disabled="saving" @click="emit('hide-node', { graphRevision: revision })">隐藏节点</button>
          <button type="button" :disabled="saving" @click="emit('unlink-node', { graphRevision: revision, includeManual: true })">解除题目关联</button>
        </div>
      </section>
    </template>

    <section v-else-if="edge" class="inspector-section">
      <div class="section-title"><strong>关系设置</strong><span>{{ edge.supportCount || 0 }} 条证据</span></div>
      <label>
        <span>关系名称</span>
        <input v-model="edgeForm.label" :disabled="saving || !canEditEdge" />
      </label>
      <label>
        <span>关系类型</span>
        <select v-model="edgeForm.type" :disabled="saving || !canEditEdge">
          <option value="co_occurrence">共同考查</option>
          <option value="related">相关</option>
          <option value="prerequisite">前置知识</option>
          <option value="derivation">推导关系</option>
          <option value="application">应用于</option>
          <option value="confusable">易混淆</option>
        </select>
      </label>
      <p v-if="!canEditEdge" class="read-only-tip">自动关系可以隐藏，但语义不能直接修改。</p>
      <div class="edge-actions">
        <button class="primary-btn" type="button" :disabled="saving || !canEditEdge" @click="saveRelation">保存关系</button>
        <button class="soft-btn danger" type="button" :disabled="saving" @click="emit('delete-relation', { graphRevision: revision })">
          {{ canEditEdge ? '删除关系' : '隐藏关系' }}
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.graph-inspector {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: 14px;
  overflow-y: auto;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, .76);
  box-shadow: var(--shadow-soft);
  scrollbar-width: none;
}

.graph-inspector::-webkit-scrollbar { display: none; }

.inspector-head,
.section-title,
.edge-actions,
.danger-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.inspector-head h2 {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: 22px;
}

.source-badge {
  border-radius: 999px;
  background: var(--mint);
  color: var(--green);
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 800;
}

.source-badge.manual { background: #efe9ff; color: #7052bf; }
.source-badge.explicit { background: #e8f2ff; color: #3472a8; }

.inspector-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 280px;
  color: var(--muted);
  text-align: center;
}

.inspector-empty .material-symbols-outlined { color: var(--green); font-size: 38px; }

.inspector-section {
  display: grid;
  gap: 11px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.inspector-section label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.inspector-section input,
.inspector-section textarea,
.inspector-section select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, .86);
  color: var(--ink);
  padding: 9px 10px;
  outline: none;
}

.lock-row { display: flex !important; align-items: center; }
.lock-row input { width: 16px; }
.two-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.full { width: 100%; }

.section-title span,
.question-links span,
.question-links p,
.read-only-tip {
  color: var(--muted);
  font-size: 11px;
}

.question-links { display: grid; gap: 7px; }
.question-links button {
  display: grid;
  gap: 3px;
  border: 0;
  border-radius: 10px;
  background: rgba(239, 248, 243, .9);
  padding: 9px;
  color: var(--ink);
  text-align: left;
}

.danger-zone { border-color: rgba(165, 72, 57, .18); }
.danger-actions button {
  flex: 1;
  border: 0;
  background: transparent;
  color: #a54839;
  font-size: 12px;
  font-weight: 800;
}

.soft-btn.danger { color: #a54839; }

@media (max-width: 1080px) {
  .graph-inspector { max-height: 520px; }
}
</style>
