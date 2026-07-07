<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getBank, getCourseQuestions, getQuestionsByBank, notify, referenceQuestionToCourse, store } from '../data/mockStore';

const route = useRoute();
const router = useRouter();
const activeStage = ref('全部');
const referenceMode = ref(false);
const selectedCourseId = ref(store.selectedCourseId);
const selectedQuestionIds = ref([]);
const stages = ['全部', '课前', '课中', '课后'];

const bank = computed(() => getBank(route.params.bankId));
const courseQuestions = computed(() => getCourseQuestions(selectedCourseId.value));
const questions = computed(() => {
  const list = getQuestionsByBank(bank.value.id);
  return activeStage.value === '全部' ? list : list.filter((question) => question.stage === activeStage.value);
});
const selectedCourse = computed(() => store.courses.find((course) => course.id === selectedCourseId.value) || store.courses[0]);

function toggleReferenceMode() {
  referenceMode.value = !referenceMode.value;
  selectedCourseId.value = store.selectedCourseId;
  selectedQuestionIds.value = [];
}

function toggleQuestion(questionId) {
  selectedQuestionIds.value = selectedQuestionIds.value.includes(questionId)
    ? selectedQuestionIds.value.filter((id) => id !== questionId)
    : [...selectedQuestionIds.value, questionId];
}

function referenceSelectedQuestions() {
  selectedQuestionIds.value.forEach((questionId) => referenceQuestionToCourse(questionId, selectedCourseId.value));
  notify(`已引用 ${selectedQuestionIds.value.length} 道题到「${selectedCourse.value.shortTitle}」`);
  selectedQuestionIds.value = [];
  referenceMode.value = false;
}
</script>

<template>
  <main class="module-page question-page bank-detail-page">
    <section class="module-head">
      <div>
        <h1>题库</h1>
        <p>{{ bank.desc }}</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn back-btn" type="button" @click="router.push('/question-banks')">
          <span class="material-symbols-outlined">chevron_left</span>
          返回题库
        </button>
        <button class="primary-btn" type="button" @click="router.push(`/question-banks/${bank.id}/generate`)">
          <span class="material-symbols-outlined">auto_awesome</span>
          AI 生成题目
        </button>
        <button class="soft-btn" type="button" :class="{ active: referenceMode }" @click="toggleReferenceMode">
          <span class="material-symbols-outlined">checklist</span>
          {{ referenceMode ? '取消选择' : '选择引用' }}
        </button>
      </div>
    </section>

    <section class="module-tools">
      <div class="segmented">
        <button
          v-for="stage in stages"
          :key="stage"
          :class="{ active: activeStage === stage }"
          type="button"
          @click="activeStage = stage"
        >
          {{ stage }}
        </button>
      </div>
      <label class="module-search">
        <span class="material-symbols-outlined">search</span>
        <input type="search" placeholder="搜索题干、答案、知识点..." />
      </label>
      <button class="course-filter" type="button" @click="notify('已按正确率升序排列')">
        正确率
        <span class="material-symbols-outlined">expand_more</span>
      </button>
    </section>

    <section class="two-col">
      <div class="list-panel">
        <article
          v-for="question in questions"
          :key="question.id"
          class="question-row"
          :class="{ picking: referenceMode, selected: selectedQuestionIds.includes(question.id) }"
        >
          <button
            v-if="referenceMode"
            class="reference-check"
            type="button"
            :aria-label="`选择 ${question.title}`"
            @click="toggleQuestion(question.id)"
          >
            <span class="material-symbols-outlined">check</span>
          </button>
          <div>
            <div class="card-meta" style="margin-top:0">
              <span>{{ question.stage }}</span>
              <span>{{ question.type }}</span>
              <span>{{ question.difficulty }}</span>
              <span>正确率 {{ question.accuracy }}%</span>
            </div>
            <h3>{{ question.title }}</h3>
            <p>{{ question.options.join('　') }}</p>
          </div>
          <div class="row-actions">
            <button class="soft-btn" type="button" @click="router.push(`/questions/${question.id}`)">查看详情</button>
          </div>
        </article>
      </div>

      <aside class="surface-card side-panel">
        <span class="small-chip">{{ referenceMode ? '引用到课程' : '题库概览' }}</span>
        <h2>{{ referenceMode ? `${selectedQuestionIds.length} 道已选` : `${bank.count} 道题` }}</h2>
        <p>{{ referenceMode ? '选择目标课程后，题目会进入该课程的题目与分析页。' : `${bank.subject} ・ ${bank.usage} ・ ${bank.updatedAt}` }}</p>
        <div v-if="referenceMode" class="course-picker">
          <button
            v-for="course in store.courses"
            :key="course.id"
            :class="{ active: selectedCourseId === course.id }"
            type="button"
            @click="selectedCourseId = course.id"
          >
            <strong>{{ course.shortTitle }}</strong>
            <span>{{ course.subject }} ・ {{ course.duration }}</span>
          </button>
        </div>
        <div class="tag-cloud">
          <span v-for="tag in bank.tags" :key="tag">{{ tag }}</span>
        </div>
        <div class="side-stat">
          <strong>{{ courseQuestions.length }}</strong><span>已进题目与分析</span>
        </div>
        <div class="side-stat">
          <strong>6</strong><span>建议生成变式题</span>
        </div>
        <button
          v-if="referenceMode"
          class="outline-generate-btn"
          type="button"
          :disabled="!selectedQuestionIds.length"
          @click="referenceSelectedQuestions"
        >
          <span class="material-symbols-outlined">playlist_add_check</span>
          引用到课程
        </button>
        <button v-else class="outline-generate-btn" type="button" @click="router.push(`/question-banks/${bank.id}/generate`)">
          <span class="material-symbols-outlined">auto_awesome</span>
          生成同类题
        </button>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.question-page :deep(.module-head h1) {
  font-family: var(--font-serif);
  font-weight: 800;
}

