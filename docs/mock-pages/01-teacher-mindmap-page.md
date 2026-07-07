# 老师备课思维导图页面开发文档

## 页面定位

在老师课前备课工作台中展示“AI 从教学资料中提取知识点，并生成思维导图”的效果。该功能用于支撑老师备课、知识点梳理、后续题库绑定和智能组卷。

## 推荐入口

优先在现有页面中增强：

- 修改：`src/pages/WorkspacePage.vue`

推荐在工作台左侧步骤栏增加一个入口：

```text
生成 / 思维导图 / PPT / 教案 / 题析
```

也可以在主内容区增加一个 Tab：

```text
课程大纲 | 思维导图 | 资料解析
```

## 用户流程

```text
老师进入备课工作台
-> 上传或选择《二次函数教学资料》
-> 点击“生成思维导图”
-> 页面显示 AI 任务进度
-> 展示二次函数思维导图
-> 点击节点
-> 右侧展示节点说明、教学建议、关联题目
```

## 页面结构

建议布局：

```text
顶部：课程名称、学科、年级、生成状态
左侧：资料解析进度与知识点列表
中间：思维导图画布
右侧：当前选中节点详情
底部：可继续生成 PPT、生成题目、进入知识图谱
```

## Mock 数据

新增到 `src/data/teachingMockData.js`：

```js
export const quadraticMindMap = {
  id: 'mindmap-quadratic',
  title: '二次函数',
  source: '二次函数教学资料.pdf',
  generatedAt: '刚刚',
  nodes: [
    { id: 'root', label: '二次函数', level: 0, x: 420, y: 260 },
    { id: 'concept', label: '基本概念', level: 1, x: 180, y: 120 },
    { id: 'forms', label: '表达式形式', level: 1, x: 180, y: 260 },
    { id: 'graph', label: '图像性质', level: 1, x: 180, y: 400 },
    { id: 'axis', label: '对称轴', level: 2, x: 640, y: 140 },
    { id: 'vertex', label: '顶点坐标', level: 2, x: 660, y: 260 },
    { id: 'mistakes', label: '常见错因', level: 1, x: 650, y: 420 }
  ],
  edges: [
    ['root', 'concept'],
    ['root', 'forms'],
    ['root', 'graph'],
    ['graph', 'axis'],
    ['graph', 'vertex'],
    ['root', 'mistakes']
  ],
  details: {
    axis: {
      title: '对称轴',
      formula: 'x = -b / 2a',
      teachingAdvice: '强调公式中的负号，结合配方法解释来源。',
      relatedQuestions: ['q-axis-001', 'q-axis-002']
    }
  }
};
```

## 伪接口

新增到 `src/data/mockApi.js`：

```js
import { quadraticMindMap } from './teachingMockData';

function delay(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function generateMindMap(courseId) {
  await delay(1200);
  return {
    courseId,
    steps: ['资料解析完成', '知识点提取完成', '思维导图生成完成'],
    mindMap: quadraticMindMap
  };
}
```

## 组件拆分

建议新增：

- `src/components/mindmap/MindMapCanvas.vue`
- `src/components/mindmap/MindMapNodeDetail.vue`
- `src/components/mindmap/MindMapGenerationPanel.vue`

职责：

- `MindMapCanvas.vue`：只负责节点、连线、点击选中。
- `MindMapNodeDetail.vue`：展示节点说明、公式、教学建议、关联题目。
- `MindMapGenerationPanel.vue`：展示 AI 生成进度和资料解析状态。

## 交互状态

需要支持：

- 未生成：展示空状态和“生成思维导图”按钮。
- 生成中：展示三步进度。
- 已生成：展示图谱。
- 点击节点：右侧详情切换。
- 点击“生成题目”：跳转到题库生成页。
- 点击“进入知识图谱”：跳转题库详情页的知识图谱 Tab。

## 视觉要求

- 不做复杂拖拽，固定节点位置即可。
- 节点使用不同颜色区分层级。
- 连线使用 SVG。
- 选中节点高亮。
- 页面不要只是一张静态图片，要能点击节点并改变右侧内容。

## 验收标准

- 点击“生成思维导图”后有 1 秒以上加载过程。
- 生成后出现中心节点“二次函数”和至少 6 个分支节点。
- 点击“对称轴”节点，右侧显示公式 `x = -b / 2a`。
- 右侧能看到“教学建议”和“关联题目”。
- 页面刷新不报错。

