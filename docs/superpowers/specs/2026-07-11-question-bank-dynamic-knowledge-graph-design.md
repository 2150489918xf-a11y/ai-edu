# 题库动态知识图谱设计

## 文档状态

- 状态：已确认，待实施计划
- 日期：2026-07-11
- 作用域：教师端单个题库

## 背景

当前知识图谱实现以课程分组为作用域，将整张图谱保存到 `CourseGroup.knowledgeGraph` JSON，并在教师侧边栏提供独立入口。这个模型与真实需求不符：知识图谱应由题库中的有效题目及其知识点动态构成，一个题库对应一张图谱；新增、编辑或删除题目后，图谱应增量更新。

当前题目已经包含 `Question.knowledge` JSON，部分课程题目还通过 `QuestionKnowledgePoint` 关联规范化知识点。新设计需要复用这些数据，并保留对学生画像、AI 练习和现有题库 CRUD 的兼容。

## 目标

- 一个题库对应一张知识图谱。
- 图谱入口位于题库详情页，不出现在教师端侧边栏。
- 图谱节点来源于题库内状态为 `active` 的题目知识点。
- 新增或编辑题目时只分析受影响的题目和局部节点，不全量重发题库。
- 删除题目时只撤销该题贡献的知识点关联和关系证据。
- 不同题目的知识点可以复用同一节点，并建立跨题语义关系。
- 支持教师编辑、锁定、隐藏、合并节点，维护人工关系和固定布局。
- AI 失败不能阻塞题目保存，也不能覆盖人工锁定内容。
- PostgreSQL 是图谱源数据；G6 所需 JSON 是查询时生成的渲染投影。

## 非目标

- 不引入 Neo4j 或其他图数据库。
- 不引入 Redis 任务队列。
- 不建设跨题库或全学科的总知识图谱。
- 不在第一版向学生端开放图谱编辑或浏览。
- 不让 AI 决定节点颜色、大小、坐标等展示参数。
- 不对人工数据执行自动硬删除。

## 架构决策

### 方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 整张图谱 JSON + 全量 AI 重建 | 实现简单 | 成本随题量增长、难以增量删除、人工修改易丢失 | 不采用 |
| PostgreSQL 规范化节点和关系 + 单题增量分析 | 可追踪、可编辑、成本稳定、与现有技术栈一致 | 数据表和事务逻辑更多 | 采用 |
| Neo4j + 独立任务系统 | 复杂图查询能力强 | 增加部署、学习和运维成本，当前规模无必要 | 暂不采用 |

### 核心原则

1. 题目是知识证据，知识点和关系是规范化数据。
2. 图谱 JSON 只是后端根据规范化数据生成的响应，不是源数据。
3. 单题变化只处理单题和受影响节点的局部邻域。
4. 人工修改优先级高于 AI 修改。
5. 低置信度关系允许保持“待关联”，不为视觉效果编造关系。

## 数据模型

### QuestionBank 扩展

- `graphRevision Int @default(0)`：节点、关系、证据或固定布局发生变化时递增。
- 版本号用于前端刷新、并发检查和可选的 HTTP ETag。

### KnowledgePoint 扩展

现有 `KnowledgePoint` 保留，并从仅属于课程调整为可以属于课程或题库：

- `courseId String?`：现有课程知识点继续使用。
- `bankId String?`：题库知识点使用。
- `canonicalKey String?`：题库内去重键，例如规范化后的 `牛顿第二定律`。
- `aliases Json @default("[]")`：别名，例如“牛二定律”。
- `category String?`：主题或知识簇名称。
- `source String @default("ai")`：`ai` 或 `manual`。
- `status String @default("active")`：`active`、`hidden`、`archived`。
- `manualLocked Boolean @default(false)`：锁定后 AI 不得更新该节点。
- `mergedIntoId String?`：节点合并后的目标节点，用于追踪和恢复。

服务层保证题库知识点使用 `bankId` 且 `courseId` 为空。题库内使用 `(bankId, canonicalKey)` 唯一约束，避免同名节点重复。

### QuestionKnowledgePoint 扩展

继续使用现有题目与知识点多对多关系，增加：

