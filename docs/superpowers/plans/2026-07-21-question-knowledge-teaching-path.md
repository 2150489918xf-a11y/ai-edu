# 题库知识图谱教学路径分层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将题库知识图谱主画布改造成固定四阶段教学路径图，默认隐藏跨层噪声关系，选中节点后按需展开。

**Architecture:** 新增纯函数 `teachingPathProjection.js`，在现有无环路径投影之上计算四阶段、稳定顺序、固定坐标和默认关系可见性。`KnowledgeGraphRenderer.vue` 只负责把投影结果渲染为 G6 固定坐标图，并用四个低层级背景节点展示阶段区域。页面移除坐标持久化交互，保留查询、节点编辑、重新分层和适应画布。

**Tech Stack:** Vue 3、AntV G6 5.1.1、Node.js 原生断言测试、Vite。

---

### Task 1: 建立四阶段教学投影

**Files:**
- Create: `src/components/knowledge/teachingPathProjection.js`
- Create: `tests/questionKnowledgeTeachingPath.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试**

测试导入 `projectTeachingPathGraph` 和 `TEACHING_STAGES`，断言：

```js
assert.deepEqual(TEACHING_STAGES.map((stage) => stage.label), [
  '基础概念', '核心规律', '解题方法', '综合应用'
]);

