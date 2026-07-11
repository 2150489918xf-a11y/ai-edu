# Question Bank Dynamic Knowledge Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the course-group JSON knowledge graph with one incrementally maintained, editable knowledge graph for each question bank.

**Architecture:** PostgreSQL stores bank-scoped knowledge points, question evidence, semantic relations, extraction state, and pinned positions. Question CRUD synchronizes only the changed question; a lightweight worker analyzes missing knowledge asynchronously, while the graph API projects normalized rows into AntV G6 data without persisting a monolithic graph JSON.

**Tech Stack:** Vue 3, Vue Router, AntV G6 5, Node.js HTTP server, Prisma 6, PostgreSQL, OpenAI/DeepSeek-compatible APIs, Node `assert` tests.

---

## File responsibility map

### New backend files

- `server/services/questionKnowledgeGraphDomain.js`: pure canonicalization, hashing, extraction normalization, candidate scoring, and relation-pair helpers.
- `server/services/aiQuestionKnowledgeService.js`: OpenAI/DeepSeek single-question extraction and bounded cross-node relation classification.
- `server/services/questionKnowledgeGraphService.js`: all Prisma transactions for graph projection, question lifecycle synchronization, node editing, relation editing, merge, and layout persistence.
- `server/services/questionKnowledgeWorker.js`: claims persistent extraction jobs and processes them without Redis.
- `prisma/backfillQuestionBankKnowledgeGraph.js`: dry-run-capable migration of existing `Question.knowledge` and existing question-point links into bank-scoped nodes.

### New frontend files

- `src/pages/QuestionBankKnowledgeGraphPage.vue`: route-level orchestration, graph polling, filters, selection, and mutations.
- `src/components/knowledge/KnowledgeGraphInspector.vue`: node/edge detail drawer and manual edit forms.

### Modified files

- `prisma/schema.prisma`: normalized graph models and indexes; final removal of `CourseGroup.knowledgeGraph`.
- `prisma/seed.js`, `prisma/devData.js`: seed normalized bank knowledge data or invoke the same backfill helper.
- `server/services/questionBankService.js`: notify the graph service after question create, semantic update, and archive.
- `server/app.js`, `server/index.js`: graph routes, service wiring, worker startup and shutdown.
- `server/services/courseService.js`: remove course-group graph JSON behavior after replacement is live.
- `src/data/questionBankApiClient.js`: graph, node, relation, extraction, and layout calls.
- `src/data/courseApiClient.js`: remove course-group graph calls.
- `src/pages/QuestionBankDetailPage.vue`: add the graph entry button.
- `src/components/knowledge/KnowledgeGraphRenderer.vue`: render bank knowledge nodes, relation styles, neighborhood focus, selection, and pinned positions.
- `src/router.js`, `src/App.vue`: nested question-bank route and removal of the standalone navigation entry.
- `package.json`: focused knowledge-graph test and backfill scripts.

### Removed legacy files

- `server/services/aiKnowledgeGraphService.js`
- `src/pages/KnowledgeGraphPage.vue`
- `tests/knowledgeGraphIntegration.test.mjs`

### New tests

- `tests/questionKnowledgeGraphSchema.test.mjs`
- `tests/questionKnowledgeGraphDomain.test.mjs`
- `tests/aiQuestionKnowledgeService.test.mjs`
- `tests/questionKnowledgeGraphDb.test.mjs`
- `tests/questionKnowledgeGraphApi.test.mjs`
- `tests/questionKnowledgeWorker.test.mjs`
- `tests/questionKnowledgeGraphManualEditing.test.mjs`
- `tests/questionBankKnowledgeGraphPage.test.mjs`
- `tests/questionKnowledgeGraphRenderer.test.mjs`
- `tests/questionKnowledgeGraphBackfill.test.mjs`

---

### Task 1: Add the normalized PostgreSQL graph schema

**Files:**
- Create: `tests/questionKnowledgeGraphSchema.test.mjs`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the failing schema contract**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

for (const marker of [
  'graphRevision',
  'canonicalKey',
  'model KnowledgeRelation',
  'model KnowledgeRelationEvidence',
  'model QuestionKnowledgeExtraction',
  'model KnowledgeGraphNodeLayout'
]) {
  assert.ok(schema.includes(marker), `schema should include ${marker}`);
}

assert.match(schema, /bankId\s+String\?/);
assert.match(schema, /manualLocked\s+Boolean/);
console.log('question knowledge graph schema contract passed');
```

- [ ] **Step 2: Run the schema test and verify the missing-model failure**

Run: `node tests/questionKnowledgeGraphSchema.test.mjs`

Expected: FAIL with `schema should include graphRevision`.

- [ ] **Step 3: Extend `QuestionBank`, `KnowledgePoint`, `Question`, and `QuestionKnowledgePoint`**

Add these fields and relations while temporarily retaining `CourseGroup.knowledgeGraph` until Task 8:

```prisma
model QuestionBank {
  // existing fields
  graphRevision    Int                        @default(0) @map("graph_revision")
  knowledgePoints  KnowledgePoint[]
  relations        KnowledgeRelation[]
  layouts          KnowledgeGraphNodeLayout[]
}