- `source String`：`explicit`、`ai` 或 `manual`。
- `confidence Float?`：AI 提取置信度。
- `manualLocked Boolean @default(false)`：人工关联不会被自动分析移除。
- `createdAt DateTime`、`updatedAt DateTime`。

### KnowledgeRelation

新增知识点关系表：

- `id`
- `bankId`
- `sourcePointId`
- `targetPointId`
- `type`：`co_occurrence`、`prerequisite`、`derivation`、`application`、`confusable`、`related`。
- `label`
- `source`：`question`、`ai`、`manual`。
- `confidence`
- `supportCount`
- `manualLocked`
- `status`
- `createdAt`、`updatedAt`

同一题库内使用 `(sourcePointId, targetPointId, type)` 去重。需要方向的关系保留方向；共同出现等无向关系在写入前统一节点顺序。

### KnowledgeRelationEvidence

记录关系的题目证据：

- `relationId`
- `questionId`
- `evidenceType`：`co_occurrence` 或 `semantic_context`。
- `createdAt`

删除题目时可以精准撤销关系证据。共同出现关系在证据归零后自动归档；AI 语义关系只要两端节点仍有有效题目支持就可以保留；人工关系不依赖题目证据自动删除。

### QuestionKnowledgeExtraction

每道题最多一条当前解析状态：

- `questionId`
- `contentHash`
- `status`：`pending`、`processing`、`ready`、`failed`。
- `promptVersion`
- `provider`、`model`
- `attempts`
- `errorMessage`
- `analyzedAt`
- `createdAt`、`updatedAt`

内容哈希由题干、选项、答案、解析和显式知识点生成。阶段、难度等非语义字段变化不触发重新提取。

### KnowledgeGraphNodeLayout

只保存教师主动固定的布局：

- `bankId`
- `knowledgePointId`
- `x`、`y`
- `pinned`
- `updatedAt`

没有固定坐标的节点继续由 G6 自动布局。语义数据与展示位置分开维护。

## 知识点提取与规范化

### 输入优先级

1. AI 生成题目已经返回结构化知识点时，直接进入规范化流程，不重复调用 AI。
2. 教师手动填写知识点时，将其视为显式知识点。
3. 题目没有知识点时，才提交该单题给 AI 提取。

AI 单题输入包括题干、选项、答案、解析、题库学科和年级，不包含整个题库题目正文。

### AI 输出

AI 返回结构化数据，而不是 G6 图谱参数：

```json
{
  "questionId": "question-id",
  "knowledgePoints": [
    {
      "name": "牛顿第二定律",
      "canonicalName": "牛顿第二定律",
      "aliases": ["牛二定律"],
      "category": "动力学",
      "confidence": 0.96
    }
  ],
  "relations": [
    {
      "source": "合外力",
      "target": "加速度",
      "type": "derivation",
      "label": "决定",
      "confidence": 0.84
    }
  ]
}
```

### 题库内去重

新知识点按以下顺序匹配：

1. `canonicalKey` 精确匹配。
2. 已有别名精确匹配。
3. 对名称相似的少量候选节点进行本地相似度筛选。
4. 只把新知识点和最多 20 个候选节点交给 AI 判断“同义、相关或无关”。
5. 低置信度结果不自动合并，标记为待教师确认。

第一版不依赖向量数据库。后续只有在单题库知识点数量显著增长、名称匹配效果不足时才评估 `pgvector`。

## 四层跨题关联规则

图谱按整个题库构建，不按题目分割，因此不同题目不会天然形成孤岛。

### 第一层：共享规范节点

不同题目中的“合力”“合外力”等同义词归并为同一个知识点节点。共享节点天然连接不同题目的知识结构。

### 第二层：题内共同出现

同一道题包含多个知识点时建立 `co_occurrence` 关系。每道题产生一条关系证据，边宽由有效证据数量决定。

### 第三层：局部 AI 语义关系

新建知识点后，只分析该节点与题库中最多 20 个候选邻居的语义关系，识别先修、推导、应用和易混淆关系。该过程不发送全部题目，也不重新分析未受影响的节点。

### 第四层：人工关系

