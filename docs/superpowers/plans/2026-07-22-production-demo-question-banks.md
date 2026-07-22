# Production Demo Question Banks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely add 15 deterministic, multi-subject demo question banks with 180 questions and usable knowledge graphs to local and production PostgreSQL.

**Architecture:** A pure catalog module owns deterministic teaching content and can be validated without a database. A separate dependency-injected seeder maps the catalog to Prisma `upsert` operations, while a thin direct-run entry point loads environment variables and reports counts. All records use stable `demo-*` identifiers and the seeder performs no deletes.

**Tech Stack:** Node.js ES modules, Prisma 6, PostgreSQL, Node `assert`, existing Vite application.

---

## File structure

- Create `prisma/demoQuestionBankCatalog.js`: deterministic subject, bank, point, relation and question definitions.
- Create `prisma/seedDemoQuestionBanks.js`: reusable `seedDemoQuestionBanks(prisma)` function and direct CLI execution.
- Create `tests/demoQuestionBankCatalog.test.mjs`: catalog integrity and content coverage checks.
- Create `tests/demoQuestionBankSeed.test.mjs`: seeder safety and deterministic operation checks with a recording Prisma adapter.
- Modify `package.json`: add `db:demo-question-banks` and `test:demo-question-banks` scripts.

### Task 1: Lock the catalog contract with a failing test

**Files:**
- Create: `tests/demoQuestionBankCatalog.test.mjs`
- Create later: `prisma/demoQuestionBankCatalog.js`

- [ ] **Step 1: Write the failing catalog test**

The test imports `demoQuestionBankCatalog` and asserts exactly 15 banks, 5 subjects, 12 questions and 6 knowledge points per bank, unique stable IDs, both supported question types, complete answers, valid knowledge point references, and existing course IDs where supplied.

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/demoQuestionBankCatalog.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `prisma/demoQuestionBankCatalog.js`.

- [ ] **Step 3: Implement the deterministic catalog**

Export:

```js
export const demoQuestionBankCatalog = [
  {
    id: 'demo-bank-physics-motion',
    title: '匀变速直线运动专题题库',
    subject: '物理',
    grade: '高一',
    courseId: 'dev-course-motion',
    knowledgePoints: [],
    relations: [],
    questions: []
  }
];
```

Use catalog helper functions to create stable IDs while preserving 12 meaningful question stems and answers per topic. No random values or timestamps belong in the catalog.

- [ ] **Step 4: Run the catalog test and verify GREEN**

Run: `node tests/demoQuestionBankCatalog.test.mjs`

Expected: PASS with a summary of 15 banks, 180 questions and 90 knowledge points.

### Task 2: Implement the safe Prisma seeder through TDD

**Files:**
- Create: `tests/demoQuestionBankSeed.test.mjs`
- Create: `prisma/seedDemoQuestionBanks.js`

- [ ] **Step 1: Write the failing seeder test**

Create a recording Prisma adapter whose `questionBank`, `knowledgePoint`, `question`, `questionKnowledgePoint`, and `knowledgeRelation` models expose `upsert`, while `course.findMany` returns the catalog course IDs. Assert that `seedDemoQuestionBanks(prisma)`:

```js
assert.equal(summary.banks, 15);
assert.equal(summary.questions, 180);
assert.equal(summary.knowledgePoints, 90);
assert.equal(summary.relations, 75);
assert.equal(calls.deleteMany, 0);
assert.ok(calls.upsert > 0);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/demoQuestionBankSeed.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `prisma/seedDemoQuestionBanks.js`.

- [ ] **Step 3: Implement the seeder**

Export `seedDemoQuestionBanks(prisma, catalog = demoQuestionBankCatalog)`. Query available course IDs once, then upsert banks, points, questions, question-point links and relations. Use relation keys through Prisma's compound unique selector and never invoke delete operations. When executed directly, load `.env`, construct `PrismaClient`, print the JSON summary and disconnect in `finally`.

- [ ] **Step 4: Run the seeder test and verify GREEN**

Run: `node tests/demoQuestionBankSeed.test.mjs`

Expected: PASS and zero delete calls.

### Task 3: Add project commands and verify local idempotency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add command-level test assertions**

Extend `tests/demoQuestionBankSeed.test.mjs` to read `package.json` and assert:

```js
assert.equal(pkg.scripts['db:demo-question-banks'], 'node prisma/seedDemoQuestionBanks.js');
assert.equal(pkg.scripts['test:demo-question-banks'], 'node tests/demoQuestionBankCatalog.test.mjs && node tests/demoQuestionBankSeed.test.mjs');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/demoQuestionBankSeed.test.mjs`

Expected: FAIL because the scripts do not yet exist.

- [ ] **Step 3: Add both package scripts**

Add the exact commands asserted above without changing existing scripts.

- [ ] **Step 4: Run tests and two local seed passes**

Run:

```powershell
npm run test:demo-question-banks
npm run db:demo-question-banks
npm run db:demo-question-banks
```

Expected: both tests pass; each seed run reports the same 15/180/90/75 summary; database counts remain unchanged between the first and second run.

### Task 4: Verify, commit, deploy and validate production

**Files:**
- Verify all files above.

- [ ] **Step 1: Run repository verification**

Run:

```powershell
npm run test:demo-question-banks
npm run build
git diff --check
```

Expected: both tests pass, Vite build exits 0 and `git diff --check` reports nothing.

- [ ] **Step 2: Commit and push**

Commit the catalog, seeder, tests, package command and plan with message `feat: add multi-subject demo question banks`, then push `main`.

- [ ] **Step 3: Back up and deploy**

On `root@43.112.78.59`, pull the new commit in `/opt/eduai/app`, create a timestamped PostgreSQL dump under `/opt/eduai/backups`, run `npm ci`, `npx prisma generate`, and execute `npm run db:demo-question-banks` twice.

- [ ] **Step 4: Query production and verify APIs**

Confirm at least 16 active banks, at least 180 demo questions, 90 demo knowledge points and 75 demo relations. Verify `https://lovexfan.com/`, `/api/v1/health`, `/api/v1/question-banks?pageSize=100`, one new bank detail endpoint and its knowledge graph endpoint.
