# Knowledge Base Static Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在知识库管理页增加知识图谱入口，并提供复用现有四阶段渲染器的只读静态知识图谱页面。

**Architecture:** 静态节点和关系放在独立数据模块中，由新页面完成搜索、主题筛选和选中状态管理；现有 `KnowledgeGraphRenderer` 继续负责四阶段投影和 G6 绘制，仅增加向后兼容的计数单位与图例文案属性。新建只读详情组件，不复用带 CRUD 的题库编辑器，也不调用任何知识图谱 API。

**Tech Stack:** Vue 3、Vue Router、AntV G6 5.1.1、Node.js 原生断言测试、Vite。

---

## 文件职责

- `src/components/knowledge/KnowledgeGraphRenderer.vue`：增加可选计数单位和图例文案，默认仍服务题库。
- `src/data/knowledgeBaseGraphMock.js`：唯一的知识库静态图谱数据源。
- `src/components/knowledge/KnowledgeBaseGraphDetail.vue`：只读节点详情和上下游路径。
- `src/pages/KnowledgeBaseKnowledgeGraphPage.vue`：知识库图谱页面状态、筛选和布局。
- `src/pages/KnowledgeBasePage.vue`：增加知识图谱入口。
- `src/router.js`：注册 `/knowledge-base/knowledge-graph`。
- `tests/knowledgeBaseKnowledgeGraphData.test.mjs`：校验静态数据和四阶段投影。
- `tests/knowledgeBaseKnowledgeGraphPage.test.mjs`：校验入口、路由、只读页面契约。
- `tests/questionKnowledgeGraphRenderer.test.mjs`：校验渲染器默认题库文案和可配置知识库文案。

### Task 1: 让共享渲染器支持知识库计数文案

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraphRenderer.vue`
- Modify: `tests/questionKnowledgeGraphRenderer.test.mjs`

- [ ] **Step 1: 写失败测试**

在现有渲染器契约测试中加入：

```js
assert.ok(renderer.includes("countUnit: { type: String, default: '道题' }"));
assert.ok(renderer.includes("countLegend: { type: String, default: '节点越大表示关联题目越多' }"));
assert.ok(renderer.includes('${node.questionCount} ${props.countUnit}'));
assert.ok(renderer.includes('{{ countLegend }}'));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: FAIL，缺少 `countUnit` 或 `countLegend`。

- [ ] **Step 3: 最小实现可配置文案**

向 `defineProps` 增加：

```js
countUnit: { type: String, default: '道题' },
countLegend: { type: String, default: '节点越大表示关联题目越多' }
```

把节点标签改为：

```js
labelText: `${node.label}\n${node.questionCount} ${props.countUnit}`
```

模板图例改为：

```vue
<span><b></b>{{ countLegend }}</span>
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: PASS，输出 `question knowledge graph renderer contracts passed`。

- [ ] **Step 5: 提交**

```bash
git add src/components/knowledge/KnowledgeGraphRenderer.vue tests/questionKnowledgeGraphRenderer.test.mjs
git commit -m "feat: customize knowledge graph count labels"
```

### Task 2: 建立静态知识库图谱数据

**Files:**
- Create: `src/data/knowledgeBaseGraphMock.js`
- Create: `tests/knowledgeBaseKnowledgeGraphData.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写失败的数据契约测试**

测试导入 `knowledgeBaseGraphSummary` 和 `knowledgeBaseGraphData`，断言：

```js
assert.equal(knowledgeBaseGraphSummary.title, '高中物理知识体系');
assert.ok(knowledgeBaseGraphData.nodes.length >= 16);
assert.ok(knowledgeBaseGraphData.edges.length >= 18);

const nodeIds = new Set(knowledgeBaseGraphData.nodes.map((node) => node.id));
assert.equal(nodeIds.size, knowledgeBaseGraphData.nodes.length);
assert.ok(knowledgeBaseGraphData.nodes.every((node) => (
  node.label && node.category && node.description &&
  Array.isArray(node.aliases) && Array.isArray(node.materialRefs)
)));
assert.ok(knowledgeBaseGraphData.edges.every((edge) => (
  nodeIds.has(edge.source) && nodeIds.has(edge.target)
)));

const teaching = projectTeachingPathGraph(knowledgeBaseGraphData);
assert.deepEqual([...new Set(teaching.nodes.map((node) => node.stageIndex))], [0, 1, 2, 3]);
assert.ok(teaching.edges.some((edge) => edge.defaultVisible));
assert.ok(teaching.edges.some((edge) => !edge.defaultVisible));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node tests/knowledgeBaseKnowledgeGraphData.test.mjs`

Expected: FAIL，提示 `knowledgeBaseGraphMock.js` 不存在。

- [ ] **Step 3: 创建静态数据模块**

导出概要：

```js
export const knowledgeBaseGraphSummary = {
  title: '高中物理知识体系',
  description: '基于教材、课标与教学资料整理的静态知识路径示例。',
  materialCount: 12,
  sourceLabels: ['高中物理必修一', '课程标准', '力学专题讲义', '实验教学资料']
};
```

