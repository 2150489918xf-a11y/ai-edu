# EduAI 后端接口契约草案

## 目标

把当前前端 mock 演示逐步替换成真实后端数据，第一阶段优先打通“牛顿第二定律”教学闭环中的学情分析：

```text
班级 -> 学生列表 -> 学生画像 -> 题目作答记录 -> 班级学情统计 -> 家长摘要
```

本文件先作为前后端对齐文档。后续开发时，前端的 `src/data/mockApi.js` 可以按同名语义逐步替换为 HTTP 请求。

## 本地数据库方案

推荐本地使用 Docker Compose 启动 PostgreSQL。

原因：

- 开发环境和后续服务器部署方式更接近，减少“本地可用、服务器不可用”的差异。
- 数据库版本、端口、账号、扩展能力可以固定下来。
- 配合迁移工具后，本地、测试、生产库的表结构可以保持一致。

建议第一版配置：

```yaml
services:
  postgres:
    image: postgres:16
    container_name: eduai-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: eduai_dev
      POSTGRES_USER: eduai
      POSTGRES_PASSWORD: eduai_dev_password
    volumes:
      - eduai_pg_data:/var/lib/postgresql/data

volumes:
  eduai_pg_data:
```

本地 `.env` 建议：

```bash
DATABASE_URL="postgresql://eduai:eduai_dev_password@127.0.0.1:5432/eduai_dev?schema=public"
POSTGRES_DB="eduai_dev"
POSTGRES_USER="eduai"
POSTGRES_PASSWORD="eduai_dev_password"
```

上线建议：

- 正式生产优先使用云厂商托管 PostgreSQL，备份、监控、恢复更稳。
- 如果预算有限，可以先在服务器上用 Docker 部署 PostgreSQL，但必须同时配置数据卷、定期备份、慢查询日志和恢复演练。
- 不管本地还是线上，都用迁移文件管理表结构，避免手工改库。

## 技术选型建议

- 数据库：PostgreSQL 16
- ORM：Prisma
- 后端框架：第一版可以用 Node.js + Express 或 NestJS
- 接口风格：REST API
- 认证：第一阶段可先 mock teacherId，后续接入登录后改为 JWT 或 Session

取舍：

| 方案 | 优点 | 代价 | 建议 |
| --- | --- | --- | --- |
| Express + Prisma | 上手快，适合当前 MVP | 大项目需要自己整理模块边界 | 第一阶段推荐 |
| NestJS + Prisma | 模块化和规范更强 | 初始样板代码更多 | 后续多人协作时推荐 |
| 直接 SQL | 可控、性能透明 | CRUD 开发慢，类型约束弱 | 不作为第一阶段主方案 |

## API 通用规范

Base URL：

```text
/api/v1
```

请求与响应均使用 JSON。

成功响应格式：

```json
{
  "data": {},
  "meta": {
    "requestId": "req_20260707_001"
  }
}
```

列表响应格式：

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

