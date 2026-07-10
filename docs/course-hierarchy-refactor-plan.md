# 课程层级改造方案

## 背景

当前系统里的 `Course` 同时承担了两种含义：

- 教师端：一节课、一个专题、一个课件生成上下文，例如“牛顿第二定律”“二次函数”。
- 学生端：学生看到的一门课程入口和学情分析粒度。

这导致学生端和管理端出现明显的业务粒度问题：学生看到的“课程”被拆得过细，像“二次函数”“阅读理解训练”这种更像章节、专题或学习单元，而不是一门完整课程。真实业务里更合理的层级应该是：

```text
课程：高一物理 / 高一数学 / 高一英语
  单元：牛顿第二定律 / 力的合成 / 二次函数 / 阅读理解训练
    任务：课堂练习 / 课后练习 / AI 个性化练习 / 试卷
      题目与答题记录
```

## 现有结构分析

### 数据库

核心模型：

- `Course`
  - 当前保存标题、学科、年级、教学目标、知识点、课件大纲、思维导图、教案等。
  - 实际更像“教学单元/备课单元”。
- `Question`
  - 通过 `courseId` 绑定到 `Course`。
  - 当前题目属于某个专题/单元。
- `ClassroomSession`
  - 通过 `courseId` 绑定到 `Course`。
  - 当前一个 session 可以理解为某个单元下的练习任务。
- `StudentCourseEnrollment`
  - 通过 `courseId` 给学生分配“课程”。
  - 实际上现在是在分配专题/单元。
- `LearningProfile`
  - 通过 `studentId + courseId` 做画像。
  - 当前画像是“单元画像”，但页面文案叫“课程画像”。
- `ParentSummary`
  - 同样通过 `courseId` 绑定。

现有缺口：没有“真实课程”这一层。

### 教师端

#### 我的课程页 `CoursesPage.vue`

当前行为：

- 列出 `/api/v1/courses` 返回的所有 `Course`。
- 新建“课程”后直接进入 `/preclass/courses/:courseId/workspace`。
- 创建字段包括：标题、学科、年级、课时、目标、知识点。

实际含义：

- 更像新建一个“备课单元/教学专题”。
- 例如“牛顿第二定律”进入工作台生成大纲、导图、PPT、教案。

问题：

- 如果未来真实课程是“高一物理”，教师端当前的“我的课程”会和“课程单元”混在一起。
- 课件生成、思维导图、教案这些产物不应该挂在整门“高一物理”上，而应该挂在某个单元或课时上。

#### 备课工作台 `WorkspacePage.vue`

当前行为：

- 以 `courseId` 为上下文生成课程大纲。
- 后续导图、PPT、教案、题析都依赖同一个 `courseId`。

实际含义：

- 工作台强依赖的是“教学单元”，不是整门课程。

结论：

- 教师端不应该简单把现有 `Course` 改名为真实课程。
- 更合理的是保留现有工作台粒度，把现有 `Course` 迁移为 `CourseUnit`。

### 学生端

#### 课程中心 `StudentCoursesPage.vue`

当前行为：

- `getStudentDashboard` 返回 `courses`。
- 页面显示“我的课程”，每张卡片进入 `/student/courses/:courseId`。

问题：

- 当前展示的是单元/章节，而不是课程。
- “已分配课程 5 门”会把“牛顿第二定律、二次函数、阅读理解训练”都算作课程，业务上不自然。

#### 课程详情 `StudentCourseDetailPage.vue`

当前行为：

- 通过 `courseId` 加载课程任务。
- 展示该 `Course` 下的 sessions/tasks/questions。

合理改造方向：

- 学生先进入真实课程，例如“高一物理”。
- 再在课程详情里看到单元列表和任务列表。

#### 学情分析 `StudentAnalysisPage.vue`

当前行为：

- `getStudentAnalysis` 返回一组 `courses`。
- 左侧“按课程查看”实际是按 `courseId` 查看。
- 图表和 AI 画像绑定 `studentId + courseId`。

问题：

- 当前页面做的是“单元画像”，但用户期望的是“课程画像”。
- AI 个性化出题也只能针对一个单元，不能自然地针对整门课程综合出题。

合理改造方向：

- 第一层：课程画像，例如“高一物理”的总览。
- 第二层：单元画像，例如“牛顿第二定律”的详细分析。
- AI 出题支持两种范围：整门课程综合练习、指定单元针对练习。

### 管理端

当前管理端通过 `assignStudentCourse(studentId, courseId)` 给学生分配课程。

问题：