const teaching = projectTeachingPathGraph(source);
assert.deepEqual(teaching.nodes.map((node) => node.stageIndex), [0, 1, 2, 3]);
assert.ok(teaching.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
assert.equal(teaching.edges.find((edge) => edge.id === 'adjacent').defaultVisible, true);
assert.equal(teaching.edges.find((edge) => edge.id === 'cross-stage').defaultVisible, false);
assert.equal(teaching.stageLanes.length, 4);
```

增加五层以上归并、三层映射、孤立节点进入阶段 0、阶段内稳定排序和同一输入多次输出一致的断言。

- [ ] **Step 2: 运行测试确认失败**

Run: `node tests/questionKnowledgeTeachingPath.test.mjs`

Expected: FAIL，提示模块不存在。

- [ ] **Step 3: 实现纯函数**

模块导出：

```js
export const TEACHING_STAGES = [
  { index: 0, key: 'foundation', label: '基础概念' },
  { index: 1, key: 'principle', label: '核心规律' },
  { index: 2, key: 'method', label: '解题方法' },
  { index: 3, key: 'application', label: '综合应用' }
];

export function projectTeachingPathGraph(source = {}) {
  const path = projectKnowledgePathGraph(source);
  // 计算 stageIndex、稳定排序、固定 x/y、stageLanes 和 edge.defaultVisible。
  return { nodes, edges, stageLanes, stats: path.stats, layout };
}
```

坐标常量使用阶段中心间距 `240`、节点垂直间距 `78`、顶部留白 `112`；画布高度至少 `520`，并随最大列节点数增长。

- [ ] **Step 4: 运行测试确认通过**

Run: `node tests/questionKnowledgeTeachingPath.test.mjs`

Expected: PASS，输出 `question knowledge teaching path tests passed`。

- [ ] **Step 5: 加入测试脚本**

在 `test:knowledge-graph` 中把新测试放在 `questionKnowledgePathProjection.test.mjs` 之后。

- [ ] **Step 6: 提交**

```bash
git add src/components/knowledge/teachingPathProjection.js tests/questionKnowledgeTeachingPath.test.mjs package.json
git commit -m "feat: project knowledge graph into teaching stages"
```

### Task 2: 将 G6 渲染器改为固定四列

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraphRenderer.vue`
- Modify: `tests/questionKnowledgeGraphRenderer.test.mjs`

- [ ] **Step 1: 写失败的渲染器契约**

断言渲染器：

```js
assert.ok(renderer.includes('projectTeachingPathGraph'));
assert.ok(renderer.includes('stageLanes'));
assert.ok(renderer.includes("type: 'cubic-horizontal'"));
assert.ok(renderer.includes("visibility: visible ? 'visible' : 'hidden'"));
assert.ok(renderer.includes('isStageLane'));
assert.ok(!renderer.includes("type: 'antv-dagre'"));
assert.ok(!renderer.includes("'drag-element'"));
assert.ok(!renderer.includes("emit('layout-change'"));
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: FAIL，提示缺少教学路径投影。

- [ ] **Step 3: 改造数据映射**

用 `projectTeachingPathGraph` 替换 `projectKnowledgePathGraph`。把 `stageLanes` 作为 `isStageLane: true` 的大型矩形背景节点放在真实节点之前，真实节点从投影读取 `x`、`y`、`stageIndex`。

- [ ] **Step 4: 改造节点和关系样式**

- 阶段背景节点使用低透明填充、虚线边框、标题标签和负 `zIndex`。
- 普通知识点继续使用现有分类色和题目数量标签。
- 关系类型改为 `cubic-horizontal`。
- `visible = edge.defaultVisible || isEdgeActive(datum)`；非可见关系设置 `visibility: 'hidden'`。
- 选中跨层关系使用低透明虚线；相邻阶段主关系保持实线。

- [ ] **Step 5: 移除自由拖动**

行为只保留 `drag-canvas` 和 `zoom-canvas`，删除 `node:dragend` 和 `layout-change` emit。

- [ ] **Step 6: 运行测试确认通过**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/components/knowledge/KnowledgeGraphRenderer.vue tests/questionKnowledgeGraphRenderer.test.mjs
git commit -m "feat: render knowledge graph as teaching lanes"
```

### Task 3: 简化页面布局操作

**Files:**
- Modify: `src/pages/QuestionBankKnowledgeGraphPage.vue`
- Modify: `tests/questionBankKnowledgeGraphPage.test.mjs`

- [ ] **Step 1: 写失败的页面契约**

增加断言：

```js
assert.ok(page.includes('重新分层'));
assert.ok(!page.includes('saveQuestionBankKnowledgeGraphLayout'));
assert.ok(!page.includes('queueLayoutChange'));
assert.ok(!page.includes('@layout-change'));
assert.ok(!page.includes('恢复自动布局'));
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: FAIL，页面仍包含坐标持久化逻辑。

- [ ] **Step 3: 删除坐标保存逻辑**

移除 `saveQuestionBankKnowledgeGraphLayout` 导入、`layoutTimer`、`pendingLayouts`、`queueLayoutChange`、`flushLayout` 和 `resetLayout`。卸载时不再处理布局定时器。

- [ ] **Step 4: 调整工具栏**

将“重新布局”改为“重新分层”，保留 `layoutKey` 触发渲染器重建；删除“恢复自动布局”按钮和 `@layout-change` 监听。

- [ ] **Step 5: 运行测试确认通过**

Run: `node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/pages/QuestionBankKnowledgeGraphPage.vue tests/questionBankKnowledgeGraphPage.test.mjs
git commit -m "refactor: simplify teaching path layout controls"
```

### Task 4: 验证、合并与推送

**Files:**
- Verify: `src/components/knowledge/teachingPathProjection.js`
- Verify: `src/components/knowledge/KnowledgeGraphRenderer.vue`
- Verify: `src/pages/QuestionBankKnowledgeGraphPage.vue`

- [ ] **Step 1: 运行相关测试**

```bash
node tests/questionKnowledgePathProjection.test.mjs
node tests/questionKnowledgeTeachingPath.test.mjs
node tests/questionKnowledgeGraphRenderer.test.mjs
node tests/questionBankKnowledgeGraphPage.test.mjs
```

Expected: 四组测试全部通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite 构建成功；允许项目已有的大 chunk warning。

- [ ] **Step 3: 浏览器验收**

使用当前牛顿定律题库检查四阶段背景、默认关系数量、节点选择后的跨层关系、右侧详情、桌面和平板宽度及控制台错误。

- [ ] **Step 4: 合并并复验**

把实现分支合并到 `main`，在 `main` 上重新运行 Task 4 Step 1 和 Step 2。

- [ ] **Step 5: 推送**

执行 `git push origin main`；如果本机 `127.0.0.1:7897` 代理未运行，使用单次 `git -c http.proxy= -c https.proxy= push origin main`，不修改全局 Git 配置。
