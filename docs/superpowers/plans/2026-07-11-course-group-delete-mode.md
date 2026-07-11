# Course Group Delete Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace always-visible group delete buttons with a page-level delete mode that reveals inline icons only on demand.

**Architecture:** Keep deletion APIs and confirmation behavior unchanged. `CoursesPage.vue` owns one local boolean state; template rendering and CSS respond to that state without adding persistence or backend work.

**Tech Stack:** Vue 3 Composition API, project CSS, Node assertion contract tests.

---

### Task 1: Define the page contract

**Files:**
- Modify: `tests/teacherCourseUnitsPageContract.test.mjs`

- [ ] Assert that the page declares `groupDeleteMode`.
- [ ] Assert that a “删除分组/完成删除” button toggles the state.
- [ ] Assert that `.course-group-delete` is rendered with `v-if="groupDeleteMode"` inside the group selection button.
- [ ] Run `node tests/teacherCourseUnitsPageContract.test.mjs` and confirm the new assertion fails.

### Task 2: Implement delete mode

**Files:**
- Modify: `src/pages/CoursesPage.vue`
- Modify: `src/styles/base.css`

- [ ] Add `const groupDeleteMode = ref(false)`.
- [ ] Add a top action button that toggles the state and switches between `删除分组` and `完成删除`.
- [ ] Replace the two-button `.course-group-chip` structure with one group button containing title, count, and a conditional inline delete button target.
- [ ] Keep group selection working by stopping propagation only on the delete icon.
- [ ] Style `.course-group-delete` as an inline icon without border or reserved width, while preserving a practical hit area in delete mode.
- [ ] Re-run the page contract and confirm it passes.

### Task 3: Verify

**Files:**
- Verify only.

- [ ] Run the teacher page contract and course API client tests.
- [ ] Run `npm run build`.
- [ ] In the local browser, confirm default-hidden and delete-mode-visible states without deleting data.
- [ ] Run `git diff --check` and inspect `git status --short`.
