# EduAI CRUD 接口开发文档

## 目标

在已经接入 PostgreSQL + Prisma + 本地 Node API 的基础上，补齐后台管理型数据的增删改查能力。第一阶段先支持老师维护教学基础资料，第二阶段再处理课堂、试卷、任务等状态型业务数据。

本文件用于后续开发对齐：

- 哪些资源需要完整 CRUD。
- 哪些资源只做创建、查询和状态流转。
- 哪些资源不建议物理删除。
- 每类资源的接口、字段、删除策略和开发顺序。

## 当前后端基础

已经落地：

- PostgreSQL Docker：`docker-compose.yml`
- Prisma schema：`prisma/schema.prisma`
- Seed：`prisma/seed.js`
- 后端入口：`server/index.js`
- 学情查询服务：`server/learningService.js`
- 路由入口：`server/app.js`

已存在的核心模型：

- `Class`
- `Student`
- `Course`
- `KnowledgePoint`
- `Question`
- `QuestionKnowledgePoint`
- `ClassroomSession`
- `StudentAnswer`
- `LearningProfile`
- `ParentSummary`

暂未落地但后续需要补的模型：

- `QuestionBank`
- `QuestionBankQuestion`
- `KnowledgeMaterial`
- `MindMap`
- `ExamPaper`
- `PracticeTask`
- `AiTask`
- `AuditLog`

## CRUD 设计原则

### 1. 不把所有数据都做成普通 CRUD

老师主动维护的基础资料可以完整 CRUD；系统生成的结果和历史行为记录不做普通删除，避免破坏学情链路。

### 2. 删除优先做软删除

课程、班级、学生、题库、题目、资料、试卷都建议加：

```prisma
status    String   @default("active")
deletedAt DateTime? @map("deleted_at")
```

删除接口默认只设置：

```text
status = "archived"
deleted_at = now()
```

只有开发调试或管理员清理数据时才允许物理删除。

### 3. 历史数据不可断链

如果资源已经被以下数据引用，不允许物理删除：

- `StudentAnswer`
- `LearningProfile`
- `ParentSummary`
- `ClassroomSession`
- `ExamPaper`

示例：课程被归档后，“我的课程”默认不显示，但历史答题和学情分析仍能查到课程名称。

### 4. 接口保持 REST 风格

Base URL：

```text
/api/v1
```

标准 CRUD：

```text
GET    /resources
POST   /resources
GET    /resources/:id
PATCH  /resources/:id
DELETE /resources/:id
```

状态动作：

```text
POST /resources/:id/archive
POST /resources/:id/restore
POST /resources/:id/publish
POST /resources/:id/close
```

### 5. 列表统一支持筛选和分页

通用 Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| keyword | string | 名称、标题、学号等关键词 |
| status | string | active / archived / draft / published |
| page | number | 默认 1 |
| pageSize | number | 默认 20，最大 100 |
| sortBy | string | 排序字段 |
| sortOrder | string | asc / desc |

