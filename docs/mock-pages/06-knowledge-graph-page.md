# 题库动态知识图谱页面开发文档

## 页面定位

在题库中展示“从资料中提取知识点，并构建题目知识图谱”的效果。该功能用于证明题库不是简单题目列表，而是围绕知识点、题目、错因、学情统计形成结构化关系。

## 推荐入口

增强现有页面：

- 修改：`src/pages/QuestionBankDetailPage.vue`

建议在题库详情页增加 Tab：

```text
题目列表 | 知识图谱 | 智能组卷
```

## 用户流程

```text
老师进入题库详情
-> 切换到“知识图谱”
-> 页面显示 AI 提取知识点进度
-> 展示二次函数知识图谱
-> 点击“对称轴”
-> 右侧展示关联题目、班级掌握度、常见错因
-> 点击关联题目可进入题目详情
```

## 页面结构

```text
左侧：资料来源与知识点提取列表
中间：知识图谱可视化
右侧：节点详情、关联题目、学情统计
```

## 图谱节点类型

建议节点分三类：

- 知识点节点：二次函数、对称轴、顶点坐标、配方法。
- 题目节点：题目编号、题型、难度。
- 错因节点：负号错误、配方错误、概念混淆。

## Mock 数据

新增到 `src/data/teachingMockData.js`：

```js
export const quadraticKnowledgeGraph = {
  id: 'graph-quadratic',
  source: '二次函数教学资料.pdf',
  nodes: [
    { id: 'kp-root', type: 'knowledge', label: '二次函数', x: 420, y: 260, size: 'large' },
    { id: 'kp-axis', type: 'knowledge', label: '对称轴', x: 230, y: 140, mastery: 56 },
    { id: 'kp-vertex', type: 'knowledge', label: '顶点坐标', x: 230, y: 380, mastery: 61 },
    { id: 'kp-graph', type: 'knowledge', label: '图像性质', x: 610, y: 140, mastery: 73 },
    { id: 'kp-square', type: 'knowledge', label: '配方法', x: 610, y: 380, mastery: 64 },
    { id: 'q-axis-001', type: 'question', label: 'Q1 对称轴基础题', x: 80, y: 120, difficulty: '基础' },
    { id: 'q-vertex-001', type: 'question', label: 'Q2 顶点坐标题', x: 80, y: 400, difficulty: '中等' },
    { id: 'err-sign', type: 'mistake', label: '负号错误', x: 420, y: 70 },
    { id: 'err-square', type: 'mistake', label: '配方漏项', x: 420, y: 470 }
  ],
  edges: [
    ['kp-root', 'kp-axis', '包含'],
    ['kp-root', 'kp-vertex', '包含'],
    ['kp-root', 'kp-graph', '包含'],
    ['kp-root', 'kp-square', '包含'],
    ['kp-axis', 'q-axis-001', '关联题目'],
    ['kp-vertex', 'q-vertex-001', '关联题目'],
    ['kp-axis', 'err-sign', '常见错因'],
    ['kp-square', 'err-square', '常见错因']
  ],
  details: {
    'kp-axis': {
      title: '对称轴',
      description: '二次函数图像的对称中心线，一般式下公式为 x = -b / 2a。',
      mastery: 56,
      relatedQuestions: ['q-axis-001', 'q-axis-002'],
      commonMistakes: ['负号错误', '把 b 的值取反失败'],
      teachingAdvice: '先让学生识别 a、b，再代入公式，最后用配方法验证。'
    }
  }
};
```

## 伪接口

新增到 `src/data/mockApi.js`：

```js
import { quadraticKnowledgeGraph } from './teachingMockData';

function delay(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function getKnowledgeGraph(bankId) {
  await delay(900);
  return {
    bankId,
    graph: quadraticKnowledgeGraph
  };
}

export async function extractKnowledgePointsFromMaterial(materialId) {
  await delay(1100);
  return {
    materialId,
    knowledgePoints: quadraticKnowledgeGraph.nodes.filter((node) => node.type === 'knowledge')
  };
}
```

## 组件拆分

建议新增：

- `src/components/knowledge/KnowledgeGraphCanvas.vue`
- `src/components/knowledge/KnowledgeNodeDetail.vue`
- `src/components/knowledge/KnowledgeExtractionPanel.vue`

职责：

- `KnowledgeGraphCanvas.vue`：SVG 绘制节点和边，支持点击节点。
- `KnowledgeNodeDetail.vue`：展示选中节点详情、关联题目、错因和学情数据。
- `KnowledgeExtractionPanel.vue`：展示资料来源和提取出的知识点列表。

## 交互状态

需要支持：

- 进入 Tab 后加载图谱。
- 点击节点高亮。
- 右侧详情随节点变化。
- 点击关联题目跳转题目详情。
- 点击“按该知识点组卷”跳转智能组卷页并预填知识点。

## 视觉要求

- 不需要真实力导向布局，固定坐标即可。
- 用颜色区分节点类型：
  - 知识点：绿色。
  - 题目：蓝色或白色卡片。
  - 错因：橙色。
- 边上显示关系标签，如“包含”“关联题目”“常见错因”。

## 验收标准

- 题库详情页能切换到“知识图谱”。
- 图谱至少展示 8 个节点和 6 条边。
- 点击“对称轴”节点后，右侧显示掌握度 56%、关联题目和常见错因。
- 点击关联题目能跳转到题目详情。
- 页面无需真实后端即可完成展示。

