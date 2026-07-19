# 题库知识路径图美化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将题库知识图谱主画布改造成从左到右的知识路径分层图，减少关系交叉，同时保留完整关系数据、节点编辑和布局持久化。

**Architecture:** 新增一个无副作用的路径投影模块，过滤主路径关系、去重并处理环后输出 G6 数据；`KnowledgeGraphRenderer.vue` 使用 G6 内置 `antv-dagre` 负责布局、节点样式、路径高亮和视图适配；`QuestionBankKnowledgeGraphPage.vue` 负责搜索、主题/来源筛选、布局保存和状态协调；`KnowledgeGraphInspector.vue` 展示节点上下游及未绘制关系。后端 PostgreSQL、图谱 API 和现有布局表保持不变。

**Tech Stack:** Vue 3、AntV G6 5.1.1、Node.js 原生断言测试、Vite、现有 PostgreSQL/Prisma 图谱接口。

---

## 文件边界

- Create: `src/components/knowledge/knowledgePathProjection.js` - 将完整题库图谱投影为路径画布数据，包含关系过滤、去重、环处理、层级元数据和路径邻接计算。
- Create: `tests/questionKnowledgePathProjection.test.mjs` - 覆盖路径投影纯函数，不依赖浏览器、Vue 或数据库。
- Modify: `src/components/knowledge/KnowledgeGraphRenderer.vue` - 从 radial 圆球网络改为 Dagre 圆角矩形路径图，增加自适应视图、路径高亮和画布工具事件。
- Modify: `src/pages/QuestionBankKnowledgeGraphPage.vue` - 使用路径投影，移除关系/邻域筛选，维护路径统计、搜索定位和布局操作。
- Modify: `src/components/knowledge/KnowledgeGraphInspector.vue` - 增加前置/后续路径和非路径关系列表，支持从详情选择关系并保留现有编辑动作。
- Modify: `tests/questionKnowledgeGraphRenderer.test.mjs` - 更新渲染器静态契约，检查 Dagre、路径边、节点样式和 fitView。
- Modify: `tests/questionBankKnowledgeGraphPage.test.mjs` - 更新页面契约，检查路径投影和移除旧的关系/邻域筛选。
- Modify: `package.json` - 将路径投影测试加入 `test:knowledge-graph`。

## Task 1: 建立路径投影测试

**Files:**
- Create: `tests/questionKnowledgePathProjection.test.mjs`
- Create: `src/components/knowledge/knowledgePathProjection.js`

- [ ] **Step 1: 写失败测试，定义关系过滤和节点保留契约**

写入测试数据并断言：

```js
const graph = projectKnowledgePathGraph({
  nodes: [
    { id: 'base', label: '加速度', questionCount: 4 },
    { id: 'law', label: '牛顿第二定律', questionCount: 8 },
    { id: 'method', label: '受力分析', questionCount: 6 },
    { id: 'orphan', label: '未归类概念', questionCount: 1 }
  ],
  edges: [
    { id: 'e1', source: 'base', target: 'law', type: 'prerequisite', label: '前置知识' },
    { id: 'e2', source: 'law', target: 'method', type: 'application', label: '应用于' },
    { id: 'e3', source: 'base', target: 'method', type: 'co_occurrence', label: '共同考查' },
    { id: 'e4', source: 'law', target: 'method', type: 'related', label: '相关' }
  ]
});

assert.deepEqual(graph.nodes.map((node) => node.id), ['base', 'law', 'method', 'orphan']);
assert.deepEqual(graph.edges.map((edge) => edge.id), ['e1', 'e2']);
assert.equal(graph.nodes.find((node) => node.id === 'orphan').orphan, true);
assert.equal(graph.nodes.find((node) => node.id === 'base').layer, 0);
assert.equal(graph.nodes.find((node) => node.id === 'law').layer, 1);
assert.equal(graph.nodes.find((node) => node.id === 'method').layer, 2);
```

- [ ] **Step 2: 运行测试确认模块尚未实现**

Run: `node tests/questionKnowledgePathProjection.test.mjs`

Expected: FAIL with a module-not-found or missing-export error for `projectKnowledgePathGraph`.

- [ ] **Step 3: 实现最小路径投影函数**