- 如果当前 `courseId` 实际是单元，那么教务处是在给学生分配章节，粒度太细。
- 正常管理端应该分配“学生属于哪些课程/班级课程”，而不是逐个分配“二次函数”“阅读理解训练”。

合理改造方向：

- 管理端分配真实课程。
- 单元通常跟随课程自动可见，除非未来需要精细权限控制。

## 目标模型

建议引入两层课程模型：

```text
SubjectCourse / CourseProgram / CourseGroup
  表示真实课程：高一物理、高一数学、高一英语

CourseUnit / LessonUnit
  表示教学单元、章节、专题、课时：牛顿第二定律、二次函数、阅读理解训练
```

命名建议：

- 对外 UI：课程、单元
- 数据库推荐：
  - `Course`：真实课程
  - `CourseUnit`：教学单元

但是考虑当前代码已有大量 `Course` 引用，短期可采用兼容命名：

- 新增 `CourseGroup` 表表示真实课程。
- 现有 `Course` 暂时保留，语义改为教学单元。
- 后续稳定后再决定是否重命名为 `CourseUnit`。

## 推荐方案

### ADR-001：新增课程聚合层，现有 Course 暂作为教学单元

#### Context

系统已经围绕 `Course` 建立了大量功能：教师备课、导图、PPT、教案、题库、学生任务、学情画像、AI 出题。直接把 `Course` 改成真实课程会影响面过大。

#### Options

| 方案 | 优点 | 缺点 | 复杂度 | 适用条件 |
| --- | --- | --- | --- | --- |
| A. 只改 UI 文案，把“课程”改成“单元” | 快 | 学生端仍缺少真实课程层，管理端仍不合理 | 低 | 只做演示，不继续扩展 |
| B. 新增 `CourseGroup`，现有 `Course` 暂作为单元 | 影响可控，兼容现有教师端 | 会有一段时间命名不够纯粹 | 中 | 当前最适合 |
| C. 彻底重命名 `Course -> CourseUnit`，新增 `Course` | 语义最干净 | 大量接口、页面、测试、数据迁移要同时改 | 高 | 产品边界稳定、时间充足 |

#### Decision

选择 B：新增 `CourseGroup`，现有 `Course` 暂作为教学单元。

#### Rationale

1. 教师端的备课工作台天然是单元粒度，保留现有 `courseId` 可以降低改造风险。
2. 学生端和管理端最需要的是“聚合显示”，可以先通过 `CourseGroup` 解决。
3. 后续如果要彻底语义化，可以再把现有 `Course` 重命名为 `CourseUnit`。

#### Trade-offs

- 接口短期会同时出现 `courseGroupId` 和 `courseId`。
- 代码里 `Course` 的真实语义仍需要文档约束。

#### Consequences

- 正向：学生端会符合真实课程结构；教师端已有课件生成能力不需要推倒。
- 负向：短期数据模型不是最理想命名。
- 缓解：新接口和新页面统一使用 `courseGroup` 表示真实课程，旧接口标记为单元兼容层。

## 数据库改造设计

### 新增表：CourseGroup

建议字段：

```prisma
model CourseGroup {
  id          String   @id @default(uuid())
  teacherId   String?  @map("teacher_id")
  teacher     Teacher? @relation(fields: [teacherId], references: [id], onDelete: SetNull)
  title       String
  subject     String
  grade       String
  description String?
  status      String   @default("active")
  deletedAt   DateTime? @map("deleted_at")
  units       Course[]
  enrollments StudentCourseGroupEnrollment[]
  profiles    CourseGroupLearningProfile[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("course_groups")
}
```

### 修改现有 Course

新增字段：

```prisma
groupId   String?      @map("group_id")
group     CourseGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
unitType  String       @default("lesson") @map("unit_type")
sortOrder Int          @default(0) @map("sort_order")
```

说明：

- `Course.title` 继续表示“单元标题”。
- `Course.groupId` 指向真实课程。
- `Course.subject/grade` 可以短期保留，默认继承 group，用于兼容旧页面。

### 新增学生真实课程分配表

```prisma
model StudentCourseGroupEnrollment {
  id        String      @id @default(uuid())
  studentId String      @map("student_id")
  groupId   String      @map("group_id")
  student   Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  group     CourseGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  status    String      @default("active")
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  @@unique([studentId, groupId])
  @@map("student_course_group_enrollments")
}
```

短期兼容：

- `StudentCourseEnrollment` 保留，用于个人单元/任务级分配。
- 管理端主路径改为分配 `CourseGroup`。

### 新增课程总画像表

