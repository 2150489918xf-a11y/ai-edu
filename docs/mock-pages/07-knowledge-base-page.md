# 知识库管理页面开发文档

## 页面定位

知识库是所有教学资料的上游资源池。老师可以把教材 PDF、课标、历史教案、PPT、学生错题样本、课堂报告等资料上传到知识库，系统对资料进行解析、切片、知识点抽取和 evidence 建模。后续课程备课时，老师从知识库引用资料，再基于这些资料生成思维导图、课程大纲、PPT、题目和试卷。

本页面设计参考：

- 视觉结构参考：`E:\桌面\技术原理\wireframes\wireframes\knowledge-base-wireframe.html`
- 功能链路参考：`E:\桌面\技术原理\vespa-agentic-teaching-rag.md`

## 产品关系

知识库和题库要分清边界：

```text
知识库：教材、课标、教案、PPT、学情报告、错题样本、老师备注
题库：题目、答案、解析、知识点绑定、试卷
```

知识库负责“内容依据”和“教学证据”，题库负责“练习测评”。

## 推荐入口

新增一级导航入口：

```text
工作台 / 课前 / 知识库 / 题库 / 课中 / 学情分析
```

需要修改：

- `src/App.vue`：主导航增加“知识库”入口。
- `src/router.js`：新增 `/knowledge-base` 路由。
- 新增 `src/pages/KnowledgeBasePage.vue`。

## 页面结构

参考 wireframe 的三栏结构，但视觉样式必须使用当前项目现有设计体系。

```text
顶部：页面标题、说明、批量导入、上传资料
左侧：分类目录、学科筛选、容量使用
中间：资料列表、搜索、类型 Tab、状态筛选
右侧：资料详情、解析结果、知识点、引用动作
```

对应到当前项目风格：

- 外层使用 `.module-page`。
- 顶部使用 `.module-head` + `.hero-actions`。
- 左/中/右区域使用 `.surface-card`。
- 搜索框复用 `.module-search`。
- 类型筛选复用 `.segmented`。
- 操作按钮复用 `.soft-btn`、`.primary-btn`。
- 标签复用 `.small-chip`、`.card-meta span`。

## 页面布局

桌面端建议：

```text
grid-template-columns: 260px minmax(0, 1fr) 340px;
```

1280 宽以下：

```text
grid-template-columns: 220px minmax(0, 1fr);
右侧详情下移到第二行或改为抽屉
```

移动端不作为本次演示重点，但不能出现横向滚动和文本重叠。

## 核心用户流程

### 流程 1：上传资料入库

```text
点击“上传资料”
-> 弹出上传模拟面板
-> 选择“二次函数图像与性质教材节选.pdf”
-> 状态显示“上传成功”
-> 状态变成“解析中”
-> 1 秒后变成“已解析”
-> 显示提取知识点数量、切片数量、可引用状态
```

### 流程 2：查看资料解析结果

```text
点击资料列表中的一条资料
-> 右侧详情面板显示基本信息
-> 显示提取知识点
-> 显示 evidence 类型
-> 显示可用于生成的任务
```

### 流程 3：引用资料到课程

```text
选中资料
-> 点击“引用到课程”
-> 选择“二次函数图像与性质”
-> 课程工作台出现已引用资料
-> 课程可基于这些资料生成思维导图和 PPT
```

### 流程 4：用于 AI 生成

```text
选中资料
-> 点击“用于 AI 生成课件”
-> 跳转课程工作台或 PPT 生成页
-> 页面显示 evidence pack 已准备
```

## RAG 功能映射

参考 `vespa-agentic-teaching-rag.md`，本页面前端需要把复杂 RAG 概念转成可演示的 UI。

### Evidence 类型

页面上展示资料入库后会形成不同 evidence：

```text
material_chunk      教材/上传资料片段
ppt_slide           历史 PPT 页面
question_item       题库题目
student_response    学生作答记录
question_stat       题目统计
weak_point          薄弱知识点
wrong_reason        错因聚类
learning_report     学情报告
teacher_note        老师备注
```

本页面 MVP 重点展示：

- `material_chunk`
- `ppt_slide`
- `learning_report`
- `teacher_note`

其他 evidence 类型可以作为右侧“证据类型覆盖”统计展示，不做复杂列表。

### 检索与排序展示

不做真实 Vespa 检索，但要在页面上模拟“混合检索与教学加权排序”的感觉。

右侧详情或资料列表中展示：

```text
检索命中方式：关键词 + 语义向量 + 知识点匹配
教学权重：近期课程、老师标记、薄弱点相关度
可生成 Evidence Pack：是
```

资料详情中可以展示一个排序说明：

```text
综合评分 = 语义相关度 + 关键词命中 + 知识点匹配 + 教学任务权重
```

## Mock 数据设计

新增到 `src/data/teachingMockData.js`：

