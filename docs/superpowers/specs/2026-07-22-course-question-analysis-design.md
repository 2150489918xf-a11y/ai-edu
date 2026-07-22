# 课程题析真实数据改造设计

## 1. 背景与目标

教师端课程题析页 `/preclass/courses/:courseId/analysis` 当前完全依赖 `mockStore`，课程、课堂、答题统计、错因与 AI 建议均可能与 PostgreSQL 中的真实数据不一致。本次改造把题析建设为课程级分析工作台：默认聚合整门课程，并支持按班级、课堂场次逐级筛选；客观指标由数据库实时计算；DeepSeek 只在教师主动点击时生成报告，并将报告持久化。

目标：

- 页面只使用 PostgreSQL 中的课程、课堂、题目、学生和答题数据，不再回退到 Mock。
- 默认展示整门课程汇总，支持班级和课堂场次筛选。
- 提供课程 KPI、薄弱题排行、题目统计、作答明细和单题下钻。
- AI 报告按“整门课程 / 单个班级 / 单个场次”分别生成、保存和读取。
- 数据变化后保留旧报告，同时明确标记报告已过期。
- 教师可选择目标题库，把当前学情报告作为上下文带到 AI 生题页面。

## 2. 范围与非目标

### 2.1 本期范围

- 课程题析统计服务、单题明细服务和 AI 报告服务。
- `CourseAnalysisReport` 持久化模型。
- 教师端题析页面重构。
- 题库选择弹窗和题析上下文传递。
- API、服务、前端契约和关键页面状态测试。

### 2.2 非目标

- 不在本期引入 Redis；题析读接口继续使用现有前端短时缓存策略。
- 不自动定时调用 AI，也不在每次筛选时自动生成报告。
- 不修改学生端学情画像的业务口径。
- 不实现多版本报告历史；每个分析范围只持久化并展示最新一次成功报告。
- 不把 AI 推断结果混入客观统计字段。

## 3. 已确认的产品结构

### 3.1 页面入口与默认范围

- 入口保持 `/preclass/courses/:courseId/analysis`。
- 默认范围为整门课程的全部班级和全部课堂场次。
- 选择班级后，课堂场次下拉框只显示该班级与当前课程关联的场次。
- 选择具体场次后，统计范围为该场次；场次天然确定班级。
- `classId` 与 `sessionId` 写入 URL 查询参数，刷新和返回后保留筛选范围。

### 3.2 页面信息架构

顶部展示课程信息、班级筛选、场次筛选、“引用学情生成题目”和“生成 AI 分析”。主体包括：

1. KPI：参与学生、作答次数、平均正确率、平均用时、薄弱题数。
2. 标签页：题目统计、作答明细、AI 分析报告。
3. 题目统计：薄弱题优先排序，可搜索，可展开单题详情。
4. 单题详情：选项分布、正确率、平均用时、错因/薄弱点、错误学生及每位学生提交答案。
5. AI 报告：当前筛选范围的最新报告、生成时间、数据状态和重新生成入口。

## 4. 架构与职责边界

新增 `CourseAnalysisService`，集中负责题析查询、统计聚合、数据指纹与报告持久化；新增 `AiCourseAnalysisService`，只负责组织提示词、调用 DeepSeek 流式接口和解析结构化报告。

```text
StageAnalysisPage
  -> courseAnalysisApiClient
     -> CourseAnalysisService
        -> Course / Class / ClassroomSession / Question / StudentAnswer
        -> CourseAnalysisReport
     -> AiCourseAnalysisService
        -> DeepSeek Chat Completions (stream)
```

职责约束：

- 前端只负责筛选、展示和状态管理，不在浏览器中重复实现统计口径。
- `CourseAnalysisService` 输出稳定 DTO，不把 Prisma 对象直接暴露给页面。
- `AiCourseAnalysisService` 不直接决定统计值，提示词中的所有数字来自统计服务。
- AI 调用成功并完成结构化解析后才持久化；失败不会覆盖最近一次成功报告。

## 5. 数据模型