创建 18 个稳定节点，按下列 ID 和语义组织：

```js
const nodes = [
  ['force-concept', '力的基本概念', '力学基础'],
  ['mass-inertia', '质量与惯性', '力学基础'],
  ['reference-frame', '参考系', '运动学基础'],
  ['velocity', '速度', '运动学基础'],
  ['acceleration', '加速度', '运动学基础'],
  ['newton-first-law', '牛顿第一定律', '核心规律'],
  ['newton-second-law', '牛顿第二定律', '核心规律'],
  ['newton-third-law', '牛顿第三定律', '核心规律'],
  ['momentum-theorem', '动量定理', '核心规律'],
  ['energy-conservation', '机械能守恒', '核心规律'],
  ['force-analysis', '受力分析', '解题方法'],
  ['orthogonal-decomposition', '正交分解', '解题方法'],
  ['whole-isolation', '整体与隔离法', '解题方法'],
  ['critical-condition', '临界条件分析', '解题方法'],
  ['inclined-plane', '斜面动力学', '综合应用'],
  ['connected-system', '连接体问题', '综合应用'],
  ['conveyor-belt', '传送带问题', '综合应用'],
  ['collision-dynamics', '碰撞与综合动力学', '综合应用']
];
```

每个节点补齐 `questionCount`、`source: 'explicit'`、中文 `description`、`aliases` 和 `materialRefs`。建立从五个基础节点到核心规律、从核心规律到四种方法、从方法到四种综合应用的有向边；额外加入同阶段或跨阶段边，确保点击节点后存在可展开的隐藏关系。关系类型只使用 `prerequisite`、`derivation` 和 `application`。

最终导出：

```js
export const knowledgeBaseGraphData = { nodes, edges };
```

- [ ] **Step 4: 运行数据测试并确认通过**

Run: `node tests/knowledgeBaseKnowledgeGraphData.test.mjs`

Expected: PASS，输出 `knowledge base knowledge graph data tests passed`。

- [ ] **Step 5: 加入知识图谱测试脚本**

把 `node tests/knowledgeBaseKnowledgeGraphData.test.mjs` 放入 `test:knowledge-graph`，紧跟 `questionKnowledgeTeachingPath.test.mjs`。

- [ ] **Step 6: 提交**

```bash
git add src/data/knowledgeBaseGraphMock.js tests/knowledgeBaseKnowledgeGraphData.test.mjs package.json
git commit -m "feat: add static knowledge base graph data"
```

### Task 3: 创建只读详情组件和知识库图谱页面

**Files:**
- Create: `src/components/knowledge/KnowledgeBaseGraphDetail.vue`
- Create: `src/pages/KnowledgeBaseKnowledgeGraphPage.vue`
- Create: `tests/knowledgeBaseKnowledgeGraphPage.test.mjs`
- Modify: `src/pages/KnowledgeBasePage.vue`
- Modify: `src/router.js`
- Modify: `package.json`

- [ ] **Step 1: 写失败的页面契约测试**

读取路由、知识库管理页、新页面和详情组件，加入断言：

```js
assert.ok(router.includes("path: '/knowledge-base/knowledge-graph'"));
assert.ok(router.includes('KnowledgeBaseKnowledgeGraphPage'));
assert.ok(knowledgeBasePage.includes("router.push('/knowledge-base/knowledge-graph')"));
assert.ok(knowledgeBasePage.includes('知识图谱'));
assert.ok(graphPage.includes('KnowledgeGraphRenderer'));
assert.ok(graphPage.includes('KnowledgeBaseGraphDetail'));
assert.ok(graphPage.includes('knowledgeBaseGraphData'));
assert.ok(graphPage.includes('重新分层'));
assert.ok(graphPage.includes('适应画布'));
assert.ok(graphPage.includes('count-unit="条资料"'));
assert.ok(!graphPage.includes('getQuestionBankKnowledgeGraph'));
assert.ok(!graphPage.includes('saveQuestionBankKnowledgeGraphLayout'));
assert.ok(!graphPage.includes('analyzePendingQuestionKnowledge'));
assert.ok(detail.includes('引用资料'));
assert.ok(detail.includes('前置知识'));
assert.ok(detail.includes('后续路径'));
assert.ok(!detail.includes("emit('save-node'"));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node tests/knowledgeBaseKnowledgeGraphPage.test.mjs`

Expected: FAIL，提示新页面或详情组件不存在。

- [ ] **Step 3: 创建只读详情组件**

组件 Props：

```js
const props = defineProps({
  node: { type: Object, default: null },
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] }
});
```

计算 `incoming` 与 `outgoing`，将关系端点映射为节点名称。未选中时显示“点击画布查看详情”；选中时依次显示节点名称、主题、说明、别名、引用资料、前置知识和后续路径。整个模板不包含输入框、保存按钮或危险操作。