model KnowledgePoint {
  // existing fields
  courseId          String?                    @map("course_id")
  course            Course?                    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  bankId            String?                    @map("bank_id")
  bank              QuestionBank?              @relation(fields: [bankId], references: [id], onDelete: Cascade)
  canonicalKey      String?                    @map("canonical_key")
  aliases           Json                       @default("[]")
  category          String?
  source            String                     @default("ai")
  status            String                     @default("active")
  manualLocked      Boolean                    @default(false) @map("manual_locked")
  mergedIntoId      String?                    @map("merged_into_id")
  mergedInto        KnowledgePoint?            @relation("KnowledgePointMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedFrom        KnowledgePoint[]           @relation("KnowledgePointMerge")
  outgoingRelations KnowledgeRelation[]        @relation("KnowledgeRelationSource")
  incomingRelations KnowledgeRelation[]        @relation("KnowledgeRelationTarget")
  layouts           KnowledgeGraphNodeLayout[]

  @@unique([bankId, canonicalKey])
  @@index([bankId, status])
}

model Question {
  // existing fields
  knowledgeExtraction QuestionKnowledgeExtraction?
  relationEvidence    KnowledgeRelationEvidence[]
}

model QuestionKnowledgePoint {
  // existing fields
  source       String   @default("explicit")
  confidence   Float?
  manualLocked Boolean  @default(false) @map("manual_locked")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
}
```

- [ ] **Step 4: Add relation, evidence, extraction, and layout models**

```prisma
model KnowledgeRelation {
  id              String                      @id @default(uuid())
  bankId          String                      @map("bank_id")
  bank            QuestionBank                @relation(fields: [bankId], references: [id], onDelete: Cascade)
  sourcePointId   String                      @map("source_point_id")
  sourcePoint     KnowledgePoint              @relation("KnowledgeRelationSource", fields: [sourcePointId], references: [id], onDelete: Cascade)
  targetPointId   String                      @map("target_point_id")
  targetPoint     KnowledgePoint              @relation("KnowledgeRelationTarget", fields: [targetPointId], references: [id], onDelete: Cascade)
  type            String
  label           String
  source          String
  confidence      Float?
  supportCount    Int                         @default(0) @map("support_count")
  manualLocked    Boolean                     @default(false) @map("manual_locked")
  status          String                      @default("active")
  evidence        KnowledgeRelationEvidence[]
  createdAt       DateTime                    @default(now()) @map("created_at")
  updatedAt       DateTime                    @updatedAt @map("updated_at")

  @@unique([bankId, sourcePointId, targetPointId, type])
  @@index([bankId, status])
  @@map("knowledge_relations")
}

model KnowledgeRelationEvidence {
  relationId  String            @map("relation_id")
  questionId  String            @map("question_id")
  relation    KnowledgeRelation @relation(fields: [relationId], references: [id], onDelete: Cascade)
  question    Question          @relation(fields: [questionId], references: [id], onDelete: Cascade)
  evidenceType String           @map("evidence_type")
  createdAt   DateTime          @default(now()) @map("created_at")

  @@id([relationId, questionId])
  @@map("knowledge_relation_evidence")
}

model QuestionKnowledgeExtraction {
  questionId   String    @id @map("question_id")
  question     Question  @relation(fields: [questionId], references: [id], onDelete: Cascade)
  contentHash  String    @map("content_hash")
  status       String    @default("pending")
  promptVersion String   @default("v1") @map("prompt_version")
  provider     String?
  model        String?
  attempts     Int       @default(0)
  errorMessage String?   @map("error_message")
  analyzedAt   DateTime? @map("analyzed_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@index([status, updatedAt])
  @@map("question_knowledge_extractions")
}

model KnowledgeGraphNodeLayout {
  bankId           String         @map("bank_id")
  knowledgePointId String         @map("knowledge_point_id")
  bank             QuestionBank   @relation(fields: [bankId], references: [id], onDelete: Cascade)
  knowledgePoint   KnowledgePoint @relation(fields: [knowledgePointId], references: [id], onDelete: Cascade)
  x                Float
  y                Float
  pinned           Boolean        @default(true)
  updatedAt        DateTime       @updatedAt @map("updated_at")

  @@id([bankId, knowledgePointId])
  @@map("knowledge_graph_node_layouts")
}
```

- [ ] **Step 5: Generate the Prisma client and update local PostgreSQL**

Run: `npx prisma generate`

Expected: Prisma Client generation succeeds.

Run: `npx prisma db push`

Expected: Database schema synchronizes without deleting the legacy graph column yet.

- [ ] **Step 6: Re-run the schema contract**

Run: `node tests/questionKnowledgeGraphSchema.test.mjs`

Expected: PASS with `question knowledge graph schema contract passed`.

- [ ] **Step 7: Commit the schema slice**

```powershell
git add prisma/schema.prisma tests/questionKnowledgeGraphSchema.test.mjs
git commit -m "feat: add normalized question bank graph schema"
```

---

### Task 2: Implement pure graph-domain helpers and single-question AI extraction

**Files:**
- Create: `server/services/questionKnowledgeGraphDomain.js`
- Create: `server/services/aiQuestionKnowledgeService.js`
- Create: `tests/questionKnowledgeGraphDomain.test.mjs`
- Create: `tests/aiQuestionKnowledgeService.test.mjs`

- [ ] **Step 1: Write failing canonicalization, hashing, and pair tests**

```js
import assert from 'node:assert/strict';
import {
  buildQuestionContentHash,
  canonicalKnowledgeKey,
  buildCoOccurrencePairs,
  normalizeExtractionPayload
} from '../server/services/questionKnowledgeGraphDomain.js';

assert.equal(canonicalKnowledgeKey(' 合 外 力（计算） '), '合外力计算');
assert.equal(
  buildQuestionContentHash({ title: 'F=ma', options: ['A'], answer: 'A', analysis: '解析', knowledge: ['力'] }),
  buildQuestionContentHash({ title: 'F=ma', options: ['A'], answer: 'A', analysis: '解析', knowledge: ['力'] })
);
assert.deepEqual(buildCoOccurrencePairs(['a', 'b', 'c']), [['a', 'b'], ['a', 'c'], ['b', 'c']]);
const normalized = normalizeExtractionPayload({
  knowledgePoints: [{ name: '牛二定律', canonicalName: '牛顿第二定律', confidence: 2 }],
  relations: []
});
assert.equal(normalized.knowledgePoints[0].canonicalKey, '牛顿第二定律');
assert.equal(normalized.knowledgePoints[0].confidence, 1);
console.log('question knowledge graph domain tests passed');
```

- [ ] **Step 2: Run the domain test and verify import failure**

Run: `node tests/questionKnowledgeGraphDomain.test.mjs`

Expected: FAIL with module-not-found for `questionKnowledgeGraphDomain.js`.

- [ ] **Step 3: Implement the pure domain API**

Export these exact functions from `questionKnowledgeGraphDomain.js`:

```js
export function canonicalKnowledgeKey(value) {}
export function buildQuestionContentHash(question) {}
export function normalizeExtractionPayload(payload = {}) {}
export function buildCoOccurrencePairs(pointIds = []) {}
export function scoreKnowledgeCandidate(source, candidate) {}
export function selectRelationCandidates(source, candidates, limit = 20) {}
export function normalizeUndirectedPair(sourceId, targetId) {}
```

Use `node:crypto` SHA-256 for the content hash, Unicode NFKC normalization, punctuation/whitespace removal for canonical keys, confidence clamping to `0..1`, stable pair ordering for `co_occurrence`, and deterministic candidate sorting.

- [ ] **Step 4: Write failing DeepSeek extraction and local-fallback tests**

```js
import assert from 'node:assert/strict';
import { createAiQuestionKnowledgeService } from '../server/services/aiQuestionKnowledgeService.js';

const calls = [];
const service = createAiQuestionKnowledgeService({
  env: { DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'deepseek-test' },
  fetchImpl: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: '{"knowledgePoints":[{"name":"合力","canonicalName":"合外力"}],"relations":[]}' } }] };
      }
    };
  }
});