```prisma
model CourseGroupLearningProfile {
  id                  String      @id @default(uuid())
  studentId           String      @map("student_id")
  groupId             String      @map("group_id")
  student             Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  group               CourseGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  mastery             Json
  weakPoints          Json        @map("weak_points")
  mistakeReasons      Json        @map("mistake_reasons")
  recommendedPractice Json        @map("recommended_practice")
  aiConversationSummary String?   @map("ai_conversation_summary")
  updatedAt           DateTime    @updatedAt @map("updated_at")

  @@unique([studentId, groupId])
  @@map("course_group_learning_profiles")
}
```

短期也可以不新增表，先按所有单元实时聚合，AI 分析后再新增持久化表。

## API 改造设计

### 教师端

新增真实课程接口：

```text
GET    /api/v1/course-groups
POST   /api/v1/course-groups
GET    /api/v1/course-groups/:groupId
PATCH  /api/v1/course-groups/:groupId
DELETE /api/v1/course-groups/:groupId
```

新增单元接口：

```text
GET    /api/v1/course-groups/:groupId/units
POST   /api/v1/course-groups/:groupId/units
PATCH  /api/v1/course-units/:unitId
DELETE /api/v1/course-units/:unitId
```

兼容旧接口：

```text
GET /api/v1/courses
POST /api/v1/courses
```

短期继续返回现有 `Course`，但文档标注为 unit-compatible。

### 学生端

课程首页：

```text
GET /api/v1/student/course-groups?studentId=
```

返回：

```json
{
  "student": {},
  "courses": [
    {
      "id": "group-physics-grade1",
      "title": "高一物理",
      "subject": "物理",
      "grade": "高一",
      "teacher": "王老师",
      "unitCount": 3,
      "taskCount": 8,
      "answeredQuestionCount": 24,
      "questionCount": 40,
      "progress": 60,
      "weakPoints": []
    }
  ]
}
```

课程详情：

```text
GET /api/v1/student/course-groups/:groupId?studentId=
```

返回真实课程信息、单元列表、任务列表。

课程学情总览：

```text
GET /api/v1/student/analysis/course-groups/:groupId?studentId=
POST /api/v1/student/analysis/course-groups/:groupId/generate
```

单元学情详情保留：

```text
GET /api/v1/student/analysis/units/:unitId?studentId=
POST /api/v1/student/analysis/units/:unitId/generate
```

AI 针对练习：

```text
POST /api/v1/student/analysis/course-groups/:groupId/practice-generate-stream
POST /api/v1/student/analysis/units/:unitId/practice-generate-stream
```

## 前端改造设计

### 教师端

#### 我的课程页

改造后结构：

```text
我的课程
  高一物理
    单元：牛顿第二定律、力的合成、匀变速直线运动
  高一数学
    单元：函数基础、二次函数、三角函数入门
```

页面调整：

- 左侧/主列表显示真实课程 `CourseGroup`。
- 右侧显示课程下的单元列表。
- “新建课程”创建 `CourseGroup`。
- “新建单元/备课”创建 `Course`，并进入现有 workspace。

按钮语义调整：

- 新建课程：创建“高一物理”。
- 新建备课单元：创建“牛顿第二定律”。
- 继续设计：进入选中单元的工作台。

#### 备课工作台

保持单元粒度：

```text
/preclass/course-groups/:groupId/units/:unitId/workspace
```

短期可兼容旧路由：

```text
/preclass/courses/:courseId/workspace
```

工作台顶部应显示：

```text
高一物理 / 牛顿第二定律
```

而不是只显示单元标题。

#### 导图、PPT、教案、题析

继续绑定单元：

- MindMap 属于单元。
- PPT 属于单元。
- LessonPlan 属于单元。
- Question 属于单元，也可通过 group 聚合查询。

### 学生端

#### 课程中心

只展示真实课程：

```text
高一物理
  3 个单元 · 8 个任务 · 完成率 60%

高一数学
  2 个单元 · 4 个任务 · 完成率 40%
```

不再直接展示“二次函数”“阅读理解训练”作为课程卡片。

#### 课程详情

进入真实课程后展示：

- 课程基础信息。
- 单元列表。
- 待完成任务。
- 最近练习。
- 进入单元详情或直接答题。

#### 学情分析

第一层：课程卡片。

```text
高一物理：总完成率、正确率、薄弱知识点、AI 总结
高一数学：总完成率、正确率、薄弱知识点、AI 总结
```

第二层：课程详情。

```text
课程总画像
  雷达图、知识点柱状图、答题构成、AI 总结

单元表现
  牛顿第二定律
  力的合成
  匀变速直线运动
```

