# Admin Office Management Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic admin office page with a standard routed management backend and complete soft-delete CRUD for teachers, students, classes, courses, and student course assignments.

**Architecture:** Reuse the existing `studentService`, `classService`, and `courseService` domain services, extending only missing account synchronization, archive guards, and teacher assignment fields. Add `/api/v1/admin/**` aliases over these services, a dedicated admin layout with child routes, focused resource pages, shared admin UI components, and a single client module that owns cache invalidation.

**Tech Stack:** Vue 3 Composition API, Vue Router 4, scoped CSS, Node.js HTTP server, Prisma 6, PostgreSQL, Node `assert` tests.

---

## File map

- Modify `server/services/studentService.js`: student account creation, class update, user status synchronization.
- Modify `server/services/classService.js`: teacher display and non-empty archive guard.
- Modify `server/services/courseService.js`: direct teacher assignment and teacher display.
- Modify `server/app.js`: `/api/v1/admin/students|classes|courses` CRUD aliases.
- Modify `src/data/adminApiClient.js`: complete CRUD client and restore calls.
- Modify `src/router.js`: admin layout and six child routes.
- Replace `src/pages/admin/AdminOfficePage.vue` with `AdminOverviewPage.vue` compatibility export or remove its route responsibility.
- Create `src/layouts/AdminLayout.vue`.
- Create `src/components/admin/AdminResourceDrawer.vue`, `AdminConfirmDialog.vue`, `AdminStatusBadge.vue`, `AdminPageState.vue`, `AdminPagination.vue`.
- Create six pages under `src/pages/admin/` for overview, teachers, students, classes, courses, and enrollments.
- Create `src/styles/admin-system.css` for the shared responsive admin system.
- Modify and add admin service, API, client, router, page, and responsive contract tests.

### Task 1: Complete resource domain behavior

**Files:**
- Modify: `server/services/studentService.js`
- Modify: `server/services/classService.js`
- Modify: `server/services/courseService.js`
- Create: `tests/adminResourceServices.test.mjs`

- [ ] Write a failing service test proving that student creation also creates a `User`, student archive/restore synchronizes `User.status`, student update can change `classId`, class archive rejects active students or active sessions with HTTP 409, and course create/update returns `teacherId` and teacher name.
- [ ] Run `node tests/adminResourceServices.test.mjs` and confirm the first missing behavior fails.
- [ ] Implement the smallest service changes while preserving existing response fields and soft-delete behavior.
- [ ] Run `node tests/adminResourceServices.test.mjs` and existing `node tests/backendLearningApi.test.mjs` until both pass.
- [ ] Commit with `feat: complete admin resource domain services`.

### Task 2: Add admin resource HTTP endpoints

**Files:**
- Modify: `server/app.js`
- Create: `tests/adminResourceApi.test.mjs`

- [ ] Write failing HTTP tests for list, create, update, archive and restore on `/api/v1/admin/students`, `/classes`, and `/courses`, including pagination and resource filters.
- [ ] Run `node tests/adminResourceApi.test.mjs` and confirm 404 or missing-call failures.
- [ ] Add route handlers before the generic resource routes and delegate to the existing services; return `{ data, pagination }` consistently.
- [ ] Run `node tests/adminResourceApi.test.mjs && node tests/adminApi.test.mjs` and confirm all admin API tests pass.
- [ ] Commit with `feat: add admin resource CRUD endpoints`.

### Task 3: Expand the admin API client

**Files:**
- Modify: `src/data/adminApiClient.js`
- Create: `tests/adminApiClientCrud.test.mjs`

- [ ] Write a failing client test with a fetch recorder for every teacher restore and student/class/course create, update, archive and restore function.
- [ ] Run `node tests/adminApiClientCrud.test.mjs` and confirm the missing exports fail.
- [ ] Implement the client functions using `/admin/**` paths and clear admin plus shared caches after every mutation.
- [ ] Run `node tests/adminApiClientCrud.test.mjs && node tests/apiClientCaching.test.mjs`.
- [ ] Commit with `feat: expand admin resource api client`.

### Task 4: Build the routed admin shell and shared UI

**Files:**
- Modify: `src/router.js`
- Create: `src/layouts/AdminLayout.vue`
- Create: `src/components/admin/AdminResourceDrawer.vue`
- Create: `src/components/admin/AdminConfirmDialog.vue`
- Create: `src/components/admin/AdminStatusBadge.vue`
- Create: `src/components/admin/AdminPageState.vue`
- Create: `src/components/admin/AdminPagination.vue`
- Create: `src/styles/admin-system.css`
- Create: `tests/adminLayoutContract.test.mjs`