const result = await service.extractQuestionKnowledge({
  bank: { subject: '物理', grade: '高一' },
  question: { id: 'q1', title: '求合力', options: [], answer: '6N', analysis: '' }
});
assert.equal(result.knowledgePoints[0].canonicalKey, '合外力');
assert.equal(calls.length, 1);
assert.ok(calls[0].body.messages[0].content.includes('学生题目知识点提取'));

const local = createAiQuestionKnowledgeService({ env: {}, fetchImpl: async () => { throw new Error('must not call'); } });
const localResult = await local.extractQuestionKnowledge({
  bank: {},
  question: { id: 'q2', title: '题目', knowledge: ['牛顿第二定律'] }
});
assert.equal(localResult.provider, 'explicit');
assert.equal(localResult.knowledgePoints.length, 1);
console.log('AI question knowledge service tests passed');
```

- [ ] **Step 5: Run the AI service test and verify import failure**

Run: `node tests/aiQuestionKnowledgeService.test.mjs`

Expected: FAIL with module-not-found for `aiQuestionKnowledgeService.js`.

- [ ] **Step 6: Implement the AI service**

Export:

```js
export function createAiQuestionKnowledgeService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return {
    async extractQuestionKnowledge({ bank, question }) {},
    async classifyKnowledgeRelations({ bank, point, candidates }) {}
  };
}
```

The service must:

- prefer explicit `question.knowledge` without a provider call;
- call OpenAI Responses when `OPENAI_API_KEY` exists;
- otherwise call DeepSeek chat completions when `DEEPSEEK_API_KEY` exists;
- send only one question for extraction;
- send one new point plus at most 20 candidate node summaries for relation classification;
- parse plain JSON or a fenced/marked JSON block;
- normalize every response with `normalizeExtractionPayload`;
- return an empty, non-failing local result when no key and no explicit knowledge exist.

- [ ] **Step 7: Run both unit tests**

Run: `node tests/questionKnowledgeGraphDomain.test.mjs`

Expected: PASS.

Run: `node tests/aiQuestionKnowledgeService.test.mjs`

Expected: PASS and exactly one mocked provider call.

- [ ] **Step 8: Commit the domain and provider slice**

```powershell
git add server/services/questionKnowledgeGraphDomain.js server/services/aiQuestionKnowledgeService.js tests/questionKnowledgeGraphDomain.test.mjs tests/aiQuestionKnowledgeService.test.mjs
git commit -m "feat: extract question knowledge incrementally"
```

---

### Task 3: Build incremental Prisma synchronization and graph projection

**Files:**
- Create: `server/services/questionKnowledgeGraphService.js`
- Create: `tests/questionKnowledgeGraphDb.test.mjs`
- Modify: `server/services/questionBankService.js`

- [ ] **Step 1: Write a database test for create, cross-question reuse, update, and archive**

The fixture must create one bank and these questions:

```js
const q1 = await questionBankService.createQuestion(bank.id, {
  type: 'single_choice', difficulty: 'basic', title: '由合外力求加速度',
  options: ['A', 'B'], answer: 'A', knowledge: ['合外力', '加速度']
});
const q2 = await questionBankService.createQuestion(bank.id, {
  type: 'blank', difficulty: 'basic', title: '牛顿第二定律表达式',
  answer: 'F=ma', knowledge: ['牛顿第二定律', '合外力']
});
```

Assert:

```js
const graph = await graphService.getGraph(bank.id);
assert.equal(graph.nodes.filter((node) => node.label === '合外力').length, 1);
assert.equal(graph.stats.questionCount, 2);
assert.ok(graph.edges.some((edge) => edge.type === 'co_occurrence'));

