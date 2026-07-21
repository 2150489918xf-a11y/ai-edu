# 题库知识路径图紧凑布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收紧题库知识路径图的节点、层级和画布留白，使相同数据在首屏中更集中且保持可读。

**Architecture:** 保留现有路径投影、G6 渲染和持久化边界，只修改 `KnowledgeGraphRenderer.vue` 的纯布局常量及 Dagre 参数。通过现有静态契约测试锁定紧凑参数，再使用浏览器截图验证视觉效果。

**Tech Stack:** Vue 3、AntV G6 5.1.1、Node.js 原生断言测试、Vite。

---

### Task 1: 锁定紧凑布局契约

**Files:**
- Modify: `tests/questionKnowledgeGraphRenderer.test.mjs`

- [ ] **Step 1: 写失败测试**

增加以下断言，要求渲染器使用紧凑布局常量：

```js
assert.ok(renderer.includes('const COMPACT_LAYOUT'));
assert.ok(renderer.includes('nodesep: COMPACT_LAYOUT.nodeGap'));
assert.ok(renderer.includes('ranksep: COMPACT_LAYOUT.rankGap'));
assert.ok(renderer.includes('padding: COMPACT_LAYOUT.fitPadding'));
assert.ok(renderer.includes('minNodeWidth: 116'));
assert.ok(renderer.includes('maxNodeWidth: 172'));
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: FAIL，提示缺少 `COMPACT_LAYOUT`。

- [ ] **Step 3: 提交测试和实现时统一提交**

本任务不单独提交，避免主分支留下必然失败的中间提交。

### Task 2: 实现紧凑 Dagre 参数

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraphRenderer.vue`
- Test: `tests/questionKnowledgeGraphRenderer.test.mjs`

- [ ] **Step 1: 增加布局常量**

```js
const COMPACT_LAYOUT = {
  minNodeWidth: 116,
  maxNodeWidth: 172,
  nodeGap: 28,
  rankGap: 88,
  fitPadding: 28,
  edgeRadius: 7
};
```

- [ ] **Step 2: 将节点宽度、适应画布和 Dagre 参数改为常量**

`nodeWidth()` 使用 `minNodeWidth` 与 `maxNodeWidth`；`fitCanvas()` 使用 `fitPadding`；布局使用 `nodeGap` 与 `rankGap`；折线圆角使用 `edgeRadius`。

- [ ] **Step 3: 运行回归测试**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: PASS，输出 `question knowledge graph renderer contracts passed`。

- [ ] **Step 4: 提交代码**

```bash
git add src/components/knowledge/KnowledgeGraphRenderer.vue tests/questionKnowledgeGraphRenderer.test.mjs
git commit -m "style: compact question knowledge path layout"
```

### Task 3: 验证视觉和构建

**Files:**
- Verify: `src/components/knowledge/KnowledgeGraphRenderer.vue`

- [ ] **Step 1: 运行相关测试**

```bash
node tests/questionKnowledgePathProjection.test.mjs
node tests/questionKnowledgeGraphRenderer.test.mjs
node tests/questionBankKnowledgeGraphPage.test.mjs
```

Expected: 三组测试全部通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite 构建成功；允许保留项目已有的大 chunk warning。

- [ ] **Step 3: 浏览器视觉验收**

打开当前题库知识路径图，检查节点占用范围较旧截图明显收紧、文字无重叠、长边不穿过节点，并检查 1280px 桌面和窄屏堆叠状态。

- [ ] **Step 4: 推送主分支**

先合并实现分支，再执行 `git push origin main`；若本机 GitHub 网络或代理不可用，保留本地提交并报告准确的 ahead 状态。