- [ ] Write a failing contract test for `/admin/overview`, `/teachers`, `/students`, `/classes`, `/courses`, `/enrollments`, nested `router-view`, active navigation, mobile menu, logout, drawer dialog semantics, and pagination controls.
- [ ] Run `node tests/adminLayoutContract.test.mjs` and confirm it fails because the layout and routes are absent.
- [ ] Implement the shell with a 15rem desktop sidebar, 4rem top bar, query-safe child routing, accessible controls, and mobile overlay navigation.
- [ ] Implement shared components with `role="dialog"`, Escape close behavior, focus-visible styles, 44px controls, and no page-level overflow.
- [ ] Run `node tests/adminLayoutContract.test.mjs`.
- [ ] Commit with `feat: add routed admin management shell`.

### Task 5: Implement overview and teacher management

**Files:**
- Create: `src/pages/admin/AdminOverviewPage.vue`
- Create: `src/pages/admin/AdminTeachersPage.vue`
- Modify: `tests/adminPagesContract.test.mjs`

- [ ] Update the page contract test to require summary shortcuts, teacher table filters, create/edit drawer, archive confirmation, restore action, and removal of the old all-in-one grid.
- [ ] Run `node tests/adminPagesContract.test.mjs` and confirm it fails.
- [ ] Implement the overview using `getAdminSummary` and the teacher page using the complete teacher client API, pagination, inline feedback, and drawer forms.
- [ ] Run `node tests/adminPagesContract.test.mjs`.
- [ ] Commit with `feat: redesign admin overview and teacher management`.

### Task 6: Implement student, class, and course management

**Files:**
- Create: `src/pages/admin/AdminStudentsPage.vue`
- Create: `src/pages/admin/AdminClassesPage.vue`
- Create: `src/pages/admin/AdminCoursesPage.vue`
- Create: `tests/adminResourcePagesContract.test.mjs`

- [ ] Write failing page contracts for search, status filters, resource-specific filters, drawer forms, table columns, archive confirmation and restore actions.
- [ ] Run `node tests/adminResourcePagesContract.test.mjs` and confirm the pages are missing.
- [ ] Implement each page as an independent resource screen; load only its own rows and lookup data, reset to page 1 when filters change, and force refresh after mutation.
- [ ] Ensure the student form includes username/password for creation and class assignment, class form includes teacher assignment, and course form includes teacher, subject, grade, description and duration.
- [ ] Run `node tests/adminResourcePagesContract.test.mjs`.
- [ ] Commit with `feat: add admin student class and course management`.

### Task 7: Rebuild course assignment as a dedicated module

**Files:**
- Create: `src/pages/admin/AdminEnrollmentsPage.vue`
- Modify: `tests/adminPagesContract.test.mjs`

- [ ] Add failing contracts for a student table, class filter, enrollment detail drawer, class-course read-only rows, manual removal, available-course assignment and loading/empty/error states.
- [ ] Run `node tests/adminPagesContract.test.mjs` and confirm the assignment module requirements fail.
- [ ] Move existing assignment behavior into the dedicated page and prevent archived students or courses from appearing in assignable lists.
- [ ] Run `node tests/adminPagesContract.test.mjs && node tests/adminApi.test.mjs`.
- [ ] Commit with `feat: add dedicated admin course assignment page`.

### Task 8: Responsive polish and full verification

**Files:**
- Modify: `src/styles/admin-system.css`
- Modify: relevant admin page scoped styles only when component-specific behavior is required.
- Create: `tests/adminResponsiveContract.test.mjs`

- [ ] Write failing style contracts for neutral surfaces, no gradients or backdrop blur, 44px controls, table overflow containers, 768px and 1024px breakpoints, full-width mobile drawers and reduced-motion support.
- [ ] Run `node tests/adminResponsiveContract.test.mjs` and confirm it fails before final styles.
- [ ] Complete the shared style system and verify 375px, 768px, 1024px and 1440px browser viewports.
- [ ] Run all admin tests, authentication tests, backend learning tests, cache tests and `npm run build`.
- [ ] Run `git diff --check`, review the final diff, and commit with `feat: complete admin management system redesign`.