.bank-detail-page :deep(.module-tools) {
  margin-top: 18px;
}

.bank-detail-page :deep(.question-row) {
  background: rgba(255, 255, 255, .72);
}

.bank-detail-page :deep(.question-row.picking) {
  grid-template-columns: 34px minmax(0, 1fr) auto;
}

.bank-detail-page :deep(.question-row.selected) {
  border-color: rgba(31, 181, 95, .52);
  background: rgba(235, 249, 240, .84);
}

.reference-check {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 2px solid rgba(16, 55, 35, .28);
  border-radius: 50%;
  background: #fff;
  color: transparent;
}

.question-row.selected .reference-check {
  border-color: var(--green);
  background: var(--green);
  color: #fff;
}

.reference-check .material-symbols-outlined {
  font-size: 17px;
}

.row-actions {
  display: grid;
  gap: 10px;
  min-width: 116px;
}

.side-panel h2 {
  margin-top: 18px;
  font-family: var(--font-mono);
  font-size: 28px;
}

.side-panel p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
}

.tag-cloud {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 18px 0;
}

.course-picker {
  display: grid;
  gap: 10px;
  margin: 18px 0;
}

.course-picker button {
  display: grid;
  gap: 5px;
  min-height: 58px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .72);
  padding: 10px 12px;
  text-align: left;
}

.course-picker button.active {
  border-color: rgba(31, 181, 95, .52);
  background: rgba(235, 249, 240, .88);
  box-shadow: inset 0 0 0 1px rgba(47, 172, 102, .22);
}

.course-picker strong {
  color: var(--ink);
  font-size: 13px;
}

.course-picker span {
  color: var(--soft);
  font-size: 12px;
  font-weight: 700;
}

.tag-cloud span {
  display: inline-flex;
  height: 28px;
  align-items: center;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--mint);
  color: #1f8847;
  font-size: 12px;
  font-weight: 700;
}

.side-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  border-top: 1px solid var(--line);
}

.side-stat strong {
  font-family: var(--font-mono);
  font-size: 26px;
}

.side-stat span {
  color: var(--muted);
  font-size: 13px;
}

.outline-generate-btn:disabled {
  opacity: .6;
}
</style>