教师可选择源节点和目标节点，填写关系类型、方向与名称。人工关系默认锁定，AI 不得覆盖或删除。

确实没有可信关系的节点显示为“待关联”。系统不强制生成虚假边。

## 增量生命周期

### 新增题目

1. 题目立即写入数据库。
2. 有显式知识点时同步规范化并建立关联；没有时创建 `pending` 解析任务。
3. AI 只处理这道题。
4. 服务合并或创建知识点，建立题目关联和题内关系证据。
5. 新节点执行局部候选关系分析。
6. `graphRevision` 在事务提交时递增。

### 编辑题目

1. 比较新的内容哈希。
2. 哈希没有变化时不重新提取。
3. 哈希变化时只重新分析当前题目。
4. 移除该题旧的自动关联和自动证据，保留人工锁定关联。
5. 如果 AI 返回时题目哈希已经再次变化，丢弃该过期结果。

### 删除题目

1. 归档题目并撤销其非锁定知识点关联。
2. 删除该题贡献的关系证据并更新 `supportCount`。
3. 证据归零的共同出现关系归档。
4. 没有任何有效题目关联的 AI 节点归档。
5. 人工创建或人工锁定的无题节点继续保留并显示“待关联”。
6. 与归档节点相连的自动边不进入图谱响应。

### 全量协调

全量协调不是日常操作，只在提取规则升级、数据修复或教师主动确认后执行。后台仍按单题或小批次处理，不能把全部题目放进一次模型请求。

## 人工编辑规则

### 编辑节点

教师可以修改名称、说明、分类和别名。保存后节点被标记为人工锁定，后续 AI 只能新增证据，不能覆盖节点字段。

### 合并节点

合并操作必须在数据库事务内完成：

1. 将源节点的题目关联迁移到目标节点，并去除重复关联。
2. 将源节点的入边和出边重定向到目标节点。
3. 合并重复关系及其证据。
4. 人工关系和人工字段优先保留。
5. 源节点设置为 `archived` 并记录 `mergedIntoId`。
6. 迁移前在界面预览受影响题目和关系数量。

### 隐藏与删除

- 有题目关联的节点不允许直接硬删除。
- 教师可以选择隐藏节点、解除关联或合并到其他节点。
- 手动创建且没有题目关联的节点继续保留为“待关联”。
- 题库被永久删除时，其题库知识点、关系、证据、解析状态和布局数据一起级联删除。

### 人工关系

教师进入“添加关系”模式，依次选择源节点和目标节点，再选择关系类型、方向和标签。人工关系默认 `manualLocked = true`。

## 图谱查询与 G6 投影

`GET knowledge-graph` 从规范化表聚合数据并返回：

```json
{
  "bank": { "id": "bank-id", "title": "牛顿第二定律题库" },
  "revision": 18,
  "stats": {
    "questionCount": 90,
    "analyzedCount": 86,
    "pendingCount": 3,
    "processingCount": 0,
    "failedCount": 1,
    "nodeCount": 24,
    "edgeCount": 39
  },
  "nodes": [
    {
      "id": "point-id",
      "label": "合外力",
      "category": "动力学",
      "source": "ai",
      "locked": false,
      "questionCount": 12,
      "orphan": false,
      "position": null
    }
  ],
  "edges": [
    {
      "id": "relation-id",
      "source": "point-a",
      "target": "point-b",
      "type": "co_occurrence",
      "label": "共同考查",
      "supportCount": 4,
      "sourceKind": "question"
    }
  ]
}
```

第一版不持久化整张图谱 JSON，也不增加图谱快照表。如果后续聚合成为性能瓶颈，可以增加以 `(bankId, graphRevision)` 为键的派生缓存；版本变化后直接丢弃缓存，不对缓存 JSON 做节点级修改。

## 异步任务

- PostgreSQL 中的 `QuestionKnowledgeExtraction` 是任务状态来源。
- 后端启动轻量处理器轮询 `pending` 任务，并在进程重启后继续未完成任务。
- 单题失败最多自动重试三次，采用递增等待时间。
- AI 不可用时题目仍保存成功，任务标记为 `failed`。
- 教师可以手动填写知识点或重试失败题目。
- 前端只在存在 `pending` 或 `processing` 任务时短暂轮询图谱状态。
- 已完成的节点始终显示，解析过程中不使用覆盖整个画布的加载状态。