await questionBankService.archiveQuestion(q1.id);
const afterDelete = await graphService.getGraph(bank.id);
assert.equal(afterDelete.stats.questionCount, 1);
assert.ok(afterDelete.edges.every((edge) => edge.supportCount >= 1));
assert.equal(await prisma.knowledgeRelationEvidence.count({ where: { questionId: q1.id } }), 0);
```

- [ ] **Step 2: Run the DB test and verify missing service failure**

Run: `node tests/questionKnowledgeGraphDb.test.mjs`

Expected: FAIL because `createQuestionKnowledgeGraphService` does not exist.

- [ ] **Step 3: Implement graph service lifecycle methods**

Export this interface:

```js
export function createQuestionKnowledgeGraphService(prisma, { aiQuestionKnowledgeService } = {}) {
  return {
    getGraph,
    getKnowledgePointDetail,
    queueQuestionExtraction,
    synchronizeExplicitKnowledge,
    processQuestionExtraction,
    processNextPendingExtraction,
    retryQuestionExtraction,
    handleQuestionCreated,
    handleQuestionUpdated,
    handleQuestionArchived,
    analyzePending,
    reconcileBank
  };
}
```

Implementation requirements:

- `synchronizeExplicitKnowledge` upserts bank-scoped nodes by `(bankId, canonicalKey)` and creates `QuestionKnowledgePoint` rows.
- Existing course-scoped points are not mutated; bank graph links use bank-scoped point rows.
- Co-occurrence edges are created from stable pairs, with one evidence row per question.
- `processQuestionExtraction` checks the current content hash before applying AI output.
- new or changed nodes are compared with at most 20 candidates and passed to `classifyKnowledgeRelations`; existing unrelated questions are never resent.
- Every successful graph mutation increments `QuestionBank.graphRevision` inside the same transaction.
- `getGraph` counts only active questions and active/non-hidden bank points.
- `getKnowledgePointDetail` returns one node, its active question summaries, and adjacent relations on demand.
- Node size inputs are `questionCount`; edges expose `supportCount`, `sourceKind`, and relation type.
- `Question.knowledge` remains a synchronized compatibility mirror.

- [ ] **Step 4: Inject lifecycle hooks into question CRUD**

Change the factory signature without breaking existing callers:

```js
export function createQuestionBankService(prisma, { questionKnowledgeGraphService = null } = {}) {}
```

Call:

```js
await questionKnowledgeGraphService?.handleQuestionCreated(question);
await questionKnowledgeGraphService?.handleQuestionUpdated(existing, question);
await questionKnowledgeGraphService?.handleQuestionArchived(existing);
```

Only title/options/answer/analysis/knowledge changes trigger semantic synchronization. Stage, difficulty, and accuracy changes do not create extraction jobs.
Lifecycle hooks must absorb AI/provider failures by leaving or creating a persistent extraction job; successful question CRUD must not be rolled back because an AI call failed.

- [ ] **Step 5: Run DB and existing question-bank tests**

Run: `node tests/questionKnowledgeGraphDb.test.mjs`

Expected: PASS.

Run: `node tests/questionBankCrudDb.test.mjs`

Expected: PASS with the optional graph dependency omitted.

- [ ] **Step 6: Commit incremental persistence**

```powershell
git add server/services/questionKnowledgeGraphService.js server/services/questionBankService.js tests/questionKnowledgeGraphDb.test.mjs
git commit -m "feat: maintain question bank graphs incrementally"
```

---

### Task 4: Add persistent job processing and graph read/extraction APIs

**Files:**
- Create: `server/services/questionKnowledgeWorker.js`
- Create: `tests/questionKnowledgeGraphApi.test.mjs`
- Create: `tests/questionKnowledgeWorker.test.mjs`
- Modify: `server/app.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing API contracts**

Create a mock graph service and assert these routes:

```js
const graphService = {
  async getGraph(bankId) { return { bank: { id: bankId }, revision: 3, stats: {}, nodes: [], edges: [] }; },
  async getKnowledgePointDetail(bankId, pointId) { return { id: pointId, bankId, questions: [] }; },
  async analyzePending(bankId) { return { bankId, queued: 2 }; },
  async reconcileBank(bankId) { return { bankId, queued: 4 }; },
  async retryQuestionExtraction(questionId) { return { questionId, status: 'pending' }; }
};
```

Verify:

- `GET /api/v1/question-banks/bank-1/knowledge-graph` returns revision 3.
- `GET /api/v1/question-banks/bank-1/knowledge-points/point-1` returns the selected node detail.
- `POST /api/v1/question-banks/bank-1/knowledge-graph/analyze-pending` returns queued 2.
- `POST /api/v1/question-banks/bank-1/knowledge-graph/reconcile` returns queued 4.
- `POST /api/v1/questions/q1/knowledge-extraction/retry` returns pending.

- [ ] **Step 2: Run the API test and verify 404 responses**

Run: `node tests/questionKnowledgeGraphApi.test.mjs`

Expected: FAIL because the graph routes do not exist.

- [ ] **Step 3: Add graph routes before generic bank/question matches**

