# Course Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe deletion for empty course groups and transactional permanent deletion for course units and all unit-owned generated or analytical data.

**Architecture:** Keep the existing archive route unchanged and add dedicated destructive endpoints. `courseService` owns deletion validation and the Prisma transaction; the Vue page only confirms intent, invokes the API client, and refreshes authoritative server data.

**Tech Stack:** Vue 3, Node.js HTTP server, Prisma 6, PostgreSQL, Node `assert` contract tests.

---

### Task 1: Define deletion contracts with failing tests

**Files:**
- Modify: `tests/courseCrudApi.test.mjs`
- Modify: `tests/courseApiClient.test.mjs`
- Modify: `tests/courseCrudDb.test.mjs`
- Modify: `tests/teacherCourseUnitsPageContract.test.mjs`

- [ ] Add API assertions for `DELETE /api/v1/course-groups/group-empty` and `DELETE /api/v1/courses/course-newton-2/permanent`.
- [ ] Add client assertions for `deleteCourseGroup(groupId)` and `deleteCoursePermanently(courseId)`.
- [ ] Add a database fixture containing a group, course, question, knowledge point, classroom session, student answer, enrollment, learning profile and parent summary.
- [ ] Assert that a non-empty group throws `COURSE_GROUP_NOT_EMPTY`, an empty group is deleted, and permanent unit deletion removes every fixture row.
- [ ] Add page-source assertions for group and unit delete handlers and destructive confirmation copy.
- [ ] Run each test and confirm it fails because the delete functions and routes do not yet exist.

### Task 2: Implement database and service deletion behavior

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/services/courseService.js`

- [ ] Add `ppt Json?` to `Course`, expose it from `normalizeCourse`, and accept it in create/update payloads.
- [ ] Add `deleteCourseGroup(groupId)` that loads the group, counts all units, throws HTTP 409 with `{ unitCount }` when non-empty, and deletes an empty group.
- [ ] Add `deleteCoursePermanently(courseId)` that verifies existence and runs a Prisma transaction.
- [ ] In the transaction, count and delete course questions, clear knowledge-point parents, and delete the course so database cascades remove sessions, answers, enrollments and profiles.
- [ ] Return `{ id, title, deleted: true, deletedQuestions }` from permanent deletion.
- [ ] Run `npx prisma db push` and `npx prisma generate` so the local PostgreSQL schema and Prisma client include `ppt`.
- [ ] Re-run the database tests and confirm they pass.

### Task 3: Expose destructive API routes and client calls

**Files:**
- Modify: `server/app.js`
- Modify: `src/data/courseApiClient.js`

- [ ] Route `DELETE /api/v1/course-groups/:groupId` to `courseService.deleteCourseGroup`.
- [ ] Route `DELETE /api/v1/courses/:courseId/permanent` before the generic course route.
- [ ] Export `deleteCourseGroup(groupId)` and `deleteCoursePermanently(courseId)` from the client.
- [ ] Run API and client contract tests and confirm both pass.

### Task 4: Add teacher-side deletion controls

**Files:**
- Modify: `src/pages/CoursesPage.vue`

- [ ] Import both delete client functions.
- [ ] Add `confirmDeleteGroup(group)`; reject non-empty groups in the UI, confirm empty deletion, call the API, reset selection and reload.
- [ ] Add `confirmDeleteCourse()`; show destructive confirmation, call permanent deletion, reset selected course and reload.
- [ ] Render a group chip wrapper with a separate trash button; disable it when `group.count > 0` and provide a title explaining why.
- [ ] Add a red “永久删除” button to the selected unit detail actions.
- [ ] Add focused destructive-button styles without changing the existing page layout.
- [ ] Run the teacher page contract test and production build.

### Task 5: Full verification

**Files:**
- Verify only.

- [ ] Run `node tests/courseCrudApi.test.mjs`.
- [ ] Run `node tests/courseApiClient.test.mjs`.
- [ ] Run `node tests/courseCrudDb.test.mjs`.
- [ ] Run `node tests/teacherCourseUnitsPageContract.test.mjs`.
- [ ] Run related course metadata, generation-state, student course-group and student-analysis tests.
- [ ] Run `npm run build` and inspect output for errors.
- [ ] Review `git diff --check` and `git status --short` before reporting completion.