当前规模不需要 Redis。只有在任务吞吐量需要独立扩缩容或出现多服务器竞争处理时再引入外部队列。

## 页面与交互

### 入口和路由

- 从教师侧边栏移除“知识图谱”。
- 在题库详情页顶部操作区增加“知识图谱”按钮。
- 新路由：`/question-banks/:bankId/knowledge-graph`。
- 页面是题库工作流的子页面，返回时回到原题库。

### 页面结构

```text
[返回题库]  题库名称 · 知识图谱      已解析 86/90 题

[搜索] [节点筛选] [关系筛选] [仅看邻域] [重新布局] [解析未完成题目]

┌────────────────────────────────┬──────────────┐
│                                │ 节点/关系详情 │
│        AntV G6 图谱画布         │ 编辑与关联题目 │
│                                │ 合并/隐藏操作  │
└────────────────────────────────┴──────────────┘
```

### 视觉编码

- 节点大小由有效关联题目数量计算。
- 节点颜色由知识主题或知识簇决定。
- 节点边框区分 AI、人工和人工锁定状态。
- 实线表示题目共同考查，虚线表示 AI 语义关系，人工关系使用强调样式。
- 点击节点时突出一到两层邻域并淡化无关节点。
- 搜索、缩放、拖动、关联数量筛选和邻域模式用于控制大图复杂度。
- G6 负责布局和交互；AI 不生成颜色、大小或坐标。

### 右侧详情抽屉

节点详情包含：名称、说明、分类、别名、来源、锁定状态、关联题目、相邻关系和操作区。教师可以跳转到关联题目，也可以手动关联或解除关联题目。关联题目在选中节点后通过独立详情接口按需读取，避免把大量重复题目摘要塞进整张图谱响应。

边详情包含：关系类型、方向、标签、来源、置信度和支持题目数量。自动关系可隐藏，人工关系可编辑或删除。

## API

### 图谱与解析

- `GET /api/v1/question-banks/:bankId/knowledge-graph`
- `POST /api/v1/question-banks/:bankId/knowledge-graph/analyze-pending`
- `POST /api/v1/question-banks/:bankId/knowledge-graph/reconcile`
- `POST /api/v1/questions/:questionId/knowledge-extraction/retry`

`reconcile` 必须由教师主动确认，后台按单题或小批次运行，不执行单次全题库模型请求。

### 节点

- `GET /api/v1/question-banks/:bankId/knowledge-points/:pointId`
- `PATCH /api/v1/question-banks/:bankId/knowledge-points/:pointId`
- `POST /api/v1/question-banks/:bankId/knowledge-points`
- `POST /api/v1/question-banks/:bankId/knowledge-points/:pointId/merge`
- `DELETE /api/v1/question-banks/:bankId/knowledge-points/:pointId?mode=hide|unlink`

节点写接口接收客户端最后读取的 `graphRevision`。版本冲突返回 409，并要求前端刷新后重试。

### 关系与布局

- `POST /api/v1/question-banks/:bankId/knowledge-relations`
- `PATCH /api/v1/question-banks/:bankId/knowledge-relations/:relationId`
- `DELETE /api/v1/question-banks/:bankId/knowledge-relations/:relationId`
- `PUT /api/v1/question-banks/:bankId/knowledge-graph/layout`

所有接口必须验证当前登录角色具有教师权限，并按现有题库访问规则检查题库是否可管理，不能仅依赖前端传入的题库 id。本设计不额外引入题库多租户归属模型。

## 错误处理

| HTTP | 错误码 | 场景 |
|---|---|---|
| 400 | `INVALID_KNOWLEDGE_GRAPH_PAYLOAD` | 节点或关系参数非法 |
| 404 | `QUESTION_BANK_NOT_FOUND` | 题库不存在 |
| 404 | `KNOWLEDGE_POINT_NOT_FOUND` | 节点不存在或不属于当前题库 |
| 409 | `GRAPH_REVISION_CONFLICT` | 基于过期图谱版本提交编辑 |
| 409 | `KNOWLEDGE_POINT_HAS_QUESTIONS` | 尝试硬删除仍有关联题目的节点 |
| 409 | `KNOWLEDGE_POINT_MERGE_CONFLICT` | 合并目标非法或会形成自关系 |
| 502 | `AI_PROVIDER_ERROR` | 手动触发解析时 AI 服务不可用 |