Extend `createLearningApiApp` with optional `questionKnowledgeGraphService` and route the five endpoints exactly as tested. Decode every id and use existing `readJsonBody`, `sendJson`, and `sendError` behavior.

- [ ] **Step 4: Implement a restart-safe worker**

Export:

```js
export function createQuestionKnowledgeWorker({ graphService, intervalMs = 1500 } = {}) {
  return {
    async runOnce() {},
    start() {},
    async stop() {}
  };
}
```

`runOnce` calls `graphService.processNextPendingExtraction()`. That service method atomically claims one `pending` or stale `processing` extraction, increments attempts, processes the claimed question, marks failures, and allows at most three automatic attempts. `start` uses one non-overlapping timer; `stop` clears the timer and waits for the active promise.

- [ ] **Step 5: Write and run the worker concurrency test**

Use a fake graph service whose `processNextPendingExtraction` waits on a controlled promise. Call `runOnce()` twice concurrently and assert the fake processor runs once; call `stop()` and assert it waits for the controlled promise before resolving.

Run: `node tests/questionKnowledgeWorker.test.mjs`

Expected: PASS with one processed job and no overlapping timer execution.

- [ ] **Step 6: Wire services and worker lifecycle in `server/index.js`**

Construct in this order:

```js
const aiQuestionKnowledgeService = createAiQuestionKnowledgeService();
const questionKnowledgeGraphService = createQuestionKnowledgeGraphService(prisma, { aiQuestionKnowledgeService });
const questionBankService = createQuestionBankService(prisma, { questionKnowledgeGraphService });
const questionKnowledgeWorker = createQuestionKnowledgeWorker({ graphService: questionKnowledgeGraphService });
```

Pass the graph service into `createLearningApiApp`, call `questionKnowledgeWorker.start()` after server startup, and await `questionKnowledgeWorker.stop()` before Prisma disconnect on shutdown.

- [ ] **Step 7: Run API and backend regression tests**

Run: `node tests/questionKnowledgeGraphApi.test.mjs`

Expected: PASS.

Run: `node tests/questionBankCrudApi.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit API and worker wiring**

```powershell
git add server/app.js server/index.js server/services/questionKnowledgeWorker.js tests/questionKnowledgeGraphApi.test.mjs tests/questionKnowledgeWorker.test.mjs
git commit -m "feat: process question graph extraction jobs"
```

---

### Task 5: Implement manual node, relation, merge, and layout operations

**Files:**
- Create: `tests/questionKnowledgeGraphManualEditing.test.mjs`
- Modify: `server/services/questionKnowledgeGraphService.js`
- Modify: `server/app.js`

- [ ] **Step 1: Write failing service tests for manual priority and merge**

Test these operations:

```js
const manual = await graphService.createKnowledgePoint(bank.id, {
  name: '动力学建模', category: '方法', graphRevision: currentRevision
});
assert.equal(manual.source, 'manual');
assert.equal(manual.manualLocked, true);

const edited = await graphService.updateKnowledgePoint(bank.id, manual.id, {
  name: '动力学模型', aliases: ['建模'], graphRevision: manual.graphRevision
});
assert.equal(edited.name, '动力学模型');

const relation = await graphService.createRelation(bank.id, {
  sourcePointId: edited.id,
  targetPointId: target.id,
  type: 'prerequisite',
  label: '前置',
  graphRevision: edited.graphRevision
});
assert.equal(relation.source, 'manual');
assert.equal(relation.manualLocked, true);

const merged = await graphService.mergeKnowledgePoint(bank.id, duplicate.id, {
  targetPointId: target.id,
  graphRevision: relation.graphRevision
});
assert.equal(merged.mergedIntoId, target.id);
```

Also assert stale `graphRevision` throws status 409 with code `GRAPH_REVISION_CONFLICT`.

- [ ] **Step 2: Run the test and verify missing method failure**

Run: `node tests/questionKnowledgeGraphManualEditing.test.mjs`

Expected: FAIL because manual editing methods are absent.

- [ ] **Step 3: Implement transactional manual methods**

Add to the graph service:

```js
createKnowledgePoint(bankId, payload)
updateKnowledgePoint(bankId, pointId, payload)
mergeKnowledgePoint(bankId, sourcePointId, payload)
hideOrUnlinkKnowledgePoint(bankId, pointId, payload)
createRelation(bankId, payload)
updateRelation(bankId, relationId, payload)
deleteRelation(bankId, relationId, payload)
saveLayout(bankId, payload)
```

Rules:

- all mutations validate `graphRevision` and increment it transactionally;
- manual nodes/relations set `source = 'manual'` and `manualLocked = true`;
- merge migrates question links, redirects and deduplicates edges/evidence, archives the source, and records `mergedIntoId`;
- `mode=hide` changes node status only;
- `mode=unlink` removes automatic question links but preserves manually locked links unless explicitly listed;
- layout upserts only `{ knowledgePointId, x, y, pinned }` for points in the current bank.

- [ ] **Step 4: Add manual editing routes**

Implement:

```text
POST   /api/v1/question-banks/:bankId/knowledge-points
PATCH  /api/v1/question-banks/:bankId/knowledge-points/:pointId
POST   /api/v1/question-banks/:bankId/knowledge-points/:pointId/merge
DELETE /api/v1/question-banks/:bankId/knowledge-points/:pointId?mode=hide|unlink
POST   /api/v1/question-banks/:bankId/knowledge-relations
PATCH  /api/v1/question-banks/:bankId/knowledge-relations/:relationId
DELETE /api/v1/question-banks/:bankId/knowledge-relations/:relationId
PUT    /api/v1/question-banks/:bankId/knowledge-graph/layout
```

Update CORS methods to include `PUT`.

- [ ] **Step 5: Run manual editing and API tests**

Run: `node tests/questionKnowledgeGraphManualEditing.test.mjs`

Expected: PASS.

Run: `node tests/questionKnowledgeGraphApi.test.mjs`

Expected: PASS with manual route cases added.

- [ ] **Step 6: Commit manual graph editing**

```powershell
git add server/services/questionKnowledgeGraphService.js server/app.js tests/questionKnowledgeGraphManualEditing.test.mjs tests/questionKnowledgeGraphApi.test.mjs
git commit -m "feat: edit question bank graph nodes and relations"
```

---

### Task 6: Add the question-bank graph client, nested route, entry, and page shell

**Files:**
- Create: `src/pages/QuestionBankKnowledgeGraphPage.vue`
- Create: `tests/questionBankKnowledgeGraphPage.test.mjs`
- Modify: `src/data/questionBankApiClient.js`
- Modify: `src/pages/QuestionBankDetailPage.vue`
- Modify: `src/router.js`
- Modify: `src/App.vue`

- [ ] **Step 1: Write the failing frontend contract test**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const router = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/pages/QuestionBankDetailPage.vue', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/QuestionBankKnowledgeGraphPage.vue', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/data/questionBankApiClient.js', import.meta.url), 'utf8');

assert.ok(!app.includes("to: '/knowledge-graph'"));
assert.ok(router.includes("path: '/question-banks/:bankId/knowledge-graph'"));
assert.ok(detail.includes('知识图谱') && detail.includes('/knowledge-graph'));
assert.ok(page.includes('KnowledgeGraphRenderer') && page.includes('KnowledgeGraphInspector'));
assert.ok(client.includes('getQuestionBankKnowledgeGraph'));
console.log('question bank knowledge graph page contract passed');
```