点击单元后展示现有的详细单元画像。

### 管理端

主路径改为给学生/班级分配真实课程。

页面结构：

```text
学生详情
  所属课程：高一物理、高一数学
  个人补充分配：某个单元/某套练习
```

保留“个人单元分配”作为高级能力，不作为默认入口。

## 数据迁移方案

### 初始迁移规则

根据 `grade + subject + teacherId` 自动生成 `CourseGroup`。

示例：

```text
course-newton-2               -> 高一物理
dev-course-motion             -> 高一物理
dev-course-force-composition  -> 高一物理

dev-course-function-basic     -> 高一数学
dev-course-quadratic          -> 高一数学
dev-course-triangle           -> 高一数学

dev-course-relative-clause    -> 高一英语
dev-course-reading            -> 高一英语
```

迁移步骤：

1. 创建 `course_groups`。
2. 给现有 `courses` 填充 `group_id`。
3. 根据班级课程 session 推导班级可见课程组。
4. 根据学生个人 enrollment 推导学生课程组 enrollment。
5. 保留原有 `StudentCourseEnrollment`，避免破坏已有个人练习任务。

### 开发数据调整

`prisma/devData.js` 后续应显式声明：

```js
courseGroups = [
  { id: 'group-physics-grade1', title: '高一物理' },
  { id: 'group-math-grade1', title: '高一数学' },
  { id: 'group-english-grade1', title: '高一英语' }
]

courseUnits = [
  { id: 'course-newton-2', groupId: 'group-physics-grade1', title: '牛顿第二定律' }
]
```

## 分阶段实施计划

### 阶段 1：建模与兼容接口

目标：

- 新增 `CourseGroup`。
- 给现有 `Course` 增加 `groupId`。
- 增加真实课程聚合查询服务。
- 不改现有教师端工作台。

交付：

- Prisma schema migration。
- devData 迁移。
- `courseGroupService`。
- 学生端 `GET /student/course-groups`。
- 学生端 `GET /student/analysis/course-groups/:groupId`。

### 阶段 2：学生端改造

目标：

- 课程中心按真实课程展示。
- 课程详情展示单元与任务。
- 学情分析按课程聚合，单元详情下钻。

交付：

- `StudentCoursesPage.vue` 改为 courseGroups。
- `StudentCourseDetailPage.vue` 改为 group detail。
- `StudentAnalysisPage.vue` 左侧卡片改为真实课程。
- 保留单元学情详情组件。

### 阶段 3：管理端改造

目标：

- 教务处给学生分配真实课程。
- 单元分配作为高级/个人补充能力。

交付：

- 管理端课程分配接口改为 group。
- AdminOfficePage 展示课程组。
- 原 enrollment 逻辑保留为补充单元任务。

### 阶段 4：教师端改造

目标：

- 我的课程页显示真实课程。
- 真实课程下管理备课单元。
- 新建课程和新建单元分离。

交付：

- CoursesPage 改为课程组列表 + 单元列表。
- 新增“新建单元”入口。
- Workspace 顶部显示课程组上下文。
- 新路由逐步替代旧 `/preclass/courses/:courseId/...`。

### 阶段 5：清理与重命名

目标：

- 如果业务稳定，将 `Course` 语义正式重命名为 `CourseUnit`。

交付：

- 代码层重命名。
- API 文档更新。
- 删除旧兼容接口或保留版本化接口。

## 风险与注意事项

### 风险 1：教师端工作台被误改成整门课程粒度

不要这么做。课件、PPT、教案、思维导图都应该挂在单元上。

### 风险 2：学情画像重复计算

课程画像是单元画像的聚合，不应简单复制一份。推荐：

- 实时统计答题数据。
- AI 总结可持久化。
- 单元画像继续单独持久化。

### 风险 3：接口命名混乱

短期必须在文档里明确：

- `courseGroup` = 真实课程。
- `course` 或 `unit` = 当前教学单元兼容对象。

### 风险 4：管理端和学生端迁移顺序

建议先改学生端聚合展示，再改管理端分配，最后改教师端。这样对已有备课功能影响最小。

## 建议优先级

推荐从以下最小闭环开始：

1. 新增 `CourseGroup` 和 `Course.groupId`。
2. devData 按 `grade + subject` 建组。
3. 新增学生端课程组列表接口。
4. 学生课程中心先展示课程组。
5. 学情分析按课程组聚合。

完成这个闭环后，页面粒度问题就会明显改善，同时教师端原有备课能力不会被破坏。