- [ ] **Step 4: 创建页面状态与筛选**

页面同步导入静态数据和概要：

```js
const searchText = ref('');
const categoryFilter = ref('all');
const selectedNodeId = ref('');
const layoutKey = ref(0);
const fitRequest = ref(0);

const nodes = knowledgeBaseGraphData.nodes;
const edges = knowledgeBaseGraphData.edges;
const selectedNode = computed(() => nodes.find((node) => node.id === selectedNodeId.value) || null);
const categories = [...new Set(nodes.map((node) => node.category))].sort();
```

`filteredGraphData` 根据名称、分类、别名和说明过滤节点，并只保留端点都可见的关系。节点选择只更新 `selectedNodeId`，不触发网络调用。

- [ ] **Step 5: 创建页面模板和样式**

页面使用题库图谱同类结构，渲染器调用必须包含：

```vue
<KnowledgeGraphRenderer
  :graph-data="filteredGraphData"
  :active-node-id="selectedNodeId"
  :search-text="searchText"
  :layout-key="layoutKey"
  :fit-request="fitRequest"
  count-unit="条资料"
  count-legend="关联资料越多，节点证据越充分"
  @select-node="selectNode"
/>
```

右侧渲染：

```vue
<KnowledgeBaseGraphDetail
  :node="selectedNode"
  :nodes="nodes"
  :edges="edges"
/>
```

桌面使用 `minmax(0, 1fr) 320px`，1180px 以下改为单列并让 `.question-graph-page` 自身纵向滚动；760px 以下降低画布高度和内边距。

- [ ] **Step 6: 注册路由和入口**

在 `router.js` 增加懒加载：

```js
const KnowledgeBaseKnowledgeGraphPage = () => import('./pages/KnowledgeBaseKnowledgeGraphPage.vue');
```

并在知识库路由之后注册：

```js
{
  path: '/knowledge-base/knowledge-graph',
  name: 'knowledge-base-knowledge-graph',
  component: KnowledgeBaseKnowledgeGraphPage
}
```

在 `KnowledgeBasePage.vue` 的头部操作区增加：

```vue
<button class="soft-btn" type="button" @click="router.push('/knowledge-base/knowledge-graph')">
  <span class="material-symbols-outlined">account_tree</span>
  知识图谱
</button>
```

- [ ] **Step 7: 运行页面测试并确认通过**

Run: `node tests/knowledgeBaseKnowledgeGraphPage.test.mjs`

Expected: PASS，输出 `knowledge base knowledge graph page contract passed`。

- [ ] **Step 8: 加入测试脚本并运行相关回归**

把页面测试加入 `test:knowledge-graph`，并运行：

```bash
node tests/knowledgeBaseKnowledgeGraphData.test.mjs
node tests/knowledgeBaseKnowledgeGraphPage.test.mjs
node tests/questionKnowledgeGraphRenderer.test.mjs
node tests/questionBankKnowledgeGraphPage.test.mjs
```

Expected: 四组测试全部 PASS。

- [ ] **Step 9: 提交**

```bash
git add src/components/knowledge/KnowledgeBaseGraphDetail.vue src/pages/KnowledgeBaseKnowledgeGraphPage.vue src/pages/KnowledgeBasePage.vue src/router.js tests/knowledgeBaseKnowledgeGraphPage.test.mjs package.json
git commit -m "feat: add knowledge base graph entry"
```

### Task 4: 完整验证、合并与推送

**Files:**
- Verify: `src/components/knowledge/KnowledgeGraphRenderer.vue`
- Verify: `src/data/knowledgeBaseGraphMock.js`
- Verify: `src/components/knowledge/KnowledgeBaseGraphDetail.vue`
- Verify: `src/pages/KnowledgeBaseKnowledgeGraphPage.vue`

- [ ] **Step 1: 运行完整知识图谱测试**

Run: `npm run test:knowledge-graph`

Expected: 所有题库与知识库知识图谱测试通过，0 failures。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite 构建成功；允许项目已有的大 chunk warning，不允许编译错误。

- [ ] **Step 3: 浏览器验收**

检查：

1. `/knowledge-base` 右上角出现“知识图谱”。
2. 点击后进入 `/knowledge-base/knowledge-graph`，返回按钮可回到知识库。
3. 四阶段背景、静态节点和主路径可见。
4. 节点计数显示“条资料”，图例不出现“题目”。
5. 点击节点后只读详情更新并展开相关隐藏路径。
6. 搜索、主题筛选、重新分层和适应画布正常。
7. 768px 和 375px 下无横向溢出且可纵向滚动。
8. 浏览器控制台无错误。

- [ ] **Step 4: 合并后复验**

把实现分支合并回 `main`，在 `main` 重新运行 `npm run test:knowledge-graph` 和 `npm run build`。

- [ ] **Step 5: 推送**

Run: `git push origin main`

Expected: `origin/main` 与本地 `main` 指向同一提交；Git 全局代理继续使用用户已指定的 `http://127.0.0.1:7892`。