在 `src/components/knowledge/knowledgePathProjection.js` 导出：

```js
export const PATH_RELATION_TYPES = new Set(['prerequisite', 'derivation', 'application']);

export function projectKnowledgePathGraph(source = {}) {
  const nodes = normalizeNodes(source.nodes || []);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = normalizePathEdges(source.edges || [], nodeIds);
  const acyclicEdges = removeCycleEdges(edges);
  const layers = computeLayers(nodes, acyclicEdges);
  return {
    nodes: nodes.map((node) => ({ ...node, layer: layers.get(node.id) ?? null, orphan: !layers.has(node.id) })),
    edges: acyclicEdges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: acyclicEdges.length,
      orphanCount: nodes.filter((node) => !layers.has(node.id)).length,
      layerCount: Math.max(0, ...layers.values()) + 1
    }
  };
}
```

Keep all helper functions private. `normalizeNodes` must preserve the original node fields needed by the inspector, including `position`, `category`, `source`, `questionCount`, `aliases`, `description`, `locked` and `questions`. `normalizePathEdges` must filter invalid endpoints, self-loops, non-path relation types, and duplicate `(source,target,type)` tuples while preserving the first deterministic edge ordered by `id`.

- [ ] **Step 4: 运行测试确认基础投影通过**

Run: `node tests/questionKnowledgePathProjection.test.mjs`

Expected: PASS for filtering, node retention and topological layers.

- [ ] **Step 5: 提交纯函数与测试**

```bash
git add src/components/knowledge/knowledgePathProjection.js tests/questionKnowledgePathProjection.test.mjs
git commit -m "test: define question knowledge path projection"
```

## Task 2: 覆盖环、重复边和稳定排序

**Files:**
- Modify: `tests/questionKnowledgePathProjection.test.mjs`
- Modify: `src/components/knowledge/knowledgePathProjection.js`

- [ ] **Step 1: 写失败测试，定义环处理和排序规则**

增加以下断言：

```js
const cyclic = projectKnowledgePathGraph({
  nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
  edges: [
    { id: 'z', source: 'c', target: 'a', type: 'application', supportCount: 1 },
    { id: 'a', source: 'a', target: 'b', type: 'prerequisite', supportCount: 3 },
    { id: 'b', source: 'b', target: 'c', type: 'derivation', supportCount: 2 },
    { id: 'duplicate', source: 'a', target: 'b', type: 'prerequisite', supportCount: 1 },
    { id: 'self', source: 'a', target: 'a', type: 'application' }
  ]
});

assert.equal(cyclic.edges.some((edge) => edge.id === 'duplicate'), false);
assert.equal(cyclic.edges.some((edge) => edge.id === 'self'), false);
assert.equal(cyclic.edges.length, 2);
assert.ok(cyclic.nodes.every((node) => node.layer === null || Number.isInteger(node.layer)));
```

Use deterministic cycle breaking: repeatedly detect a cycle; remove the lowest-priority edge in that cycle by comparing `type` priority (`application` 1, `derivation` 2, `prerequisite` 3), then `supportCount`, then `id` ascending. This retains the strongest instructional path and never mutates the source graph.

- [ ] **Step 2: 运行测试确认环断言失败**

Run: `node tests/questionKnowledgePathProjection.test.mjs`

Expected: FAIL because the initial implementation does not yet remove cyclic edges deterministically.

- [ ] **Step 3: 实现稳定的环处理与层级计算**

Implement `removeCycleEdges` with a DFS cycle detector over the current edge list. When a cycle is found, remove exactly one selected edge and restart detection. Implement `computeLayers` with Kahn-style indegree processing: roots receive layer `0`; each target receives the maximum predecessor layer plus one. Nodes with no retained path edge receive `null`; do not drop them.

Sort output nodes by `layer` (`null` last), then `category`, then `label`, then `id`; sort output edges by `source`, `target`, `type`, `id`. This makes snapshots, `nodeOrder`, and G6 initial placement stable across API response ordering.

- [ ] **Step 4: 运行投影测试确认边界行为通过**

Run: `node tests/questionKnowledgePathProjection.test.mjs`

Expected: PASS for path filtering, cycle breaking, duplicate removal, orphan retention and stable ordering.