- [ ] **Step 2: Run the contract and verify missing page failure**

Run: `node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: FAIL because `QuestionBankKnowledgeGraphPage.vue` is missing.

- [ ] **Step 3: Add exact API client functions**

Export:

```js
getQuestionBankKnowledgeGraph(bankId)
getQuestionBankKnowledgePoint(bankId, pointId)
analyzePendingQuestionKnowledge(bankId)
reconcileQuestionBankKnowledgeGraph(bankId)
retryQuestionKnowledgeExtraction(questionId)
createQuestionBankKnowledgePoint(bankId, payload)
updateQuestionBankKnowledgePoint(bankId, pointId, payload)
mergeQuestionBankKnowledgePoint(bankId, pointId, payload)
removeQuestionBankKnowledgePoint(bankId, pointId, mode, payload)
createQuestionBankKnowledgeRelation(bankId, payload)
updateQuestionBankKnowledgeRelation(bankId, relationId, payload)
deleteQuestionBankKnowledgeRelation(bankId, relationId, payload)
saveQuestionBankKnowledgeGraphLayout(bankId, payload)
```

Every path uses `encodeURIComponent`, and mutation calls return `payload.data`.

- [ ] **Step 4: Replace the standalone route and navigation entry**

Lazy-load the page:

```js
const QuestionBankKnowledgeGraphPage = () => import('./pages/QuestionBankKnowledgeGraphPage.vue');
```

Register:

```js
{
  path: '/question-banks/:bankId/knowledge-graph',
  name: 'question-bank-knowledge-graph',
  component: QuestionBankKnowledgeGraphPage
}
```

Remove the standalone `/knowledge-graph` route and the `App.vue` side-navigation item.

- [ ] **Step 5: Add the detail-page entry**

Add a header action beside AI generation and paper generation:

```vue
<button class="soft-btn" type="button" :disabled="!bank" @click="router.push(`/question-banks/${bank.id}/knowledge-graph`)">
  <span class="material-symbols-outlined">hub</span>
  知识图谱
</button>
```

- [ ] **Step 6: Build the page shell with partial-loading behavior**

The page must:

- load graph data from `route.params.bankId`;
- retain existing nodes while polling pending work;
- poll every 2000 ms only when `pendingCount + processingCount > 0`;
- provide search, source/category/relation filters, neighborhood mode, fit/reset layout, and analyze-pending controls;
- navigate back to `/question-banks/:bankId`;
- keep canvas and inspector mounted while mutations run;
- fetch the selected node's supporting questions through `getQuestionBankKnowledgePoint` instead of embedding all question summaries in the graph response;
- send the current `revision` with every edit.

- [ ] **Step 7: Run the page contract and API client tests**

Run: `node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: PASS.

Run: `node tests/questionBankApiClient.test.mjs`

Expected: PASS after graph-client fetch assertions are added.

- [ ] **Step 8: Commit the frontend route and shell**

```powershell
git add src/App.vue src/router.js src/data/questionBankApiClient.js src/pages/QuestionBankDetailPage.vue src/pages/QuestionBankKnowledgeGraphPage.vue tests/questionBankKnowledgeGraphPage.test.mjs tests/questionBankApiClient.test.mjs
git commit -m "feat: add knowledge graph to question banks"
```

---