标准列表响应：

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 43
  }
}
```

## 资源分层

### A. 完整 CRUD 资源

这些是老师主动维护的数据，第一优先级开发。

| 资源 | 模型 | 是否已有模型 | 删除策略 |
| --- | --- | --- | --- |
| 课程 | `Course` | 已有 | 软删除/归档 |
| 班级 | `Class` | 已有 | 软删除/归档 |
| 学生 | `Student` | 已有 | 软删除/移出班级 |
| 知识点 | `KnowledgePoint` | 已有 | 无引用时删除，有引用时归档 |
| 题库 | `QuestionBank` | 待补 | 软删除/归档 |
| 题目 | `Question` | 已有 | 软删除/归档 |
| 知识库资料 | `KnowledgeMaterial` | 待补 | 软删除/归档 |

### B. 状态型业务资源

这些资源需要创建、查看、编辑部分字段和状态流转，不建议做普通删除。

| 资源 | 模型 | 是否已有模型 | 主要动作 |
| --- | --- | --- | --- |
| 课堂/测验场次 | `ClassroomSession` | 已有 | 创建、开始、结束、归档 |
| 试卷 | `ExamPaper` | 待补 | 生成、编辑、发布、归档 |
| 思维导图 | `MindMap` | 待补 | 生成、保存版本、归档 |
| 练习任务 | `PracticeTask` | 待补 | 创建、分发、完成、归档 |

### C. 系统结果和历史记录

这些不做普通 CRUD，只做查询、生成、作废或重新计算。

| 资源 | 模型 | 是否已有模型 | 策略 |
| --- | --- | --- | --- |
| 学生答题记录 | `StudentAnswer` | 已有 | 新增、查询、作废/重交 |
| 学情分析 | 聚合查询 | 已有查询接口 | 查询、重新计算 |
| 学生画像 | `LearningProfile` | 已有 | 查询、重新生成、老师备注 |
| 家长摘要 | `ParentSummary` | 已有 | 查询、重新生成、老师编辑、发送记录 |
| AI 任务 | `AiTask` | 待补 | 创建任务、查状态、取消 |

## 第一阶段接口清单

### 1. 课程 Courses

用途：支撑“我的课程”列表，老师可以新增课程、编辑课程、归档课程。

字段建议：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 主键 |
| title | string | 是 | 课程名称 |
| subject | string | 是 | 学科 |
| grade | string | 是 | 年级 |
| description | string | 否 | 简介 |
| status | string | 是 | active / archived |
| deletedAt | datetime | 否 | 归档时间 |
| createdAt | datetime | 是 | 创建时间 |
| updatedAt | datetime | 是 | 更新时间 |

接口：

```http
GET /api/v1/courses
POST /api/v1/courses
GET /api/v1/courses/{courseId}
PATCH /api/v1/courses/{courseId}
DELETE /api/v1/courses/{courseId}
POST /api/v1/courses/{courseId}/restore
```

创建请求：

```json
{
  "title": "牛顿第二定律",
  "subject": "物理",
  "grade": "高一",
  "description": "F=ma、合外力计算、加速度方向。"
}
```

删除规则：

- 默认归档，不物理删除。
- 已有关联题目、课堂、学生画像或家长摘要时仍允许归档。
- 归档课程不出现在默认课程列表中。
- `status=archived` 时可查询归档课程。

### 2. 班级 Classes

用途：支撑班级筛选、班级管理和学生归属。

字段建议：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 主键 |
| name | string | 是 | 班级名称 |
| grade | string | 是 | 年级 |
| subject | string | 是 | 学科 |
| teacherId | string | 否 | 任课老师 |
| status | string | 是 | active / archived |
| deletedAt | datetime | 否 | 归档时间 |

接口：

```http
GET /api/v1/classes
POST /api/v1/classes
GET /api/v1/classes/{classId}
PATCH /api/v1/classes/{classId}
DELETE /api/v1/classes/{classId}
POST /api/v1/classes/{classId}/restore
```

删除规则：

- 班级已有学生时，不做物理删除。
- 删除班级等同归档，学生仍保留 `classId`，历史学情不丢。
- 后续可增加“毕业班级”状态。

### 3. 学生 Students

用途：支撑学生列表、学生画像入口、班级学生维护。

字段建议：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 主键 |
| name | string | 是 | 学生姓名 |
| classId | string | 是 | 所属班级 |
| studentNo | string | 否 | 学号 |
| attendance | string | 否 | 演示用出勤字段 |
| practiceCount | number | 否 | 练习数，可后续聚合计算 |
| status | string | 是 | active / archived |
| deletedAt | datetime | 否 | 移出或归档时间 |

接口：

```http
GET /api/v1/students
POST /api/v1/students
GET /api/v1/students/{studentId}
PATCH /api/v1/students/{studentId}
DELETE /api/v1/students/{studentId}
POST /api/v1/students/{studentId}/restore
```

额外筛选：

| 参数 | 说明 |
| --- | --- |
| classId | 按班级 ID 筛选 |
| className | 按班级名称筛选，兼容当前前端 |
| keyword | 姓名或学号 |

删除规则：

- 默认归档学生，不删除答题记录。
- 如果只是转班，使用 `PATCH /students/{studentId}` 修改 `classId`。

### 4. 知识点 Knowledge Points

用途：课程结构、题目绑定、学情薄弱点分析。

接口：

```http
GET /api/v1/courses/{courseId}/knowledge-points
POST /api/v1/courses/{courseId}/knowledge-points
GET /api/v1/knowledge-points/{knowledgePointId}
PATCH /api/v1/knowledge-points/{knowledgePointId}
DELETE /api/v1/knowledge-points/{knowledgePointId}
```

字段建议：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| courseId | string | 是 | 所属课程 |
| name | string | 是 | 知识点名称 |
| description | string | 否 | 说明 |
| parentId | string | 否 | 父知识点 |
| sortOrder | number | 否 | 排序 |

删除规则：

- 已绑定题目时不允许物理删除。
- 可先实现硬删除保护：有引用返回 `409 CONFLICT`。
- 后续如需归档，再补 `status/deletedAt`。

### 5. 题库 Question Banks

用途：老师按课程或章节组织题目，支撑智能组卷。

需要新增模型：

```prisma
model QuestionBank {
  id          String   @id @default(uuid())
  title       String
  courseId    String   @map("course_id")
  description String?
  status      String   @default("active")
  deletedAt   DateTime? @map("deleted_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
}
```

接口：

```http
GET /api/v1/question-banks
POST /api/v1/question-banks
GET /api/v1/question-banks/{bankId}
PATCH /api/v1/question-banks/{bankId}
DELETE /api/v1/question-banks/{bankId}
POST /api/v1/question-banks/{bankId}/restore
```

额外接口：

```http
POST /api/v1/question-banks/{bankId}/questions/{questionId}
DELETE /api/v1/question-banks/{bankId}/questions/{questionId}
GET /api/v1/question-banks/{bankId}/questions
```

### 6. 题目 Questions

用途：题库维护、课堂测验、试卷生成、学生答题。

现有模型已有 `Question`，需要补：

- `status`
- `deletedAt`
- 可选 `source`
- 可选 `createdBy`

接口：

```http
GET /api/v1/questions
POST /api/v1/questions
GET /api/v1/questions/{questionId}
PATCH /api/v1/questions/{questionId}
DELETE /api/v1/questions/{questionId}
POST /api/v1/questions/{questionId}/restore
```

创建请求：

```json
{
  "courseId": "course-newton-2",
  "type": "single_choice",
  "difficulty": "basic",
  "title": "质量为 2 kg 的小车受到 6 N 水平合外力，小车的加速度是多少？",
  "options": [
    { "label": "A", "text": "3 m/s²" },
    { "label": "B", "text": "6 m/s²" }
  ],
  "answer": { "value": "A" },
  "analysis": "由 F=ma 得 a=F/m=6/2=3 m/s²。",
  "knowledgePointIds": ["kp-newton-2"]
}
```

删除规则：

- 题目已有学生答题记录时只能归档。
- 归档题目不出现在默认组卷和题库列表中。
- 历史试卷和答题记录仍可展示题干快照；后续建议给 `StudentAnswer` 或试卷题目关联保存快照字段。

### 7. 知识库资料 Materials

用途：资料上传、解析状态、备课引用、AI 生成依据。

需要新增模型：

```prisma
model KnowledgeMaterial {
  id          String   @id @default(uuid())
  title       String
  type        String
  subject     String?
  grade       String?
  source      String?
  fileUrl     String?  @map("file_url")
  status      String   @default("uploaded")
  tags        Json?
  metadata    Json?
  deletedAt   DateTime? @map("deleted_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
}
```

接口：

```http
GET /api/v1/materials
POST /api/v1/materials
GET /api/v1/materials/{materialId}
PATCH /api/v1/materials/{materialId}
DELETE /api/v1/materials/{materialId}
POST /api/v1/materials/{materialId}/parse
POST /api/v1/materials/{materialId}/restore
```

第一版可以先只保存元数据，不做真实文件上传；等后续接对象存储再补 `fileUrl` 和上传签名接口。

## 第二阶段接口清单

### 1. 课堂/测验场次 Classroom Sessions

接口：

```http
GET /api/v1/classroom-sessions
POST /api/v1/classroom-sessions
GET /api/v1/classroom-sessions/{sessionId}
PATCH /api/v1/classroom-sessions/{sessionId}
POST /api/v1/classroom-sessions/{sessionId}/start
POST /api/v1/classroom-sessions/{sessionId}/close
POST /api/v1/classroom-sessions/{sessionId}/archive
```

状态：

```text
draft -> active -> closed -> archived
```

### 2. 试卷 Exam Papers

接口：

```http
GET /api/v1/exam-papers
POST /api/v1/exam-papers
POST /api/v1/exam-papers/generate
GET /api/v1/exam-papers/{paperId}
PATCH /api/v1/exam-papers/{paperId}
POST /api/v1/exam-papers/{paperId}/publish
POST /api/v1/exam-papers/{paperId}/archive
```

状态：

```text
draft -> published -> archived
```

### 3. 思维导图 Mindmaps

接口：

```http
GET /api/v1/courses/{courseId}/mindmaps
POST /api/v1/courses/{courseId}/mindmaps/generate
GET /api/v1/mindmaps/{mindmapId}
PATCH /api/v1/mindmaps/{mindmapId}
POST /api/v1/mindmaps/{mindmapId}/archive
```

第一版保存 Markdown 和渲染节点数据即可。

### 4. 练习任务 Practice Tasks

接口：

```http
GET /api/v1/practice-tasks
POST /api/v1/practice-tasks
GET /api/v1/practice-tasks/{taskId}
PATCH /api/v1/practice-tasks/{taskId}
POST /api/v1/practice-tasks/{taskId}/publish
POST /api/v1/practice-tasks/{taskId}/close
```

## 结果型接口补充

### 学生答题记录

不做普通更新和删除。

```http
POST /api/v1/student-answers
GET /api/v1/question-answer-records
POST /api/v1/student-answers/{answerId}/void
POST /api/v1/student-answers/{answerId}/resubmit
```

### 学生画像

```http
GET /api/v1/students/{studentId}/profile
POST /api/v1/students/{studentId}/profile/regenerate
PATCH /api/v1/students/{studentId}/profile/teacher-note
```

### 家长摘要

```http
GET /api/v1/students/{studentId}/parent-summary
POST /api/v1/students/{studentId}/parent-summary/regenerate
PATCH /api/v1/students/{studentId}/parent-summary
POST /api/v1/students/{studentId}/parent-summary/send
```

### AI 任务

```http
POST /api/v1/ai-tasks
GET /api/v1/ai-tasks/{taskId}
POST /api/v1/ai-tasks/{taskId}/cancel
```

## Prisma 模型改造清单

第一阶段建议先改这些模型：

```text
Course: add status, deletedAt
Class: add status, deletedAt
Student: add status, deletedAt
KnowledgePoint: add sortOrder
Question: add status, deletedAt, source, createdBy
QuestionBank: create
QuestionBankQuestion: create
KnowledgeMaterial: create
```

后续阶段再补：

```text
ExamPaper
ExamPaperQuestion
MindMap
PracticeTask
PracticeTaskQuestion
AiTask
AuditLog
```

## 后端代码组织建议

当前只有 `learningService.js`，CRUD 增多后建议拆成模块：

```text
server/
  app.js
  http.js
  env.js
  index.js
  services/
    courseService.js
    classService.js
    studentService.js
    knowledgePointService.js
    questionBankService.js
    questionService.js
    materialService.js
    learningService.js
  routes/
    courseRoutes.js
    classRoutes.js
    studentRoutes.js
    questionRoutes.js
    materialRoutes.js
```

第一版可以继续使用 Node 原生 `http`，但路由文件必须拆分，否则 `server/app.js` 会快速膨胀。等接口稳定后，如果需要更多中间件和权限控制，再迁移到 Express 或 NestJS。

## 权限规则第一版

当前可以先使用 mock teacher 身份，后续登录接入后再替换。

| 操作 | 权限 |
| --- | --- |
| 查看课程/班级/学生 | 任课老师 |
| 创建课程/题库/资料 | 老师 |
| 编辑课程/题目/资料 | 创建者或管理员 |
| 归档课程/班级/题库 | 创建者或管理员 |
| 查看学生画像/家长摘要 | 对应班级任课老师 |
| 修改家长摘要 | 对应班级任课老师 |

## 开发顺序

### 第 1 批：课程 CRUD

目标：打通“我的课程”真实管理能力。

开发内容：

1. `Course` 增加 `status/deletedAt`。
2. 新增 `courseService.js`。
3. 新增课程 CRUD 路由。
4. 新增后端测试：创建、列表、详情、更新、归档、恢复。
5. 前端“我的课程”切真实 API。

### 第 2 批：班级和学生 CRUD

目标：让学情分析学生列表背后数据可维护。

开发内容：

1. `Class`、`Student` 增加 `status/deletedAt`。
2. 新增 `classService.js`、`studentService.js`。
3. 支持班级归档、学生转班、学生归档。
4. 前端学生列表继续使用真实 API。

### 第 3 批：知识点和题目 CRUD

目标：题库数据可维护，后续组卷不再只依赖 seed。

开发内容：

1. `Question` 增加 `status/deletedAt`。
2. `KnowledgePoint` 增加 `sortOrder`。
3. 新增题目创建、编辑、归档、恢复。
4. 支持题目绑定多个知识点。

### 第 4 批：题库和资料 CRUD

目标：补齐备课和题库管理入口。

开发内容：

1. 新增 `QuestionBank`、`QuestionBankQuestion`。
2. 新增 `KnowledgeMaterial`。
3. 支持题库关联题目。
4. 支持资料元数据管理和解析状态。

### 第 5 批：状态型业务资源

目标：课堂、试卷、思维导图、练习任务从 mock 进入真实数据流。

开发内容：

1. `ClassroomSession` 状态接口。
2. `ExamPaper` 生成和发布。
3. `MindMap` 保存版本。
4. `PracticeTask` 分发和完成状态。

## 测试策略

每批开发至少保留三类测试：

1. 路由契约测试：验证 HTTP 状态码和响应结构。
2. 数据库服务测试：验证 Prisma 查询和软删除规则。
3. 前端 API 兼容测试：验证原有页面调用函数不破。

第一批课程 CRUD 的测试建议：

```text
tests/courseCrudApi.test.mjs
tests/courseCrudDb.test.mjs
```

必须覆盖：

- 创建课程返回 201。
- 课程列表默认不返回归档课程。
- `status=archived` 可以查归档课程。
- 更新课程只改允许字段。
- 删除课程只设置 `deletedAt`，不物理删除。
- 恢复课程清空 `deletedAt`。

## 验收标准

第一阶段 CRUD 完成后，需要满足：

- 老师可以新增课程、班级、学生、题目和资料。
- 老师可以编辑上述资源的基础信息。
- 老师可以归档资源，默认列表不展示归档数据。
- 历史学情、答题记录、学生画像不因为归档而丢失。
- 所有 CRUD 接口有自动化测试。
- `npm run build` 通过。
- `node tests/mockApi.test.mjs` 通过。
- 后端新增 CRUD 测试通过。