- [ ] **Step 5: 提交投影边界行为**

```bash
git add src/components/knowledge/knowledgePathProjection.js tests/questionKnowledgePathProjection.test.mjs
git commit -m "feat: make knowledge path projection deterministic"
```

## Task 3: 改造 G6 渲染器为路径图

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraphRenderer.vue`
- Modify: `tests/questionKnowledgeGraphRenderer.test.mjs`

- [ ] **Step 1: 写失败的静态契约测试**

在渲染器测试中增加断言：

```js
assert.ok(renderer.includes("type: 'antv-dagre'"));
assert.ok(renderer.includes("rankdir: 'LR'"));
assert.ok(renderer.includes('fitView'));
assert.ok(renderer.includes('prerequisite'));
assert.ok(renderer.includes('labelPlacement'));
assert.ok(renderer.includes('path-highlight'));
assert.ok(renderer.includes('fit-canvas'));
assert.ok(!renderer.includes("type: 'radial'"));
```

- [ ] **Step 2: 运行渲染器测试确认旧实现不满足新契约**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: FAIL on the new Dagre, `fitView`, path-state and toolbar assertions.

- [ ] **Step 3: 更新渲染器输入和 G6 配置**

在 `KnowledgeGraphRenderer.vue` 中：

1. 导入 `projectKnowledgePathGraph`，对 `props.graphData` 做路径投影。
2. 删除 radial `focusNode`、`unitRadius`、`strictRadial`、`nodeSpacing` 和 `sortStrength` 配置。
3. 使用：

```js
layout: {
  type: 'antv-dagre',
  rankdir: 'LR',
  ranker: 'network-simplex',
  nodesep: 64,
  ranksep: 150,
  controlPoints: true,
  nodeOrder: projected.nodes.map((node) => node.id)
}
```

4. 将节点类型改为 `rect`，节点宽度按标签长度在 `128px` 到 `190px` 之间限制，高度固定为 `54px`；关联题目数量放入节点数据并以小号副标签渲染。
5. 将路径边类型设为 `polyline` 或 G6 当前可用的折线边，按 `prerequisite`、`derivation`、`application` 返回稳定的颜色、箭头和线宽；不再渲染非路径边。
6. 使用 `graph.fitView({ animation: false, padding: 56 })`，并在 `ResizeObserver` 中先 `resize` 再 `fitView`，保证图谱不缩成中央小团。

- [ ] **Step 4: 实现节点选中、搜索命中和上下游路径弱化**

新增 `nodeState`/`edgeState` 样式函数：

- 当前节点使用深色边框和浅色高亮背景。
- 与当前节点存在有向路径相邻关系的节点和边使用正常不透明度。
- 无关节点和边设置低透明度，但不改变布局和位置。
- 搜索命中节点使用强调描边；搜索无命中时不改变图谱。
- 点击节点只调用 `graph.draw()` 或状态刷新，不销毁重建图实例。

节点拖动结束继续发出 `{ id, x, y }`，并保留已固定位置作为 `style.x/style.y` 或 G6 preset 输入。把节点来源和锁定状态放到数据属性，不用 AI 返回的样式参数。

- [ ] **Step 5: 增加画布工具按钮和事件**

在渲染器模板增加三个图标按钮：

```html
<button type="button" class="graph-tool" title="适应画布" aria-label="适应画布" @click="fitCanvas">fit</button>
<button type="button" class="graph-tool" title="放大" aria-label="放大" @click="zoomIn">+</button>
<button type="button" class="graph-tool" title="缩小" aria-label="缩小" @click="zoomOut">−</button>
```

用 G6 `fitView`、`getZoom`/`zoomTo` 实现操作；画布双击空白区域调用 `fitCanvas`。工具栏按钮不与图例重叠，移动端缩短为图标按钮。

- [ ] **Step 6: 运行渲染器静态测试**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: PASS。

- [ ] **Step 7: 提交渲染器改造**

```bash
git add src/components/knowledge/KnowledgeGraphRenderer.vue tests/questionKnowledgeGraphRenderer.test.mjs
git commit -m "feat: render question knowledge graph as layered path"
```

## Task 4: 改造页面筛选与布局协调

**Files:**
- Modify: `src/pages/QuestionBankKnowledgeGraphPage.vue`
- Modify: `tests/questionBankKnowledgeGraphPage.test.mjs`

- [ ] **Step 1: 写失败的页面契约测试**

增加断言：

```js
assert.ok(page.includes('projectKnowledgePathGraph'));
assert.ok(page.includes('pathStats'));
assert.ok(page.includes('路径节点'));
assert.ok(page.includes('路径关系'));
assert.ok(page.includes('适应画布'));
assert.ok(!page.includes('relationFilter'));
assert.ok(!page.includes('neighborhoodDepth'));
```

- [ ] **Step 2: 运行页面契约测试确认旧筛选仍存在**

Run: `node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: FAIL on the new path projection and removed-filter assertions.