```js
export const knowledgeBaseCategories = [
  { id: 'all', name: '全部资料', count: 24 },
  { id: 'math-g10', name: '高一数学', count: 9 },
  { id: 'physics-g10', name: '高一物理', count: 6 },
  { id: 'teaching-reference', name: '教学参考', count: 5 },
  { id: 'learning-report', name: '学情报告', count: 4 }
];

export const knowledgeMaterials = [
  {
    id: 'mat-quadratic-textbook',
    title: '二次函数图像与性质教材节选',
    type: 'PDF',
    subject: '数学',
    grade: '高一',
    categoryId: 'math-g10',
    size: '2.8 MB',
    pages: 18,
    uploadedAt: '今天 09:24',
    status: 'parsed',
    parseLabel: '已解析',
    source: '教材资料',
    chunks: 36,
    evidenceCount: 42,
    vectorIndexed: true,
    bm25Indexed: true,
    teacherPinned: true,
    usedByCourses: ['二次函数图像与性质'],
    tags: ['二次函数', '图像性质', '对称轴', '顶点坐标'],
    knowledgePoints: [
      { id: 'kp-quadratic-basic', name: '二次函数一般式' },
      { id: 'kp-axis', name: '对称轴' },
      { id: 'kp-vertex', name: '顶点坐标' },
      { id: 'kp-graph', name: '图像性质' },
      { id: 'kp-square', name: '配方法' }
    ],
    retrievalSummary: {
      bm25: 0.84,
      vector: 0.91,
      knowledgeMatch: 0.96,
      teachingWeight: 0.88
    },
    availableActions: ['生成思维导图', '生成课程大纲', '生成 PPT', '生成题目']
  },
  {
    id: 'mat-quadratic-mistakes',
    title: '高一二次函数错题样本与错因分析',
    type: 'DOC',
    subject: '数学',
    grade: '高一',
    categoryId: 'learning-report',
    size: '860 KB',
    pages: 7,
    uploadedAt: '昨天 16:10',
    status: 'parsed',
    parseLabel: '已解析',
    source: '学情报告',
    chunks: 18,
    evidenceCount: 25,
    vectorIndexed: true,
    bm25Indexed: true,
    teacherPinned: false,
    usedByCourses: ['二次函数图像与性质'],
    tags: ['错因分析', '对称轴', '配方法'],
    knowledgePoints: [
      { id: 'kp-axis', name: '对称轴' },
      { id: 'kp-square', name: '配方法' }
    ],
    retrievalSummary: {
      bm25: 0.72,
      vector: 0.86,
      knowledgeMatch: 0.91,
      teachingWeight: 0.94
    },
    availableActions: ['生成补救题', '生成学情复盘', '生成讲解页']
  },
  {
    id: 'mat-new-upload',
    title: '二次函数单元教学设计初稿',
    type: 'PPT',
    subject: '数学',
    grade: '高一',
    categoryId: 'teaching-reference',
    size: '6.4 MB',
    pages: 24,
    uploadedAt: '刚刚',
    status: 'parsing',
    parseLabel: '解析中',
    source: '老师上传',
    chunks: 0,
    evidenceCount: 0,
    vectorIndexed: false,
    bm25Indexed: false,
    teacherPinned: false,
    usedByCourses: [],
    tags: ['待解析'],
    knowledgePoints: [],
    retrievalSummary: null,
    availableActions: []
  }
];
```

## 伪接口设计

新增到 `src/data/mockApi.js`：

```js
import { knowledgeBaseCategories, knowledgeMaterials } from './teachingMockData';

function delay(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function getKnowledgeBaseMaterials(filters = {}) {
  await delay(600);
  return {
    categories: knowledgeBaseCategories,
    materials: knowledgeMaterials.filter((item) => {
      if (filters.categoryId && filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) return false;
      if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
      return true;
    })
  };
}

export async function uploadKnowledgeMaterial(fileMeta) {
  await delay(800);
  return {
    id: 'mat-new-upload',
    title: fileMeta?.name || '二次函数单元教学设计初稿',
    status: 'parsing',
    parseLabel: '解析中'
  };
}

export async function parseKnowledgeMaterial(materialId) {
  await delay(1200);
  return {
    materialId,
    status: 'parsed',
    parseLabel: '已解析',
    chunks: 28,
    evidenceCount: 34,
    knowledgePoints: ['二次函数一般式', '对称轴', '顶点坐标', '配方法']
  };
}

export async function bindMaterialsToCourse(payload) {
  await delay(700);
  return {
    courseId: payload.courseId,
    materialIds: payload.materialIds,
    evidencePackReady: true,
    message: '资料已引用到课程，可用于生成思维导图和课件'
  };
}

export async function buildEvidencePack(payload) {
  await delay(1000);
  return {
    taskType: payload.taskType,
    materialIds: payload.materialIds,
    evidenceIds: ['ev-material-001', 'ev-material-002', 'ev-report-001'],
    coverage: 92,
    retrievalProfile: payload.taskType === 'ppt'
      ? 'ppt_generate_from_materials'
      : 'mindmap_generate_from_materials'
  };
}
```