### Task 7: Adapt the G6 renderer and implement the inspector interactions

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraphRenderer.vue`
- Create: `src/components/knowledge/KnowledgeGraphInspector.vue`
- Create: `tests/questionKnowledgeGraphRenderer.test.mjs`
- Modify: `src/pages/QuestionBankKnowledgeGraphPage.vue`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write failing renderer/inspector contracts**

Assert source markers for:

```js
assert.ok(renderer.includes("emit('select-node'"));
assert.ok(renderer.includes("emit('select-edge'"));
assert.ok(renderer.includes("emit('layout-change'"));
assert.ok(renderer.includes('questionCount'));
assert.ok(renderer.includes('supportCount'));
assert.ok(renderer.includes('co_occurrence'));
assert.ok(inspector.includes("emit('save-node'"));
assert.ok(inspector.includes("emit('merge-node'"));
assert.ok(inspector.includes("emit('create-relation'"));
```

- [ ] **Step 2: Run the renderer test and verify missing inspector failure**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: FAIL because `KnowledgeGraphInspector.vue` is missing.

- [ ] **Step 3: Replace course/unit rendering assumptions**

Ensure `@antv/g6` remains declared in `package.json` and locked in `package-lock.json`; do not add a second graph library.

`KnowledgeGraphRenderer.vue` must accept:

```js
graphData: Object
activeNodeId: String
activeEdgeId: String
searchText: String
neighborhoodDepth: Number
```

It emits:

```js
['select-node', 'select-edge', 'layout-change']
```

Visual rules:

- node radius derives from `questionCount`, clamped to a readable range;
- category determines fill color through a deterministic palette;
- AI nodes use a normal border, manual nodes a stronger border, and locked nodes a double/emphasized border;
- `co_occurrence` edges are solid, AI semantic edges dashed, manual edges emphasized;
- edge width derives from `supportCount`;
- labels appear for selected neighborhoods instead of all edges;
- stored pinned positions override automatic layout;
- drag end emits the moved node coordinates without writing directly to the API.

- [ ] **Step 4: Implement the inspector component**

Props:

```js
node: Object
edge: Object
nodes: Array
revision: Number
saving: Boolean
```

Emits:

```js
['save-node', 'merge-node', 'hide-node', 'unlink-node', 'create-relation', 'save-relation', 'delete-relation', 'open-question']
```

The node form edits name, description, category, aliases, and lock state; lists supporting questions; previews merge target counts; and creates directional relations. The edge form edits type/label only for manual edges and allows hiding automatic edges or deleting manual edges.

- [ ] **Step 5: Connect inspector actions without replacing the canvas**

In the page, each mutation:

1. sets a scoped `savingAction` value;
2. calls the corresponding API with the current revision;
3. replaces graph data with a fresh `getQuestionBankKnowledgeGraph` response;
4. preserves the selected node/edge when it still exists;
5. handles 409 by reloading and showing “图谱已更新，请重新提交修改”.

- [ ] **Step 6: Persist dragged positions in a debounced batch**

Collect layout changes for 400 ms, then call `saveQuestionBankKnowledgeGraphLayout(bankId, { graphRevision, nodes })`. “重新布局” clears pinned positions through the same endpoint with `pinned: false`.

- [ ] **Step 7: Run renderer, page, and build verification**

Run: `node tests/questionKnowledgeGraphRenderer.test.mjs`

Expected: PASS.

Run: `node tests/questionBankKnowledgeGraphPage.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: PASS; G6 remains in the lazy-loaded question-bank graph chunk.

- [ ] **Step 8: Commit interactive rendering**

```powershell
git add package.json package-lock.json src/components/knowledge/KnowledgeGraphRenderer.vue src/components/knowledge/KnowledgeGraphInspector.vue src/pages/QuestionBankKnowledgeGraphPage.vue tests/questionKnowledgeGraphRenderer.test.mjs
git commit -m "feat: edit and explore question knowledge graphs"
```

---

### Task 8: Backfill existing banks and remove the legacy course-group graph

**Files:**
- Create: `prisma/backfillQuestionBankKnowledgeGraph.js`
- Create: `tests/questionKnowledgeGraphBackfill.test.mjs`
- Modify: `prisma/seed.js`
- Modify: `prisma/devData.js`
- Modify: `prisma/schema.prisma`
- Modify: `server/services/courseService.js`
- Modify: `server/app.js`
- Modify: `server/index.js`
- Modify: `src/data/courseApiClient.js`
- Modify: `package.json`
- Delete: `server/services/aiKnowledgeGraphService.js`
- Delete: `src/pages/KnowledgeGraphPage.vue`
- Delete: `tests/knowledgeGraphIntegration.test.mjs`

- [ ] **Step 1: Write a failing backfill test**

Create a bank with:

- one question whose `knowledge` is `['牛顿第二定律', '合外力']`;
- one question linked to a course-scoped `KnowledgePoint` but with an empty `knowledge` JSON;
- one question with neither source.

Run the backfill function and assert:

```js
assert.equal(result.createdBankPoints, 2);
assert.equal(result.linkedQuestions, 2);
assert.equal(result.queuedQuestions, 1);
assert.equal(await prisma.knowledgePoint.count({ where: { bankId: bank.id } }), 2);
assert.equal(await prisma.questionKnowledgeExtraction.count({ where: { status: 'pending' } }), 1);
```

- [ ] **Step 2: Run the backfill test and verify module-not-found failure**

Run: `node tests/questionKnowledgeGraphBackfill.test.mjs`

Expected: FAIL because the backfill module does not exist.

- [ ] **Step 3: Implement dry-run-capable backfill**

Export:

```js
export async function backfillQuestionBankKnowledgeGraph(prisma, { dryRun = false, bankId = null } = {}) {}
```