新增 Prisma 模型 `CourseAnalysisReport`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String UUID | 报告 ID |
| `courseId` | String | 所属课程，课程删除时级联删除 |
| `scopeType` | String | `course`、`class` 或 `session` |
| `scopeKey` | String | 规范化范围键，与 `courseId` 组成唯一键 |
| `classId` | String? | 班级范围；场次报告也记录所属班级 |
| `sessionId` | String? | 场次范围 |
| `sourceFingerprint` | String | 生成时的源数据指纹 |
| `sourceAnswerCount` | Int | 生成时的答题记录数 |
| `sourceQuestionCount` | Int | 生成时的题目数 |
| `summary` | Json | 结构化概览和结论 |
| `weakPoints` | Json | 薄弱点与证据 |
| `teachingSuggestions` | Json | 教学建议 |
| `practiceSuggestions` | Json | 后续练习建议 |
| `rawText` | String? | AI 完整自然语言输出 |
| `provider` | String | `deepseek` |
| `model` | String | 实际模型名 |
| `generatedAt` | DateTime | 生成完成时间 |
| `createdAt` / `updatedAt` | DateTime | 审计时间 |

唯一约束为 `@@unique([courseId, scopeKey])`。`scopeKey` 取值分别为 `course`、`class:<classId>`、`session:<sessionId>`，避免 PostgreSQL 对可空组合唯一键的特殊行为。课程删除时报告随课程级联删除。

## 6. 统计口径

### 6.1 数据范围

- 课程范围：`ClassroomSession.courseId = courseId` 的全部非个性化课堂场次。
- 班级范围：课程范围基础上增加 `classId`。
- 场次范围：课程范围基础上增加 `sessionId`，并校验场次确实属于当前课程。
- 个性化练习场次 `status = ai_personal_practice` 不计入教师课堂题析，避免把学生自练混入课堂教学效果。
- 只统计 `Question.status = active` 且 `deletedAt IS NULL` 的题目。

### 6.2 KPI

- 参与学生：范围内有至少一条答题记录的去重学生数。
- 作答次数：范围内 `StudentAnswer` 总条数。
- 平均正确率：正确答题记录数 / 全部答题记录数；无作答时为 0。
- 平均用时：忽略空值后 `durationSeconds` 的算术平均；无有效用时为 0。
- 薄弱题：有作答且正确率低于 60% 的题目数。

### 6.3 题目统计与单题下钻

- 一道题在多个场次出现时按当前筛选范围聚合。
- 每题返回作答人数、作答次数、正确数、错误数、正确率、平均用时和知识点。
- 选择题按选项值统计人数和百分比；填空题按规范化答案文本统计，最多返回频次最高的 10 项。
- 每位学生在同一场次同一题的多次提交均保留在作答明细；单题“学生答案”默认显示该学生在每个场次的最后一次提交，并保留提交时间。
- 错因优先使用题目的 `weakPoint`、`knowledge` 和 `analysis` 作为客观上下文；AI 报告中的错因推断单独标识为 AI 结论。

### 6.4 数据指纹与过期判定

统计服务根据范围内的 `answerCount`、最新 `submittedAt`、题目数量以及最新题目 `updatedAt` 生成 SHA-256 指纹。报告的 `sourceFingerprint` 与当前指纹不一致时返回 `isStale: true`。旧报告仍可查看，但页面提示“数据已更新，建议重新生成”。

## 7. API 契约

### 7.1 获取课程题析

`GET /api/v1/courses/:courseId/analysis?classId=&sessionId=`

返回：

- `course`：课程基础信息。
- `filters`：可选班级、可选场次及当前范围。
- `summary`：五项 KPI。
- `questionStats`：题目聚合统计。
- `answerRecords`：首屏作答明细，按提交时间倒序。
- `latestReport`：当前范围的最新 AI 报告及 `isStale`。
- `source`：当前数据指纹、题目数、答题数和最后更新时间。

### 7.2 获取单题详情

`GET /api/v1/courses/:courseId/analysis/questions/:questionId?classId=&sessionId=`

返回选项/答案分布、题目指标、错误学生列表、学生最后提交答案、场次和提交时间。该接口按展开操作懒加载。

### 7.3 流式生成并保存 AI 报告

`POST /api/v1/courses/:courseId/analysis/reports/stream`

请求体包含 `classId`、`sessionId` 和可选教师补充要求。服务端重新获取统计快照，不接受前端传入的统计结果。SSE 事件：

- `delta`：自然语言增量文本。
- `section`：解析出的结构化报告模块。
- `report`：保存成功后的完整报告。
- `done`：供应商、模型和完成状态。
- `error`：标准错误码和可读信息。