- [ ] **Step 3: 替换页面计算属性**

导入 `projectKnowledgePathGraph`，保留原始 `nodes`/`edges` 给详情和关系编辑，新增：

```js
const pathGraph = computed(() => projectKnowledgePathGraph(graphData.value || {}));
const filteredGraphData = computed(() => {
  const query = searchText.value.trim().toLowerCase();
  const visibleNodes = pathGraph.value.nodes.filter((node) => {
    const text = `${node.label} ${node.category} ${(node.aliases || []).join(' ')}`.toLowerCase();
    return (!query || text.includes(query))
      && (sourceFilter.value === 'all' || node.source === sourceFilter.value)
      && (categoryFilter.value === 'all' || node.category === categoryFilter.value);
  });
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  return {
    nodes: visibleNodes,
    edges: pathGraph.value.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
  };
});
```

删除 `relationFilter` 和 `neighborhoodDepth` 状态及计算逻辑；页面原始 `edges` 仍保留给详情面板和编辑 API。统计项使用 `pathGraph.stats.nodeCount`、`pathGraph.stats.edgeCount`，并额外显示 `orphanCount` 时不改变后端统计。

- [ ] **Step 4: 更新模板和工具栏**

删除关系类型和邻域两个 `select`，把标题改为“知识路径图”，统计标签改为“路径节点”和“路径关系”，增加渲染器的 `@fit-canvas` 或保留渲染器内部工具按钮。保留“重新布局”与“恢复自动布局”，并明确按钮文本：

- “重新布局”：只请求未固定节点重新计算或触发渲染器自动布局。
- “恢复自动布局”：沿用现有 API 将全部布局的 `pinned` 设为 `false`，再加载图谱。

详情组件同时传入原始 `edges`，以便非路径关系仍可见。

- [ ] **Step 5: 保持搜索选择稳定**

当筛选结果不包含当前节点时清空 `selectedNodeId` 和详情；当搜索只有一个命中节点时不要自动改变布局，只把命中节点交给渲染器高亮。重新加载图谱时不因解析轮询销毁已有图谱。

- [ ] **Step 6: 运行页面契约和已有图谱测试**

Run: `node tests/questionBankKnowledgeGraphPage.test.mjs && node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: PASS。

- [ ] **Step 7: 提交页面协调改造**

```bash
git add src/pages/QuestionBankKnowledgeGraphPage.vue tests/questionBankKnowledgeGraphPage.test.mjs
git commit -m "feat: coordinate question knowledge path page"
```

## Task 5: 优化详情面板，保留完整关系访问

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraphInspector.vue`

- [ ] **Step 1: 写详情结构契约测试**

在 `tests/questionKnowledgeGraphRenderer.test.mjs` 或新增 `tests/questionKnowledgeGraphInspector.test.mjs` 中断言：

```js
assert.ok(inspector.includes('前置知识'));
assert.ok(inspector.includes('后续路径'));
assert.ok(inspector.includes('辅助关系'));
assert.ok(inspector.includes("emit('select-relation'"));
```

- [ ] **Step 2: 实现详情数据计算**

在检查器中从 `node.relations` 按当前节点方向拆分：

- `prerequisite`、`derivation`、`application` 放入“路径关系”，按入边/出边分为前置知识和后续路径。
- `related`、`co_occurrence`、`confusable` 放入“辅助关系”。
- 找不到关联节点名称时显示关系中的 point id 的短格式，不显示空白卡片。