错误响应格式：

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "学生不存在",
    "details": {}
  }
}
```

常用状态码：

| 状态码 | 场景 |
| --- | --- |
| 200 | 查询成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未登录 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 状态冲突或重复提交 |
| 500 | 服务端异常 |

## 核心数据模型

第一阶段表结构先覆盖演示闭环，不做过度扩展。

### classes

班级表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| name | text | 班级名称，例如“高一 3 班” |
| grade | text | 年级 |
| subject | text | 学科 |
| teacher_id | uuid | 任课老师 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### students

学生表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| name | text | 学生姓名 |
| class_id | uuid | 所属班级 |
| student_no | text | 学号 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### courses

课程或课题表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| title | text | 课题名称，例如“牛顿第二定律” |
| subject | text | 学科 |
| grade | text | 年级 |
| description | text | 简介 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### knowledge_points

知识点表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| course_id | uuid | 所属课程 |
| name | text | 知识点名称 |
| description | text | 说明 |
| parent_id | uuid | 父知识点，可为空 |

### questions

题目表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| course_id | uuid | 所属课程 |
| type | text | single_choice / multi_choice / judgment / fill_blank / calculation |
| difficulty | text | basic / medium / hard |
| title | text | 题干 |
| options | jsonb | 选项 |
| answer | jsonb | 标准答案 |
| analysis | text | 解析 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### question_knowledge_points

题目和知识点关联表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| question_id | uuid | 题目 ID |
| knowledge_point_id | uuid | 知识点 ID |

### classroom_sessions

课堂或测验场次表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| class_id | uuid | 班级 |
| course_id | uuid | 课程 |
| title | text | 场次名称 |
| status | text | draft / active / closed |
| started_at | timestamptz | 开始时间 |
| ended_at | timestamptz | 结束时间 |

### student_answers

学生答题记录表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| session_id | uuid | 课堂或测验场次 |
| student_id | uuid | 学生 |
| question_id | uuid | 题目 |
| answer | jsonb | 学生答案 |
| is_correct | boolean | 是否正确 |
| score | numeric | 得分 |
| duration_seconds | integer | 作答耗时 |
| submitted_at | timestamptz | 提交时间 |

### learning_profiles

学生画像聚合表，可由作答记录定时或实时生成。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| student_id | uuid | 学生 |
| course_id | uuid | 课程 |
| mastery | jsonb | 知识点掌握度 |
| weak_points | jsonb | 薄弱点 |
| mistake_reasons | jsonb | 错因诊断 |
| recommended_practice | jsonb | 推荐练习 |
| ai_conversation_summary | text | AI 问答摘要 |
| updated_at | timestamptz | 更新时间 |

### parent_summaries

家长摘要表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| student_id | uuid | 学生 |
| course_id | uuid | 课程 |
| weekly_status | text | 本周概况 |
| mastered | jsonb | 已掌握内容 |
| needs_attention | jsonb | 需关注内容 |
| suggestion | text | 建议 |
| generated_at | timestamptz | 生成时间 |

## 第一阶段接口

### 1. 获取班级列表

```http
GET /api/v1/classes
```

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| subject | string | 否 | 学科筛选 |
| grade | string | 否 | 年级筛选 |

Response：

```json
{
  "data": [
    {
      "id": "class-newton-001",
      "name": "高一 3 班",
      "grade": "高一",
      "subject": "物理",
      "studentCount": 43
    }
  ]
}
```

### 2. 获取学生列表

默认展示全部学生，支持按班级筛选。对应当前“学生画像”页默认列表。

```http
GET /api/v1/students
```

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| classId | string | 否 | 班级 ID |
| keyword | string | 否 | 学生姓名或学号搜索 |
| page | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

Response：

```json
{
  "data": [
    {
      "id": "stu-liming",
      "name": "李明",
      "classId": "class-newton-001",
      "className": "高一 3 班",
      "studentNo": "20260103",
      "attendance": "已完成",
      "practiceCount": 12,
      "avgMastery": 72,
      "lowestMastery": {
        "knowledgeId": "kp-resultant-force",
        "name": "合外力计算",
        "value": 48
      },
      "weakPoints": ["受力分析完整性", "摩擦力方向判断"],
      "aiConversationSummary": "多次追问合外力与加速度方向的关系。"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 43
  }
}
```

### 3. 获取班级学情分析

```http
GET /api/v1/learning/classes/{classId}/summary
```

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| courseId | string | 否 | 课程 ID，不传则取最近一次课堂 |
| sessionId | string | 否 | 指定课堂或测验场次 |

Response：

```json
{
  "data": {
    "classId": "class-newton-001",
    "className": "高一 3 班",
    "courseId": "course-newton-2",
    "lessonName": "牛顿第二定律",
    "totalStudents": 43,
    "submitted": 41,
    "avgAccuracy": 68,
    "updatedAt": "2026-07-07T09:30:00.000Z",
    "questionStats": [
      {
        "id": "q-newton-force-001",
        "title": "质量 2 kg 的小车受到 6 N 水平合外力，求加速度。",
        "accuracy": 56,
        "avgTimeSeconds": 68,
        "weakPoint": "F=ma 代入",
        "optionDistribution": [
          {
            "label": "A",
            "value": 8,
            "percent": 20,
            "note": "单位换算错误"
          }
        ]
      }
    ],
    "weakPoints": [
      {
        "id": "kp-resultant-force",
        "name": "合外力计算",
        "score": 69,
        "accuracy": 56,
        "impact": "18 人需要复盘摩擦力方向与合外力求解。"
      }
    ],
    "aiAdvice": "建议下节课先复盘受力分析，再安排 3 道合外力递进练习。"
  }
}
```

### 4. 获取学生画像详情

点击学生列表中的某个学生后进入详情页。

```http
GET /api/v1/students/{studentId}/profile
```

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| courseId | string | 否 | 课程 ID |

Response：

```json
{
  "data": {
    "id": "stu-liming",
    "name": "李明",
    "classId": "class-newton-001",
    "className": "高一 3 班",
    "mastery": [
      {
        "knowledgeId": "kp-newton-2",
        "name": "牛顿第二定律",
        "value": 86
      },
      {
        "knowledgeId": "kp-resultant-force",
        "name": "合外力计算",
        "value": 48
      }
    ],
    "weakPoints": ["合外力计算", "受力分析完整性"],
    "mistakeReasons": ["摩擦力方向判断不稳定", "未先画受力图"],
    "recommendedPractice": [
      {
        "questionId": "q-newton-force-002",
        "title": "含摩擦力的水平运动合外力计算",
        "reason": "针对合外力薄弱点"
      }
    ],
    "aiConversationSummary": "学生多次追问为什么加速度方向由合外力决定。"
  }
}
```

### 5. 获取家长摘要

```http
GET /api/v1/students/{studentId}/parent-summary
```

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| courseId | string | 否 | 课程 ID |

Response：

```json
{
  "data": {
    "studentId": "stu-liming",
    "studentName": "李明",
    "weeklyStatus": "本周已完成牛顿第二定律课堂检测和订正，基础公式掌握稳定。",
    "mastered": ["F=ma 基础代入", "合外力与加速度成正比"],
    "needsAttention": ["受力分析完整性", "摩擦力方向判断"],
    "suggestion": "建议每天完成 2 道合力计算题，订正时先画受力图。"
  }
}
```

### 6. 提交学生答案

学生端答题后写入真实数据库，后续用于统计学情。

```http
POST /api/v1/student-answers
```

Request：

```json
{
  "sessionId": "session-newton-001",
  "studentId": "stu-liming",
  "questionId": "q-newton-force-001",
  "answer": {
    "value": "3 m/s²"
  },
  "durationSeconds": 54
}
```

Response：

```json
{
  "data": {
    "id": "answer-001",
    "isCorrect": true,
    "score": 1,
    "analysis": "由 F=ma 得 a=F/m=6/2=3 m/s²。",
    "submittedAt": "2026-07-07T09:20:00.000Z"
  }
}
```

### 7. 获取题目作答记录

用于学生详情页底部“题目记录”。

```http
GET /api/v1/question-answer-records
```

Query：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| studentId | string | 否 | 学生 ID |
| classId | string | 否 | 班级 ID |
| courseId | string | 否 | 课程 ID |
| sessionId | string | 否 | 课堂或测验场次 |
| page | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20 |

Response：

```json
{
  "data": [
    {
      "id": "answer-001",
      "studentId": "stu-liming",
      "studentName": "李明",
      "questionId": "q-newton-force-001",
      "questionTitle": "质量 2 kg 的小车受到 6 N 水平合外力，求加速度。",
      "answer": {
        "value": "3 m/s²"
      },
      "isCorrect": true,
      "score": 1,
      "durationSeconds": 54,
      "submittedAt": "2026-07-07T09:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 12
  }
}
```

## 第二阶段接口

第二阶段再补齐备课、题库和 AI 生成能力。

| 模块 | 接口 |
| --- | --- |
| 课程 | `GET /api/v1/courses`、`GET /api/v1/courses/{courseId}` |
| 知识点 | `GET /api/v1/courses/{courseId}/knowledge-points` |
| 题库 | `GET /api/v1/questions`、`POST /api/v1/questions`、`GET /api/v1/questions/{questionId}` |
| 智能组卷 | `POST /api/v1/exam-papers/generate`、`POST /api/v1/exam-papers/{paperId}/save` |
| 思维导图 | `POST /api/v1/mindmaps/generate`、`GET /api/v1/courses/{courseId}/mindmap` |
| AI 问答 | `POST /api/v1/ai/student-chat` |
| AI 任务 | `GET /api/v1/ai/tasks/{taskId}` |

## 开发顺序建议

1. 新增 Docker Compose PostgreSQL。
2. 接入 Prisma，建立 schema 和迁移。
3. Seed 一份“牛顿第二定律”演示数据。
4. 实现 `classes` 和 `students` 查询接口。
5. 实现学生画像、班级学情、家长摘要查询接口。
6. 实现学生答题提交接口。
7. 前端把 `mockApi.js` 中对应函数切到真实 HTTP API。

## 验收标准

- 本地执行 `docker compose up -d` 后能启动 PostgreSQL。
- 后端执行迁移后能创建核心表。
- Seed 后数据库里存在“牛顿第二定律”课程、班级、学生、题目和作答记录。
- 前端学情分析页面能从真实接口读取学生列表，并支持按班级筛选。
- 点击学生后能从真实接口读取学生画像详情。
- 家长摘要不暴露班级排名和其他学生信息。