## 页面交互状态

### 分类状态

左侧分类支持：

- 全部资料
- 高一数学
- 高一物理
- 教学参考
- 学情报告

点击分类后，中间列表筛选。

### 文件类型状态

中间 Tab 支持：

- 全部
- PDF
- PPT
- DOC
- 报告

### 解析状态

资料状态包括：

```text
未解析
解析中
已解析
解析失败
```

Mock 演示中至少包含：

- 已解析
- 解析中

### 详情选中状态

点击资料行后，右侧详情切换到对应资料。

## 右侧详情面板内容

右侧详情面板必须包含：

- 文件类型图标。
- 文件标题。
- 更新时间。
- 文件大小、页数、来源。
- 解析状态。
- 切片数量。
- Evidence 数量。
- BM25 索引状态。
- 向量索引状态。
- 提取知识点。
- 被引用课程。
- 可执行动作。

可执行动作：

```text
引用到课程
用于生成思维导图
用于生成课程大纲
用于生成 PPT
用于生成题目
下载原文件
```

## 与课程详情页的连接

课程详情页后续要从“上传资料”升级为：

```text
资料来源
[从知识库选择] [上传新资料]
```

引用资料后，课程工作台显示：

```text
已引用知识库资料：
- 二次函数图像与性质教材节选
- 高一二次函数错题样本与错因分析
```

然后生成顺序为：

```text
引用知识库资料
-> 构建 evidence pack
-> 生成思维导图
-> 生成课程大纲
-> 生成 PPT / 题目
```

## 与思维导图页面的连接

思维导图生成按钮应引用知识库资料：

```text
未引用资料：可以基于课程主题生成基础导图
已引用资料：基于知识库 evidence pack 生成增强导图
```

在思维导图页面显示来源：

```text
生成依据：
教材资料 2 份
学情报告 1 份
老师标记重点 3 条
```

## 与 RAG 技术文档的对应话术

答辩或演示时可以这样解释：

```text
知识库不是普通文件夹。资料上传后会被解析成教学 evidence，
包括教材片段、历史 PPT 页面、学情报告、错因分析和老师备注。
当老师生成思维导图、PPT 或题目时，Agent 会根据任务类型构建检索计划，
从知识库中召回最相关、最有教学价值的 evidence pack，
再作为生成依据。
```

## 组件拆分

建议新增：

- `src/pages/KnowledgeBasePage.vue`
- `src/components/knowledge-base/KnowledgeCategoryPanel.vue`
- `src/components/knowledge-base/KnowledgeMaterialTable.vue`
- `src/components/knowledge-base/KnowledgeMaterialDetail.vue`
- `src/components/knowledge-base/KnowledgeUploadDialog.vue`
- `src/components/knowledge-base/EvidencePackPanel.vue`

职责：

- `KnowledgeBasePage.vue`：页面状态、筛选、选中资料、调用 mockApi。
- `KnowledgeCategoryPanel.vue`：左侧分类、容量。
- `KnowledgeMaterialTable.vue`：中间列表、搜索、类型筛选。
- `KnowledgeMaterialDetail.vue`：右侧详情、知识点、索引状态、动作。
- `KnowledgeUploadDialog.vue`：上传资料模拟。
- `EvidencePackPanel.vue`：展示本资料可形成的 evidence 和检索权重。

## 路由与导航

修改 `src/router.js`：

```js
import KnowledgeBasePage from './pages/KnowledgeBasePage.vue';

{ path: '/knowledge-base', name: 'knowledge-base', component: KnowledgeBasePage }
```

修改 `src/App.vue` 的 `navItems`：

```js
{ to: '/knowledge-base', label: '知识库', icon: 'folder_open' }
```

## 视觉要求

必须延续现有项目风格：

- 背景使用 `var(--wash)`。
- 卡片使用 `rgba(255,255,255,.66)` 或 `var(--surface-glass)`。
- 主要按钮使用 `var(--deep)`。
- 状态成功使用 `var(--mint)` + `var(--green)`。
- 警告或解析中可使用 `var(--amber)`。
- 不使用 wireframe 的黑白粗线框风格，wireframe 只作为结构参考。

## 验收标准

- 主导航出现“知识库”入口。
- `/knowledge-base` 能打开知识库管理页面。
- 页面为三栏结构：分类、资料列表、资料详情。
- 能看到至少 3 条资料，其中至少 1 条为“解析中”，1 条为“已解析”。
- 点击资料行，右侧详情内容变化。
- 点击“上传资料”后，出现模拟上传/解析流程。
- 点击“引用到课程”后，出现成功反馈。
- 右侧详情能看到知识点、切片数量、Evidence 数量、索引状态。
- 页面风格和原项目保持统一。

