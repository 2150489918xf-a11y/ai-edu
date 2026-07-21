# 课程工作流共享侧栏设计

## 目标

统一课程大纲、思维导图、教案和题目分析页面的课程步骤侧栏，消除菜单数量、宽度、间距和激活样式不一致的问题。

## 根因

四个页面分别维护 `ws-rail`、`mind-rail`、`lp-course-rail` 和 `qa-rail`。这些重复实现形成了不同版本：

- 工作台使用 64px 侧栏、5 个步骤和浅绿色激活态。
- 思维导图使用 80px 侧栏、5 个步骤和深绿色激活态。
- 教案与题析使用 80px 侧栏、4 个步骤和深绿色激活态，缺少“导图”。

继续逐页同步 CSS 无法阻止后续再次分叉，因此需要收敛为一个共享组件。

## 已确认视觉

以课程大纲工作台的侧栏为统一标准：

- 侧栏占用 64px。
- 按钮宽度 60px，最小高度 58px。
- 激活项使用浅绿色背景 `var(--mint)` 和绿色文字 `var(--green)`。
- 未激活项使用透明背景和 `var(--soft)` 文字。
- 菜单固定为：生成、导图、PPT、教案、题析。
- 图标固定为：`auto_awesome`、`account_tree`、`desktop_windows`、`article`、`analytics`。
- 底部保留深绿色 AI 圆形标记。

## 组件设计

新增 `src/components/CourseWorkflowRail.vue`，负责菜单定义、激活状态、路由跳转和统一样式。

Props：

```js
courseId: String
activeStep: 'generate' | 'mindmap' | 'ppt' | 'lesson-plan' | 'analysis'
lockedSteps: String[]
```

事件：

```js
blocked(stepKey)
```

组件内部维护步骤到课程路由的映射。点击当前步骤不重复跳转；点击锁定步骤时触发 `blocked`，由父页面显示原有提示；其余步骤使用 Vue Router 跳转。

激活按钮提供 `aria-current="step"`，锁定按钮不直接设置 `disabled`，保证教师点击后仍能看到“请先生成课程大纲”的解释。

## 页面接入

### 课程大纲工作台

- `WorkspacePage.vue` 使用 `active-step="generate"`。
- 课程尚未生成大纲时锁定 `mindmap`、`ppt` 和 `lesson-plan`。
- `blocked` 事件继续显示“请先生成课程大纲”。
- `.ws-shell` 第一列保持 64px。

### 思维导图

- `MindMapGeneratePage.vue` 使用 `active-step="mindmap"`。
- 删除页面内部 `mind-rail`、`mind-step`、`mind-ai-mark` 标记和样式。
- `.mind-shell` 第一列从 80px 改为 64px。

### 教案

- `LessonPlanPage.vue` 使用 `active-step="lesson-plan"`。
- 自动补齐“导图”入口。
- 删除 `lp-course-rail`、`lp-course-step`、`lp-ai-mark` 标记和样式。
- `.lp-shell` 和 `.lp-shell.is-generated` 第一列从 80px 改为 64px。

### 题目分析

- `StageAnalysisPage.vue` 使用 `active-step="analysis"`。
- 自动补齐“导图”入口。
- 删除 `qa-rail`、`qa-step`、`qa-ai-mark` 标记和样式。
- `.qa-shell` 第一列从 80px 改为 64px。

### PPT 编辑页

`PptGeneratePage.vue` 不接入课程步骤侧栏。该页面的左侧是幻灯片缩略图选择器，承担编辑器核心功能，不属于本次统一范围。

## 数据与交互

共享侧栏不读取数据库和课程接口，只接收父页面传入的课程 ID、当前步骤和锁定步骤。页面已有课程数据加载、保存、生成和分析逻辑保持不变。

## 错误处理

- `courseId` 为空时不执行跳转。
- 未知 `activeStep` 不产生错误，仅不显示激活项。
- 锁定步骤通过 `blocked` 事件交给父页面提示。
- 当前步骤按钮点击不触发路由变化。

## 测试与验收

自动测试：

- 共享组件固定包含 5 个步骤及正确路由片段。
- 四个页面均导入并使用 `CourseWorkflowRail`。
- 四个页面不再包含各自旧侧栏的菜单标记和 CSS。
- 工作台保留未生成大纲时的锁定提示。
- 四个页面网格第一列统一为 64px。
- 教案和题析包含由共享组件提供的“导图”入口。

浏览器验收：

- 使用同一课程依次打开大纲、导图、教案和题析页面。
- 五个菜单的顺序、宽度、图标、文字和 AI 标记一致。
- 每个页面只高亮自己的步骤，激活态均为浅绿色。
- 侧栏切换可以到达对应页面。
- 页面主体没有因 80px 改为 64px 出现覆盖或横向滚动。
- 控制台无错误。

## 非目标

- 不重构 PPT 的幻灯片缩略图栏。
- 不修改课程生成、导图生成、教案生成或题析业务逻辑。
- 不调整页面顶部标题栏和右侧 AI 面板。
- 不新增数据库字段或后端接口。