异步 AI 失败主要记录在解析任务中，不使题目 CRUD 接口失败。

## 兼容与迁移

1. 增加题库图谱规范化字段和新表。
2. 将现有 `Question.knowledge` 数组按题库回填为知识点和题目关联，不调用 AI。
3. 对知识点为空的题目创建待解析任务。
4. 暂时保留 `Question.knowledge` 作为兼容镜像；节点关联变化时同步更新该数组。
5. 保证学生画像、AI 个性化练习和现有题目展示仍能读取兼容数据。
6. 将现有 G6 渲染器改为接收题库图谱投影和编辑事件。
7. 删除教师侧边栏入口，将页面改为题库子路由。
8. 删除课程分组知识图谱 API、课程服务方法和 `CourseGroup.knowledgeGraph` 字段。
9. 替换现有以课程分组为中心的知识图谱测试。

当前课程分组图谱是错误作用域下的派生数据，不迁移到题库图谱。

## 测试策略

### 单元测试

- 规范名称和别名去重。
- 单题内容哈希及过期结果丢弃。
- 四层关系生成规则。
- 人工锁定优先级。
- 节点合并后的关联和边去重。
- 删除题目后的证据计数和孤立节点规则。
- AI 结构化输出解析和畸形响应处理。

### 数据库集成测试

- 新增一题只创建该题的解析记录和关联。
- 编辑一题只替换该题的自动关联。
- 删除一题只撤销该题证据。
- 人工节点在没有题目关联时仍保留。
- 合并操作在事务中完整迁移数据。
- 删除题库时级联清理图谱数据。
- 现有课程知识点和学情分析不受题库知识点扩展影响。

### API 测试

- 图谱查询返回统计、节点、边和版本。
- 节点、关系、合并、隐藏、布局接口的成功及错误响应。
- 版本冲突返回 409。
- 解析失败不影响题目创建。
- 跨题节点复用和语义关系能够通过接口读取。

### 前端与浏览器测试

- 侧边栏不再出现知识图谱入口。
- 题库详情按钮进入正确题库的图谱。
- 画布可以缩放、拖动、搜索和查看邻域。
- 解析长任务不会覆盖或清空现有画布。
- 右侧抽屉可以编辑、锁定、合并、隐藏和关联节点。
- 固定位置和人工编辑刷新后仍存在。
- 大量节点时页面没有被画布或侧栏遮挡，页面可正常滚动和自适应。

### 回归与性能验证

- 运行题库 CRUD、AI 出题、学生画像、课程删除和生产构建测试。
- 使用至少 1000 道题、200 个知识点的测试数据验证聚合查询和 G6 交互。
- 验证新增单题不会产生全题库 AI 请求，模型输入规模不随历史题目数线性增长。

## 验收标准

- 一个题库只展示自己的知识图谱。
- 新增、编辑和删除题目后图谱增量更新。
- 相同或别名知识点跨题复用同一节点。
- 不同题目的知识点可以通过局部 AI 或人工建立关系。
- 删除题目只删除该题贡献的自动证据。
- 人工节点、关系、锁定状态和固定位置持久化。
- AI 失败时题库和已有图谱仍可使用。
- 图谱刷新不依赖 `CourseGroup.knowledgeGraph` 或其他整图 JSON。
- 教师侧边栏没有独立知识图谱入口。

## 重新评估触发条件

满足以下任一条件时重新评估缓存、外部任务队列或图数据库：

- 单个题库稳定超过 1000 个知识点，而不仅是 1000 道题。
- 图谱聚合查询在索引和邻域过滤后仍无法满足交互要求。
- AI 解析需要独立扩缩容、多机抢占或跨服务调度。
- 产品需要跨题库、多学科的深层路径查询和图算法。