For each active bank question, derive names from `Question.knowledge`; when empty, derive names from its existing course-scoped `QuestionKnowledgePoint` relations. Create bank-scoped nodes and links, create co-occurrence evidence, and queue only questions with no usable names. `dryRun` returns counts without mutation.

The executable script recognizes `--dry-run` and optional `--bank=<id>`.

- [ ] **Step 4: Use the same normalization in seed/dev-data flows**

After direct Prisma question creation, call the backfill helper for the affected seeded banks. Do not duplicate canonicalization logic in seed files.

- [ ] **Step 5: Remove legacy graph behavior**

Delete:

- `CourseGroup.knowledgeGraph` from Prisma;
- `knowledgeGraph` from course-group normalization/create payloads;
- `getCourseGroupKnowledgeGraph`, `getCourseGroupKnowledgeGraphContext`, and `saveCourseGroupKnowledgeGraph`;
- both `/course-groups/:id/knowledge-graph` routes;
- `createAiKnowledgeGraphService` wiring and file;
- course API client graph functions;
- standalone page and legacy integration test.

- [ ] **Step 6: Add scripts**

```json
{
  "scripts": {
    "db:backfill-question-graph": "node prisma/backfillQuestionBankKnowledgeGraph.js",
    "test:knowledge-graph": "node tests/questionKnowledgeGraphSchema.test.mjs && node tests/questionKnowledgeGraphDomain.test.mjs && node tests/aiQuestionKnowledgeService.test.mjs && node tests/questionKnowledgeGraphDb.test.mjs && node tests/questionKnowledgeGraphApi.test.mjs && node tests/questionKnowledgeWorker.test.mjs && node tests/questionKnowledgeGraphManualEditing.test.mjs && node tests/questionBankKnowledgeGraphPage.test.mjs && node tests/questionKnowledgeGraphRenderer.test.mjs && node tests/questionKnowledgeGraphBackfill.test.mjs"
  }
}
```

- [ ] **Step 7: Apply the final schema and backfill local data**

Run: `npx prisma generate`

Expected: PASS.

Run: `npx prisma db push --accept-data-loss`

Expected: removes only the obsolete `course_groups.knowledge_graph` column among graph changes.

Run: `npm run db:backfill-question-graph -- --dry-run`

Expected: prints bank/question/node/link/job counts without mutations.

Run: `npm run db:backfill-question-graph`

Expected: completes and reports the applied counts.

- [ ] **Step 8: Run backfill and schema contracts**

Run: `node tests/questionKnowledgeGraphBackfill.test.mjs`

Expected: PASS.

Update the schema contract to assert `CourseGroup` no longer contains `knowledgeGraph`, then run:

Run: `node tests/questionKnowledgeGraphSchema.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit migration and cleanup**

```powershell
git add package.json prisma/schema.prisma prisma/seed.js prisma/devData.js prisma/backfillQuestionBankKnowledgeGraph.js server/app.js server/index.js server/services/courseService.js src/data/courseApiClient.js tests/questionKnowledgeGraphSchema.test.mjs tests/questionKnowledgeGraphBackfill.test.mjs
git add -u server/services/aiKnowledgeGraphService.js src/pages/KnowledgeGraphPage.vue tests/knowledgeGraphIntegration.test.mjs
git commit -m "refactor: replace course graph with bank graph data"
```

---

### Task 9: Full regression, browser verification, and handoff

**Files:**
- Modify only if verification discovers a focused defect.

- [ ] **Step 1: Run the complete graph suite**

Run: `npm run test:knowledge-graph`

Expected: all ten graph test files pass.

- [ ] **Step 2: Run related question, course, learning-analysis, and auth suites**

Run each command independently:

```powershell
node tests/questionBankCrudDb.test.mjs
node tests/questionBankCrudApi.test.mjs
node tests/questionBankApiClient.test.mjs
node tests/aiQuestionService.test.mjs
node tests/aiQuestionGenerateApi.test.mjs
node tests/aiQuestionStreamApi.test.mjs
node tests/courseCrudDb.test.mjs
node tests/courseCrudApi.test.mjs
node tests/courseDeletionDb.test.mjs
node tests/studentPagesContract.test.mjs
node tests/authPagesContract.test.mjs
```

Expected: every command exits 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS; the knowledge graph remains lazy-loaded and no missing legacy imports appear.

- [ ] **Step 4: Verify the real browser flow**

With frontend `http://127.0.0.1:8091` and backend `http://127.0.0.1:3001`:

1. Log in as a teacher.
2. Open a question bank and click “知识图谱”.
3. Confirm the teacher sidebar has no standalone graph entry.
4. Add a question with explicit knowledge and verify only that question changes the graph.
5. Add a question without knowledge and observe partial graph plus parsing status.
6. Confirm a repeated alias reuses an existing node.
7. Edit and lock a node; refresh and confirm persistence.
8. Create a manual cross-node relation; refresh and confirm persistence.
9. Merge duplicate nodes and verify linked question counts migrate.
10. Delete a question and verify only its evidence disappears.
11. Drag and pin a node; refresh and confirm its position.
12. Resize the window and verify the canvas and inspector remain usable without hidden content.

- [ ] **Step 5: Inspect repository state**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only intentional implementation files are changed or the worktree is clean after the task commits.

- [ ] **Step 6: Commit any verification-only fixes**

If Step 4 exposes a focused defect, add only the files changed for that defect and commit with:

```powershell
git commit -m "fix: polish question bank knowledge graph flow"
```

If no defect is found, do not create an empty commit.
