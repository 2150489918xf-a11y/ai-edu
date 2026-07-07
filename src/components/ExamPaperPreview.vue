<script setup>
import { computed, ref, watch } from 'vue';
import { buildExamPaperLayout } from '../utils/examPaper';

const props = defineProps({
  paper: {
    type: Object,
    required: true
  }
});

const layout = computed(() => buildExamPaperLayout(props.paper));
const currentPage = ref(1);
const activePage = computed(() => layout.value.pages.find((page) => page.pageNumber === currentPage.value) || layout.value.pages[0]);

function answerLines(count) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function goToPage(pageNumber) {
  currentPage.value = Math.min(Math.max(pageNumber, 1), layout.value.pages.length);
}

watch(
  () => props.paper.id,
  () => {
    currentPage.value = 1;
  }
);
</script>

<template>
  <section class="exam-preview">
    <nav class="page-switcher" aria-label="试卷分页">
      <button type="button" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
        <span class="material-symbols-outlined">chevron_left</span>
        上一页
      </button>
      <button
        v-for="page in layout.pages"
        :key="page.pageNumber"
        type="button"
        :class="{ active: currentPage === page.pageNumber }"
        @click="goToPage(page.pageNumber)"
      >
        第 {{ page.pageNumber }} 页
      </button>
      <button type="button" :disabled="currentPage === layout.pages.length" @click="goToPage(currentPage + 1)">
        下一页
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </nav>

    <article class="exam-sheet">
      <aside class="seal-line" aria-label="密封线">
        <span>密</span>
        <span>封</span>
        <span>线</span>
        <small>线内不得答题</small>
      </aside>

      <section class="exam-content">
        <template v-if="activePage.includeHeader">
          <header class="exam-header">
            <p>{{ layout.examInfo.subject }}阶段检测</p>
            <h2>{{ layout.title }}</h2>
            <div class="exam-meta">
              <span>满分：{{ layout.examInfo.fullScore }} 分</span>
              <span>时间：{{ layout.examInfo.durationMinutes }} 分钟</span>
              <span>题量：{{ layout.examInfo.questionCount }} 题</span>
            </div>
          </header>

          <section class="candidate-row">
            <span>姓名：__________</span>
            <span>班级：__________</span>
            <span>考号：__________</span>
          </section>

          <section class="notice-box">
            <strong>注意事项</strong>
            <ol>
              <li>答题前请将姓名、班级、考号填写清楚。</li>
              <li>选择题请将答案写在题号后的括号内，计算题需写出必要过程。</li>
              <li>请在指定区域内作答，保持卷面整洁。</li>
            </ol>
          </section>

          <table class="score-table">
            <thead>
              <tr>
                <th v-for="item in layout.scoreTable" :key="item.label">{{ item.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td v-for="item in layout.scoreTable" :key="item.label">{{ item.score }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <header v-else class="continued-header">
          <strong>{{ layout.title }}</strong>
          <span>第 {{ activePage.pageNumber }} 页 / 共 {{ layout.pages.length }} 页</span>
        </header>

        <section
          v-for="section in activePage.sections"
          :key="section.type"
          class="exam-section"
        >
          <h3>{{ section.heading }}（每题 {{ section.pointsPerQuestion }} 分，共 {{ section.totalPoints }} 分）</h3>
          <article
            v-for="(question, index) in section.questions"
            :key="question.id"
            class="exam-question"
          >
            <p class="question-title">
              {{ index + 1 }}. {{ question.title }}
              <span v-if="section.answerLines === 0" class="answer-bracket">（　　）</span>
            </p>
            <p v-if="question.options.length" class="choice-row">
              <span v-for="option in question.options" :key="option">{{ option }}</span>
            </p>
            <div v-if="section.answerLines > 0" class="answer-area">
              <i v-for="line in answerLines(section.answerLines)" :key="line"></i>
            </div>
          </article>
        </section>
      </section>
    </article>
  </section>
</template>

<style scoped>
.exam-preview {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.page-switcher {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.page-switcher button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: rgba(255, 255, 255, .86);
  padding: 0 12px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.page-switcher button.active {
  border-color: var(--green);
  background: var(--mint);
  color: #1f8847;
}

.page-switcher button:disabled {
  opacity: .45;
}

.page-switcher .material-symbols-outlined {
  font-size: 16px;
}

.exam-sheet {
  position: relative;
  display: grid;
  grid-template-columns: 18mm minmax(0, 1fr);
  width: min(100%, 210mm);
  height: min(78vh, 297mm);
  min-height: 760px;
  margin: 0 auto;
  border: 1px solid #d8d8d8;
  background: #fff;
  box-shadow: 0 18px 45px rgba(16, 55, 35, .14);
  color: #111;
  font-family: "Times New Roman", "SimSun", serif;
}

.seal-line {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12mm;
  border-right: 1px dashed #333;
  padding: 12mm 0;
  color: #222;
  font-size: 15px;
  letter-spacing: 0;
}

.seal-line small {
  writing-mode: vertical-rl;
  color: #555;
  font-size: 11px;
  letter-spacing: 2px;
}

.exam-content {
  min-width: 0;
  overflow-y: auto;
  padding: 15mm 14mm 16mm 10mm;
}

.exam-header {
  text-align: center;
}

.exam-header p {
  margin: 0;
  color: #333;
  font-size: 13px;
}

.exam-header h2 {
  margin: 8px 0 10px;
  color: #000;
  font-family: "SimHei", "Microsoft YaHei", sans-serif;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0;
}

.exam-meta,
.candidate-row {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
  color: #222;
  font-size: 13px;
}

.candidate-row {
  justify-content: space-between;
  margin-top: 12mm;
  border-top: 1px solid #111;
  border-bottom: 1px solid #111;
  padding: 8px 0;
}

.notice-box {
  margin-top: 10mm;
  border: 1px solid #111;
  padding: 10px 12px;
}

.notice-box strong {
  font-size: 14px;
}

.notice-box ol {
  margin: 6px 0 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.7;
}

.score-table {
  width: 100%;
  margin-top: 8mm;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
  text-align: center;
}

.score-table th,
.score-table td {
  border: 1px solid #111;
  padding: 7px 4px;
}

.score-table th {
  font-weight: 700;
}

.continued-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #111;
  padding-bottom: 8px;
  color: #222;
  font-size: 12px;
}

.exam-section {
  margin-top: 9mm;
}

.exam-section h3 {
  margin: 0 0 6mm;
  font-family: "SimHei", "Microsoft YaHei", sans-serif;
  font-size: 15px;
  font-weight: 800;
}

.exam-question {
  margin-top: 5mm;
  break-inside: avoid;
  page-break-inside: avoid;
}

.question-title {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
}

.answer-bracket {
  white-space: nowrap;
}

.choice-row {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin: 4px 0 0 1.6em;
  font-size: 13px;
  line-height: 1.8;
}

.choice-row span {
  min-width: 78px;
}

.answer-area {
  display: grid;
  gap: 8mm;
  margin: 5mm 0 0 1.6em;
}

.answer-area i {
  display: block;
  border-bottom: 1px solid #9a9a9a;
}

@media (max-width: 760px) {
  .exam-sheet {
    grid-template-columns: 12mm minmax(0, 1fr);
    height: 78vh;
    min-height: 620px;
  }

  .exam-content {
    padding: 12mm 8mm 12mm 7mm;
  }

  .exam-header h2 {
    font-size: 20px;
  }

  .candidate-row {
    justify-content: flex-start;
    gap: 10px 18px;
  }
}

@media print {
  .exam-sheet {
    width: 210mm;
    height: auto;
    min-height: 297mm;
    margin: 0;
    border: 0;
    box-shadow: none;
  }

  .exam-content {
    overflow: visible;
  }

  .page-switcher {
    display: none;
  }
}
</style>