### 7.4 获取报告上下文

`GET /api/v1/course-analysis-reports/:reportId/context`

返回经过裁剪的课程、范围、关键指标、薄弱题和教学/练习建议，供题目生成服务使用。服务端校验报告存在且所属课程有效。

题目生成页使用：

`/question-banks/:bankId/generate?analysisReportId=<reportId>`

页面加载后读取报告上下文并在生成要求中展示“已引用：课程学情报告”。调用 AI 生题接口时传递 `analysisReportId`，由后端读取上下文并加入提示词，避免把完整报告放进 URL 或信任前端拼装数据。

## 8. AI 报告协议

系统提示词要求 DeepSeek 输出简短流式说明，并输出可解析的结构化 JSON 块。报告至少包含：

- 总体结论：2 至 4 条。
- 薄弱知识点：名称、证据、影响和优先级。
- 薄弱题分析：题目 ID、主要错误模式和讲评建议。
- 教学建议：面向教师的可执行动作。
- 练习建议：适合后续生题的知识点、难度、题型和数量建议。

如果自然语言已输出但结构化块解析失败，接口返回 `AI_PARSE_FAILED`，不保存半成品。提示词只包含当前筛选范围的聚合统计和最多 20 道最薄弱题，避免课程题量增长后上下文失控。

## 9. 前端状态与错误处理

- 初次加载只在数据区展示骨架，顶部导航和返回操作保持可用。
- 筛选变化取消过时请求或忽略旧响应，避免快速切换造成数据串页。
- 无题目：提示先完善课程题库；有题目但无作答：展示零值统计和暂无课堂答题数据。
- 统计接口失败：保留页面框架并提供独立重试。
- AI 生成期间只让报告面板进入生成态，统计区不回到加载态。
- AI 失败时保留最近成功报告并显示重试；缺少 DeepSeek Key 时显示明确配置提示。
- 单题详情同时只展开一个，详情失败只影响该行。
- 题库选择弹窗只展示有效题库，并标明当前学科和年级匹配项。

## 10. 缓存与一致性

- 题析 GET 接口可复用前端短时缓存，但筛选参数必须进入缓存键。
- AI 报告生成成功后清除当前课程题析与报告上下文缓存。
- 学生提交答案、题目新增/修改/删除后不强制删除报告；通过源数据指纹即时标记过期。
- POST/SSE 生成接口不缓存。

## 11. 测试策略

### 11.1 服务测试

- 课程、班级、场次三种范围过滤正确。
- 排除个性化练习场次。
- KPI、题目统计、选项分布和平均用时计算正确。
- 单题错误学生和最后提交答案正确。
- 不存在或不属于课程的班级、场次、题目返回 404/400。
- 数据指纹变化后旧报告被标记为过期。
- AI 成功时保存结构化报告；失败或解析失败时不覆盖旧报告。

### 11.2 API 与前端契约测试

- 四个新增接口的状态码、DTO 和 SSE 事件顺序。
- 页面不再导入 `mockStore`，且使用课程路由参数加载真实数据。
- 筛选参数进入 URL；切换筛选不触发 AI。
- 生成期间统计区不展示加载遮罩。
- 题库选择后携带 `analysisReportId` 跳转。
- 题目生成请求把 `analysisReportId` 交给后端。

### 11.3 验证

- Prisma Client 生成和 `prisma db push` 成功。
- 后端自动化测试通过。
- 前端构建通过。
- 使用有真实数据的课程验证整门课程、班级、场次、单题详情、AI 持久化和刷新后恢复。

## 12. 验收标准

1. 题析页不出现写死的“牛顿第二定律”、固定题库 ID 或 Mock 课堂数据。
2. 默认聚合整门课程，班级和场次筛选结果与 PostgreSQL 数据一致。
3. 刷新页面后统计和已生成 AI 报告仍存在。
4. 新答题记录产生后旧报告显示过期，但仍可查看。
5. 单题可以查看选项分布、正确率、平均用时、错误学生和学生答案。
6. 未点击按钮不会调用 DeepSeek；点击后流式展示，成功后持久化。
7. 引用学情生成题目时必须先选择题库，并在生成页明确显示已引用报告。
8. 无数据、接口失败、AI 缺少 Key 和 AI 解析失败都有明确且可恢复的界面状态。
