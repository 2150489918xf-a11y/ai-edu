# 前端 Mock 功能开发总览

## 目标

在现有 Vite + Vue 3 项目上补齐一套“智能教学系统前端演示闭环”。本阶段不接真实后端，所有数据使用前端写死数据、`mockStore` 状态和新增的 `mockApi` 伪接口模拟。

演示闭环：

```text
知识库上传/沉淀资料
-> 课程备课引用知识库资料
老师备课资料解析
-> 生成思维导图
-> 题库知识图谱
-> 智能组卷
-> 学生端答题与 AI 讲题
-> 学生画像更新
-> 个性化推荐题
-> 教师端班级学情与学生画像分析
-> 家长可见学习摘要
```

## 当前工程基础

现有入口：

- `src/pages/WorkspacePage.vue`：课前备课工作台。
- `src/pages/QuestionBankDetailPage.vue`：题库详情。
- `src/pages/QuestionGeneratePage.vue`：AI 生成题目。
- `src/pages/StudentClassroomPage.vue`：学生端课堂。
- `src/pages/AfterClassPage.vue`：学情分析。
- `src/data/mockStore.js`：当前全局 Mock 状态。
- 计划新增 `src/pages/KnowledgeBasePage.vue`：知识库管理。

当前没有独立伪接口层。页面主要直接读写 `mockStore`，部分页面用 `setTimeout` 模拟加载。

## 统一设计风格要求

所有新增页面、Tab、弹窗和组件必须延续现有项目的视觉风格，不另起一套 UI。

### 必须复用的现有样式基础

- 全局变量来源：`src/styles/base.css`。
- 主色：`--deep`、`--green`、`--mint`、`--wash`。
- 文本色：`--ink`、`--muted`、`--soft`。
- 边框与玻璃感：`--line`、`--surface-glass`、`backdrop-filter: blur(...)`。
- 圆角：优先使用 `--edu-radius-sm`、`--edu-radius-md`、`--edu-radius-lg`，不要自行使用大圆角风格。
- 阴影：优先使用 `--shadow-soft`、`--shadow`，避免重阴影。
- 字体：沿用 `--font-ui`、`--font-serif`、`--font-mono`。
- 控件高度：按钮优先使用 36px、40px、52px 三档，和现有 `.soft-btn`、`.primary-btn`、`.outline-generate-btn` 保持一致。

### 必须复用的页面模式

- 普通模块页沿用 `.module-page`、`.module-head`、`.module-tools`、`.surface-card`、`.two-col`、`.list-panel`、`.side-panel`。
- 题库相关页面沿用 `QuestionBankDetailPage.vue` 的列表 + 右侧信息面板结构。
- 知识库页面参考 `wireframes/wireframes/knowledge-base-wireframe.html` 的三栏结构，并转换为当前项目的玻璃卡片、绿色主色和圆角体系。
- 学情分析沿用 `AfterClassPage.vue` 的指标卡、表格列表、弹窗详情结构。
- 学生端沿用 `StudentClassroomPage.vue` 的深色课堂背景、课件居中、右侧题目弹窗结构。
- 备课工作台沿用 `WorkspacePage.vue` 的全屏布局：顶部栏 + 左侧步骤栏 + 中间主区 + 右侧 AI 面板。

### 新增组件设计约束

- 新组件默认只补充业务内容，不重写全局布局。
- 新增按钮优先使用现有类名：`.soft-btn`、`.primary-btn`、`.ghost-btn`。
- 新增卡片优先使用 `.surface-card` 或与现有卡片相同的玻璃白背景。
- 新增分段控件优先复用 `.segmented`。
- 新增标签优先复用 `.small-chip`、`.pill`、`.card-meta span`。
- 图谱、思维导图、试卷质量报告等视觉组件可以有自身布局，但颜色、线条、圆角和字体必须来自现有变量。
- 不新增营销页、英雄大图、强渐变大背景或与当前系统不一致的装饰风格。

### 响应式要求

- 当前项目以 1440x1080 演示为主，同时需要保证 1280 宽和较低高度下不遮挡。
- 新增页面优先使用 `grid-template-columns: minmax(0, 1fr) var(--edu-side-panel)`、`clamp(...)`、`minmax(0, 1fr)` 等现有写法。
- 学生端全屏页要避免右侧面板遮挡主要课件；小屏时右侧面板宽度使用 `min(420px, calc(100vw - 68px))` 类似约束。
- 不使用会导致横向滚动的固定大宽度。

## 新增基础模块

### `src/data/mockApi.js`

新增统一伪接口层，页面通过它访问 Mock 数据，营造“有后端”的调用感。

建议接口：

```js
export async function generateMindMap(courseId) {}
export async function getKnowledgeGraph(bankId) {}
export async function generateExamPaper(bankId, config) {}
export async function submitStudentAnswer(payload) {}
export async function askStudentAi(payload) {}
export async function getStudentProfile(studentId) {}
export async function getClassLearningAnalysis(classId) {}
export async function getParentLearningSummary(studentId) {}
```

接口行为：

- 返回写死数据。
- 使用 `Promise` 和 `setTimeout` 模拟 500ms 到 1500ms 的接口延迟。
- 对需要“状态变化”的功能，同步更新 `mockStore`。
- 保留清晰的函数名，后续能替换为真实 HTTP API。

### `src/data/teachingMockData.js`

新增教学演示专用数据，避免继续把 `mockStore.js` 变得过大。

建议包含：

- 二次函数知识点。
- 二次函数思维导图节点。
- 知识图谱节点与边。
- 题库题目与知识点绑定。
- 试卷生成结果。
- 学生画像。
- 班级学情统计。
- 家长端摘要。
- 学生 AI 对话脚本。

## 学科主题

建议本轮新增功能统一使用“二次函数”，原因：

- 适合公式渲染和 AI 讲题。
- 适合思维导图。
- 适合知识图谱。
- 适合学生画像和薄弱点诊断。

已有项目里有“牛顿第二定律”数据，新增模块可保留物理数据，但演示主链路建议统一成：

```text
高中数学 - 二次函数
```

## 页面开发文档索引

- `01-teacher-mindmap-page.md`：老师备课思维导图。
- `02-learning-analysis-page.md`：班级学情分析 + 学生画像分析。
- `03-student-profile-practice-page.md`：学生画像更新 + 个性化出题。
- `04-question-bank-paper-page.md`：题库智能组卷。
- `05-student-ai-tutor-page.md`：学生端 AI 讲题与问答。
- `06-knowledge-graph-page.md`：题库动态知识图谱。
- `07-knowledge-base-page.md`：知识库管理。

## 全局验收标准

- `npm run dev` 能正常启动。
- `npm run build` 能通过。
- 每个新增页面或 Tab 都能在浏览器中点通。
- 每个 AI 相关功能都有“生成中/分析中”的加载状态。
- 每个功能都不依赖真实后端。
- 页面刷新后关键演示状态不丢失，优先使用 `localStorage` 或 `sessionStorage`。
- 演示链路可以从老师端走到学生端，再回到教师端学情分析。
