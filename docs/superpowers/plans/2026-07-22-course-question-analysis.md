# Course Question Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the teacher course analysis Mock page with PostgreSQL-backed course/class/session statistics, persisted streaming DeepSeek reports, single-question drill-down, and report-aware question generation.

**Architecture:** Add a focused `courseAnalysisService` for validated scope queries, deterministic aggregation, fingerprints, and report persistence. Add an `aiCourseAnalysisService` for DeepSeek streaming and structured report parsing. Expose them through dedicated API routes and a small frontend client; keep the Vue page responsible only for URL-backed filters, display state, and interactions.

**Tech Stack:** Vue 3, Vue Router, Vite, Node HTTP server, Prisma 6, PostgreSQL, DeepSeek Chat Completions SSE, Node test runner scripts.

---

## File map

- `prisma/schema.prisma`: add report persistence and relations.
- `server/services/courseAnalysisService.js`: scope validation, aggregation, question detail, report storage/context.
- `server/services/aiCourseAnalysisService.js`: DeepSeek prompt, streaming parser, save-on-success behavior.
- `server/app.js`: analysis read/detail/report/context routes.
- `server/index.js`: construct and inject the new services.
- `src/data/courseAnalysisApiClient.js`: cached GET requests and SSE report generation.
- `src/pages/StageAnalysisPage.vue`: replace Mock UI with the confirmed analysis workspace.
- `server/services/aiQuestionService.js`: append persisted report context to AI question prompts.
- `src/pages/QuestionGeneratePage.vue`: load/display report reference and pass its ID.
- `src/data/questionBankApiClient.js`: preserve `analysisReportId` in generation requests.
- `tests/courseAnalysisService.test.mjs`: aggregation and report staleness.
- `tests/courseAnalysisApi.test.mjs`: HTTP and SSE contracts.
- `tests/courseAnalysisApiClient.test.mjs`: browser client contract.
- `tests/stageAnalysisPage.test.mjs`: page Mock-removal and interaction contract.
- `tests/courseAnalysisQuestionGeneration.test.mjs`: report-aware generation contract.