增加 `select-relation` 事件；点击关系卡片向页面发送完整 relation 对象，由页面设置 `selectedEdgeId`，但不要求关系出现在主画布。

- [ ] **Step 3: 保留人工关系编辑和节点操作**

不要删除现有保存节点、合并、隐藏、解除题目关联和关系编辑表单。创建关系时仍保留全部关系类型选项；新增路径关系后重新投影并自动分层，新增辅助关系后只更新详情数据。

- [ ] **Step 4: 运行相关测试**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs && node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交详情面板改造**

```bash
git add src/components/knowledge/KnowledgeGraphInspector.vue tests/questionKnowledgeGraphRenderer.test.mjs
git commit -m "feat: expose path and auxiliary graph relations"
```

## Task 6: 接入测试脚本并执行全量验证

**Files:**
- Modify: `package.json`
- Modify: `tests/questionKnowledgeGraphDomain.test.mjs` only if shared naming or imports need alignment; do not change domain behavior.

- [ ] **Step 1: 将路径投影测试加入知识图谱测试脚本**

在 `package.json` 的 `test:knowledge-graph` 中加入 `node tests/questionKnowledgePathProjection.test.mjs`，放在渲染器测试之前，确保纯函数先验证。

- [ ] **Step 2: 运行聚焦测试**

Run: `node tests/questionKnowledgePathProjection.test.mjs && node tests/questionKnowledgeGraphRenderer.test.mjs && node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: PASS。

- [ ] **Step 3: 运行完整知识图谱测试**

Run: `npm run test:knowledge-graph`

Expected: all listed schema, domain, AI extraction, DB, API, worker, editing, page, renderer and backfill tests PASS. If a pre-existing database-dependent test cannot connect, report the exact failure without changing unrelated infrastructure.

- [ ] **Step 4: 构建前端**

Run: `npm run build`

Expected: Vite exits with code 0 and produces `dist` without compile errors.

- [ ] **Step 5: 检查变更与提交**

Run: `git diff --check && git status --short --branch`

Expected: no whitespace errors; only intended path graph files are changed. Commit any remaining implementation changes as:

```bash
git add package.json src/components/knowledge/knowledgePathProjection.js src/components/knowledge/KnowledgeGraphRenderer.vue src/components/knowledge/KnowledgeGraphInspector.vue src/pages/QuestionBankKnowledgeGraphPage.vue tests/questionKnowledgePathProjection.test.mjs tests/questionKnowledgeGraphRenderer.test.mjs tests/questionBankKnowledgeGraphPage.test.mjs
git commit -m "feat: beautify question knowledge graph path view"
```

## Task 7: 浏览器验收与交付准备

**Files:**
- No source changes unless a browser-found defect is reproduced and covered by a focused test.

- [ ] **Step 1: 启动本地前端和 API 服务**

Run in separate terminals: `npm run dev` and `npm run dev:server`.

Expected: Vite and API services start without errors; use the printed local URL and the existing question-bank route.

- [ ] **Step 2: 验证路径图首屏**

Open `/question-banks/newton-laws-bank/knowledge-graph` and confirm the graph reads left-to-right, nodes are rectangular and legible, lines do not form the previous dense center knot, and the canvas fills its card.

- [ ] **Step 3: 验证交互与持久化**

Click a node and confirm upstream/downstream path emphasis plus inspector details; search a node and confirm highlight without layout rebuild; drag a node, wait for the debounced save, refresh and confirm its position remains; click “恢复自动布局” and confirm pinned positions are cleared.

- [ ] **Step 4: 验证非路径关系可访问**

Select a node with `co_occurrence`, `related` or `confusable` relations and confirm they appear in “辅助关系” and can still open the existing relation edit actions.

- [ ] **Step 5: 验证空态和响应式**

Check parsing-in-progress, no-path relation, load-error and narrow viewport states. Confirm the page scrolls naturally when the inspector stacks and no controls or lower relation cards are clipped.

- [ ] **Step 6: 完成交付前复核**

Run `git status --short --branch` and `git log -5 --oneline`; report implementation commits, test/build results, and any browser limitations. Do not push or deploy in this plan unless separately requested.