### Task 1: Persist one report per analysis scope

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/courseAnalysisSchema.test.mjs`

- [x] **Step 1: Write the failing schema contract test**

Assert that `CourseAnalysisReport` contains `scopeKey`, source fingerprint/count fields, structured JSON fields, provider/model fields, and `@@unique([courseId, scopeKey])`; assert that `Course` has `analysisReports CourseAnalysisReport[]`.

- [x] **Step 2: Run the schema test and verify it fails**

Run: `node tests/courseAnalysisSchema.test.mjs`

Expected: failure because `CourseAnalysisReport` is absent.

- [x] **Step 3: Add the Prisma model and Course relation**

Use a UUID primary key, `onDelete: Cascade` for the course relation, optional scalar `classId`/`sessionId`, JSON defaults for report sections, and timestamps. Keep class/session as scalar snapshot identifiers so class/session deletion does not invalidate an otherwise useful course report.

- [x] **Step 4: Generate Prisma Client and rerun the test**

Run: `npm run db:generate && node tests/courseAnalysisSchema.test.mjs`

Expected: Prisma generation succeeds and schema test passes.

- [x] **Step 5: Commit**

```powershell
git add prisma/schema.prisma tests/courseAnalysisSchema.test.mjs
git commit -m "feat: add course analysis report model"
```

### Task 2: Build deterministic course analysis aggregation

**Files:**
- Create: `server/services/courseAnalysisService.js`
- Test: `tests/courseAnalysisService.test.mjs`

- [x] **Step 1: Write failing service tests**

Create a small in-memory Prisma stub covering a course, two classes, normal classroom sessions, one `ai_personal_practice` session, questions, and answers. Verify:

```js
const result = await service.getCourseAnalysis('course-1', {});
assert.equal(result.summary.answerCount, 5);
assert.equal(result.summary.participantCount, 3);
assert.equal(result.summary.accuracy, 60);
assert.equal(result.questionStats[0].id, 'weak-question');
assert.ok(result.source.fingerprint);
```

Also verify class/session filtering, invalid scope rejection, excluded personal practice, answer distributions, latest-per-student detail, and stale report detection.

- [x] **Step 2: Run the service test and verify it fails**

Run: `node tests/courseAnalysisService.test.mjs`

Expected: module-not-found failure.

- [x] **Step 3: Implement the service**

Export `createCourseAnalysisService(prisma)` with:

```js
getCourseAnalysis(courseId, { classId, sessionId })
getQuestionDetail(courseId, questionId, { classId, sessionId })
saveReport(courseId, scope, reportPayload)
getReportContext(reportId)
```

Validate that the course is active, scopes belong to it, exclude `ai_personal_practice`, aggregate from `StudentAnswer`, compute SHA-256 from answer count/latest submission/question count/latest question update, and upsert reports with `courseId_scopeKey`.

- [x] **Step 4: Run the service tests**

Run: `node tests/courseAnalysisService.test.mjs`

Expected: all course analysis service checks pass.

- [x] **Step 5: Commit**

```powershell
git add server/services/courseAnalysisService.js tests/courseAnalysisService.test.mjs
git commit -m "feat: aggregate real course question analysis"
```

### Task 3: Generate and persist structured DeepSeek reports

**Files:**
- Create: `server/services/aiCourseAnalysisService.js`
- Test: `tests/aiCourseAnalysisService.test.mjs`

- [x] **Step 1: Write failing AI service tests**

Use a fake streaming DeepSeek response containing `delta` text and one `:::course-analysis-report-start ... :::course-analysis-report-end` JSON block. Verify deltas are forwarded, the parsed report is saved once, and the final report event is emitted. Verify missing API key and malformed structured output reject without calling `saveReport`.

- [x] **Step 2: Run and verify failure**

Run: `node tests/aiCourseAnalysisService.test.mjs`

Expected: module-not-found failure.

- [x] **Step 3: Implement the AI service**

Export `createAiCourseAnalysisService({ courseAnalysisService, env, fetchImpl })`. The service must fetch a fresh server-side snapshot, send only summary plus the weakest 20 questions, stream natural-language deltas, parse one complete report block, normalize arrays, then call `saveReport`. Throw `AI_CREDENTIALS_MISSING`, `AI_PROVIDER_ERROR`, or `AI_PARSE_FAILED` as appropriate.

- [x] **Step 4: Run AI tests**

Run: `node tests/aiCourseAnalysisService.test.mjs`

Expected: all AI report tests pass.

- [x] **Step 5: Commit**

```powershell
git add server/services/aiCourseAnalysisService.js tests/aiCourseAnalysisService.test.mjs
git commit -m "feat: generate persisted course analysis reports"
```

### Task 4: Expose analysis APIs and SSE

**Files:**
- Modify: `server/app.js`
- Modify: `server/index.js`
- Create: `tests/courseAnalysisApi.test.mjs`

- [x] **Step 1: Write failing API contract tests**

Inject fake services into `createLearningApiApp` and verify:

```text
GET  /api/v1/courses/course-1/analysis
GET  /api/v1/courses/course-1/analysis/questions/question-1
POST /api/v1/courses/course-1/analysis/reports/stream
GET  /api/v1/course-analysis-reports/report-1/context
```

Assert query/body forwarding, `{ data }` envelopes, SSE `delta/report/done`, and SSE `error` behavior.

- [x] **Step 2: Run and verify failure**

Run: `node tests/courseAnalysisApi.test.mjs`

Expected: 404 responses for the new routes.

- [x] **Step 3: Add routes and dependency injection**

Extend `createLearningApiApp` with `courseAnalysisService` and `aiCourseAnalysisService`. Register specific question/report routes before generic course CRUD matching. Instantiate both services in `server/index.js` and pass them to the app.

- [x] **Step 4: Run API tests**

Run: `node tests/courseAnalysisApi.test.mjs`

Expected: all analysis API checks pass.

- [x] **Step 5: Commit**

```powershell
git add server/app.js server/index.js tests/courseAnalysisApi.test.mjs
git commit -m "feat: expose course analysis APIs"
```

### Task 5: Add the frontend API client

**Files:**
- Create: `src/data/courseAnalysisApiClient.js`
- Create: `tests/courseAnalysisApiClient.test.mjs`

- [x] **Step 1: Write failing client tests**

Start a local HTTP server and assert encoded paths and query parameters for analysis/detail/context requests. Stream SSE frames and verify `onDelta`, `onSection`, `onReport`, `onDone`, and structured error callbacks.

- [x] **Step 2: Run and verify failure**

Run: `node tests/courseAnalysisApiClient.test.mjs`

Expected: module-not-found failure.

- [x] **Step 3: Implement the client**

Export:

```js
fetchCourseAnalysis(courseId, filters, options)
fetchCourseQuestionDetail(courseId, questionId, filters, options)
streamCourseAnalysisReport(courseId, request, handlers)
fetchCourseAnalysisReportContext(reportId, options)
```

Use `cachedApiRequest` for GET calls with all filters in the key. Use direct `fetch` and incremental SSE frame parsing for POST streaming.

- [x] **Step 4: Run client tests**

Run: `node tests/courseAnalysisApiClient.test.mjs`

Expected: all client checks pass.

- [x] **Step 5: Commit**

```powershell
git add src/data/courseAnalysisApiClient.js tests/courseAnalysisApiClient.test.mjs
git commit -m "feat: add course analysis frontend client"
```

### Task 6: Replace the Mock-driven StageAnalysisPage

**Files:**
- Replace: `src/pages/StageAnalysisPage.vue`
- Create: `tests/stageAnalysisPage.test.mjs`

- [x] **Step 1: Write failing page contract tests**

Assert the page imports `courseAnalysisApiClient`, never imports `mockStore`, never contains `newton-laws-bank` or `牛顿第二定律`, binds `classId`/`sessionId` through router query updates, keeps statistics visible while `aiGenerating`, lazy-loads single-question detail, and opens a bank selector before navigation.

- [x] **Step 2: Run and verify failure**

Run: `node tests/stageAnalysisPage.test.mjs`

Expected: assertions fail against the current Mock page.

- [x] **Step 3: Implement the confirmed UI**

Build the page with:

- course header and workflow rail;
- class/session filter controls;
- five KPI cards;
- tabs for question statistics, answer records, and AI report;
- searchable weakest-first question rows with one lazy expanded detail;
- sticky AI report panel with generating, saved, stale, empty, and error states;
- question-bank selection dialog populated through `listQuestionBanks`;
- report ID handoff to `/question-banks/:bankId/generate`.

Use request sequence IDs so older filter responses cannot replace newer state. Keep only the content area scrollable and include responsive breakpoints.

- [x] **Step 4: Run page test and build**

Run: `node tests/stageAnalysisPage.test.mjs && npm run build`

Expected: page contract passes and Vite build succeeds.

- [x] **Step 5: Commit**

```powershell
git add src/pages/StageAnalysisPage.vue tests/stageAnalysisPage.test.mjs
git commit -m "feat: connect course analysis page to real data"
```

### Task 7: Feed persisted analysis into question generation

**Files:**
- Modify: `server/services/aiQuestionService.js`
- Modify: `server/index.js`
- Modify: `src/pages/QuestionGeneratePage.vue`
- Modify: `src/data/questionBankApiClient.js`
- Create: `tests/courseAnalysisQuestionGeneration.test.mjs`

- [x] **Step 1: Write failing linkage tests**

Verify the AI question service accepts trusted `analysisContext`, includes course metrics/weak points in its user prompt, and the page reads `route.query.analysisReportId`, loads context, renders an “已引用学情报告” chip, and sends `analysisReportId` in both streaming and non-streaming generation bodies.

- [x] **Step 2: Run and verify failure**

Run: `node tests/courseAnalysisQuestionGeneration.test.mjs`

Expected: missing report-context behavior.

- [x] **Step 3: Resolve report ID on the server**

Before calling `aiQuestionService`, the two question-generation routes resolve `body.analysisReportId` with `courseAnalysisService.getReportContext`. Pass the result as `analysisContext`; ignore any client-supplied raw context. Extend the AI prompt builder to serialize the summary, weak points, teaching suggestions, and practice suggestions.

- [x] **Step 4: Display the reference and pass the ID**

Load the context on mount when the query exists, show a removable reference chip, and include the ID in `buildAiRequest`. Removing the chip clears only local reference state and does not delete the report.

- [x] **Step 5: Run linkage and existing question-generation tests**

Run: `node tests/courseAnalysisQuestionGeneration.test.mjs && node tests/questionBankApiClient.test.mjs && node tests/questionGeneratePageInteraction.test.mjs`

Expected: all tests pass.

- [x] **Step 6: Commit**

```powershell
git add server/services/aiQuestionService.js server/app.js server/index.js src/pages/QuestionGeneratePage.vue src/data/questionBankApiClient.js tests/courseAnalysisQuestionGeneration.test.mjs
git commit -m "feat: generate questions from course analysis"
```

### Task 8: Database sync and complete verification

**Files:**
- Modify if needed: `docs/backend-api-contract.md`
- Modify: `docs/superpowers/plans/2026-07-22-course-question-analysis.md`

- [x] **Step 1: Apply the local schema**

Run: `npm run db:push`

Expected: PostgreSQL schema synchronizes without destructive-change errors.

- [x] **Step 2: Run focused tests**

```powershell
node tests/courseAnalysisSchema.test.mjs
node tests/courseAnalysisService.test.mjs
node tests/aiCourseAnalysisService.test.mjs
node tests/courseAnalysisApi.test.mjs
node tests/courseAnalysisApiClient.test.mjs
node tests/stageAnalysisPage.test.mjs
node tests/courseAnalysisQuestionGeneration.test.mjs
```

Expected: every command exits 0.

- [x] **Step 3: Run regression and build verification**

Run: `npm run test:backend; npm run test:courses; npm run build`

Expected: all tests pass and Vite produces `dist` successfully.

- [x] **Step 4: Check source and diff quality**

Run: `rg -n "mockStore|newton-laws-bank|牛顿第二定律" src/pages/StageAnalysisPage.vue; git diff --check; git status --short`

Expected: no forbidden fallback strings, no whitespace errors, and only intended files changed.

- [x] **Step 5: Document API and commit final verification changes**

Update the API contract with the four new endpoints and mark all completed plan checkboxes.

```powershell
git add docs/backend-api-contract.md docs/superpowers/plans/2026-07-22-course-question-analysis.md
git commit -m "docs: document course analysis APIs"
```

