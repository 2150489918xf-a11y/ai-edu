<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { use } from 'echarts/core';
import { BarChart, PieChart, RadarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, RadarComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import {
  generateStudentCourseGroupProfile,
  getStudentCourseGroupAnalysis,
  getStudentCourseGroupAnalysisOverview
} from '../../data/studentApiClient';

use([
  BarChart,
  PieChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  CanvasRenderer
]);

const DEFAULT_STUDENT_ID = 'stu-chenyu';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const generatingCourseId = ref('');
const error = ref('');
const detailError = ref('');
const overview = ref(null);
const selectedCourseId = ref('');
const courseDetail = ref(null);

const studentId = computed(() => route.query.studentId || DEFAULT_STUDENT_ID);
const courses = computed(() => overview.value?.courses || []);
const selectedCourse = computed(() => courses.value.find((item) => item.course.id === selectedCourseId.value) || courses.value[0] || null);
const summary = computed(() => overview.value?.summary || {});
const topWeakPoints = computed(() => summary.value.weakPoints || []);
const profile = computed(() => courseDetail.value?.profile || selectedCourse.value?.profile || null);
const hasAnswers = computed(() => Number(courseDetail.value?.summary?.answeredCount || selectedCourse.value?.summary?.answeredCount || 0) > 0);
const detailSummary = computed(() => courseDetail.value?.summary || {});
const chartConfig = computed(() => normalizeChartConfig(profile.value?.recommendedPractice?.chartConfig, buildFallbackChartConfig()));
const knowledgeChartItems = computed(() => {
  const items = chartConfig.value.knowledgeMastery || [];
  return [...items]
    .sort((a, b) => (b.answered || 0) - (a.answered || 0) || (a.accuracy || 0) - (b.accuracy || 0))
    .slice(0, 6)
    .map((item) => ({
      ...item,
      accuracy: clampPercent(item.accuracy)
    }));
});
const abilityMetrics = computed(() => {
  if (chartConfig.value.abilityRadar?.length) {
    return chartConfig.value.abilityRadar.map((item) => ({
      label: item.name,
      value: clampPercent(item.value)
    }));
  }
  const summaryValue = detailSummary.value;
  const knowledgeStats = courseDetail.value?.knowledgeStats || [];
  const answeredKnowledgeCount = knowledgeStats.filter((item) => Number(item.answered || 0) > 0).length;
  const knowledgeCoverage = knowledgeStats.length ? Math.round((answeredKnowledgeCount / knowledgeStats.length) * 100) : 0;
  const avgDuration = Number(summaryValue.avgDurationSeconds || 0);
  const paceScore = avgDuration ? clampPercent(Math.round(100 - Math.max(0, avgDuration - 45) * 0.8)) : 0;

  return [
    { label: '完成度', value: clampPercent(summaryValue.completionRate) },
    { label: '准确率', value: clampPercent(summaryValue.accuracy) },
    { label: '知识覆盖', value: clampPercent(knowledgeCoverage) },
    { label: '答题节奏', value: paceScore },
    { label: '错题控制', value: clampPercent(summaryValue.answeredCount ? Math.round(((summaryValue.correctCount || 0) / summaryValue.answeredCount) * 100) : 0) },
    { label: '画像完整', value: profile.value ? 82 : (summaryValue.answeredCount ? 46 : 0) }
  ];
});
const radarScore = computed(() => {
  if (!abilityMetrics.value.length) return 0;
  return Math.round(abilityMetrics.value.reduce((sum, item) => sum + item.value, 0) / abilityMetrics.value.length);
});
const radarOption = computed(() => ({
  color: ['#2fac66'],
  tooltip: { trigger: 'item' },
  radar: {
    radius: '62%',
    center: ['50%', '52%'],
    splitNumber: 4,
    axisName: {
      color: '#52645b',
      fontSize: 12,
      fontWeight: 700
    },
    axisLine: { lineStyle: { color: 'rgba(16, 55, 35, .12)' } },
    splitLine: { lineStyle: { color: 'rgba(16, 55, 35, .12)' } },
    splitArea: {
      areaStyle: {
        color: ['rgba(47, 172, 102, .04)', 'rgba(47, 172, 102, .08)']
      }
    },
    indicator: abilityMetrics.value.map((item) => ({ name: item.label, max: 100 }))
  },
  series: [{
    type: 'radar',
    data: [{ value: abilityMetrics.value.map((item) => item.value), name: '能力评分' }],
    areaStyle: { color: 'rgba(47, 172, 102, .28)' },
    lineStyle: { width: 2 },
    symbolSize: 5
  }]
}));
const knowledgeBarOption = computed(() => ({
  color: ['#2fac66'],
  grid: { left: 36, right: 18, top: 24, bottom: 54 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter(params) {
      const item = params?.[0];
      const source = knowledgeChartItems.value[item?.dataIndex || 0] || {};
      return `${source.name || ''}<br/>掌握度：${item?.value || 0}%<br/>正确：${source.correct || 0}/${source.answered || 0}`;
    }
  },
  xAxis: {
    type: 'category',
    data: knowledgeChartItems.value.map((item) => item.name),
    axisLabel: {
      color: '#52645b',
      fontSize: 11,
      interval: 0,
      width: 64,
      overflow: 'truncate'
    },
    axisTick: { show: false },
    axisLine: { lineStyle: { color: 'rgba(16, 55, 35, .12)' } }
  },
  yAxis: {
    type: 'value',
    max: 100,
    axisLabel: { formatter: '{value}%', color: '#52645b' },
    splitLine: { lineStyle: { color: 'rgba(16, 55, 35, .08)' } }
  },
  series: [{
    type: 'bar',
    data: knowledgeChartItems.value.map((item) => item.accuracy),
    barMaxWidth: 34,
    itemStyle: { borderRadius: [8, 8, 4, 4] }
  }]
}));
const answerPieOption = computed(() => ({
  color: answerComposition.value.map((item) => item.color),
  tooltip: { trigger: 'item', formatter: '{b}: {c} 题 ({d}%)' },
  legend: {
    show: false
  },
  series: [{
    type: 'pie',
    radius: ['56%', '76%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: true,
    label: {
      show: false
    },
    labelLine: { show: false },
    data: answerComposition.value.map((item) => ({ name: item.label, value: item.value }))
  }]
}));
const answerComposition = computed(() => {
  if (chartConfig.value.answerDistribution?.length) {
    const totalValue = Math.max(chartConfig.value.answerDistribution.reduce((sum, item) => sum + Number(item.value || 0), 0), 1);
    const colors = ['#2fac66', '#e36f45', '#dce5df', '#4aa3a2', '#f3bd4f'];
    return chartConfig.value.answerDistribution.map((item, index) => ({
      label: item.name,
      value: Number(item.value || 0),
      percent: Math.round((Number(item.value || 0) / totalValue) * 100),
      color: colors[index % colors.length]
    }));
  }
  const summaryValue = detailSummary.value;
  const correct = Number(summaryValue.correctCount || 0);
  const wrong = Number(summaryValue.wrongCount || 0);
  const unanswered = Math.max(Number(summaryValue.totalQuestions || 0) - Number(summaryValue.answeredCount || 0), 0);
  const total = Math.max(correct + wrong + unanswered, 1);
  return [
    { label: '正确', value: correct, percent: Math.round((correct / total) * 100), color: '#2fac66' },
    { label: '错题', value: wrong, percent: Math.round((wrong / total) * 100), color: '#e36f45' },
    { label: '未答', value: unanswered, percent: Math.round((unanswered / total) * 100), color: '#dce5df' }
  ];
});
const weakReasonItems = computed(() => {
  if (chartConfig.value.weakReasons?.length) return chartConfig.value.weakReasons.slice(0, 4);
  const reasons = profile.value?.mistakeReasons || [];
  if (reasons.length) return reasons.slice(0, 4);
  return (courseDetail.value?.wrongQuestions || [])
    .slice(0, 4)
    .map((item) => `${item.knowledge?.join('、') || '未标注知识点'}：${item.analysis || '需要复盘解题过程'}`);
});
const metricCards = computed(() => {
  const value = detailSummary.value;
  return [
    {
      label: '完成率',
      value: formatPercent(value.completionRate),
      meta: `${Number(value.answeredCount || 0)}/${Number(value.totalQuestions || 0)} 已答`,
      tone: 'green'
    },
    {
      label: '正确率',
      value: formatPercent(value.accuracy),
      meta: `${Number(value.correctCount || 0)} 题正确`,
      tone: 'teal'
    },
    {
      label: '平均用时',
      value: `${Number(value.avgDurationSeconds || 0)}s`,
      meta: '单题节奏',
      tone: 'blue'
    },
    {
      label: '错题',
      value: Number(value.wrongCount || 0),
      meta: '待复盘',
      tone: Number(value.wrongCount || 0) ? 'orange' : 'green'
    }
  ];
});
const knowledgeDiagnosisItems = computed(() => knowledgeChartItems.value.map((item) => {
  const answered = Number(item.answered || 0);
  const total = Number(item.total || item.answered || 0);
  const accuracy = clampPercent(item.accuracy);
  let status = '待练习';
  let tone = 'muted';
  if (answered > 0 && accuracy < 60) {
    status = '薄弱';
    tone = 'weak';
  } else if (answered > 0 && accuracy < 80) {
    status = '巩固';
    tone = 'steady';
  } else if (answered > 0) {
    status = '优势';
    tone = 'strong';
  }
  return {
    ...item,
    total,
    answered,
    accuracy,
    status,
    tone
  };
}));

function formatPercent(value) {
  return `${Number(value || 0)}%`;
}

function buildFallbackChartConfig() {
  const summaryValue = detailSummary.value;
  const knowledgeStats = courseDetail.value?.knowledgeStats || [];
  const answeredKnowledgeCount = knowledgeStats.filter((item) => Number(item.answered || 0) > 0).length;
  const knowledgeCoverage = knowledgeStats.length ? Math.round((answeredKnowledgeCount / knowledgeStats.length) * 100) : 0;
  const avgDuration = Number(summaryValue.avgDurationSeconds || 0);
  const paceScore = avgDuration ? clampPercent(Math.round(100 - Math.max(0, avgDuration - 45) * 0.8)) : 0;
  const correct = Number(summaryValue.correctCount || 0);
  const wrong = Number(summaryValue.wrongCount || 0);
  const unanswered = Math.max(Number(summaryValue.totalQuestions || 0) - Number(summaryValue.answeredCount || 0), 0);

  return {
    abilityRadar: [
      { name: '完成度', value: clampPercent(summaryValue.completionRate) },
      { name: '准确率', value: clampPercent(summaryValue.accuracy) },
      { name: '知识覆盖', value: clampPercent(knowledgeCoverage) },
      { name: '答题节奏', value: paceScore },
      { name: '错题控制', value: clampPercent(summaryValue.answeredCount ? Math.round((correct / summaryValue.answeredCount) * 100) : 0) },
      { name: '画像完整', value: profile.value ? 82 : (summaryValue.answeredCount ? 46 : 0) }
    ],
    knowledgeMastery: knowledgeStats.map((item) => ({
      name: item.name,
      accuracy: clampPercent(item.accuracy),
      correct: Number(item.correct || 0),
      answered: Number(item.answered || 0),
      wrong: Number(item.wrong || 0)
    })),
    answerDistribution: [
      { name: '正确', value: correct },
      { name: '错题', value: wrong },
      { name: '未答', value: unanswered }
    ],
    weakReasons: (courseDetail.value?.wrongQuestions || [])
      .slice(0, 4)
      .map((item) => `${item.knowledge?.join('、') || '未标注知识点'}：${item.analysis || '需要复盘解题过程'}`)
  };
}

function normalizeChartConfig(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  const normalizeRadar = (items) => (Array.isArray(items) ? items : [])
    .map((item) => ({ name: String(item.name || item.label || ''), value: clampPercent(item.value ?? item.score) }))
    .filter((item) => item.name);
  const normalizeKnowledge = (items) => (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: String(item.name || item.knowledge || ''),
      accuracy: clampPercent(item.accuracy ?? item.value),
      correct: Number(item.correct || 0),
      answered: Number(item.answered || 0),
      wrong: Number(item.wrong || 0)
    }))
    .filter((item) => item.name);
  const normalizeDistribution = (items) => (Array.isArray(items) ? items : [])
    .map((item) => ({ name: String(item.name || item.label || ''), value: Math.max(0, Number(item.value || 0)) }))
    .filter((item) => item.name);
  const normalizeReasons = (items) => (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return {
    abilityRadar: normalizeRadar(source.abilityRadar).length ? normalizeRadar(source.abilityRadar) : normalizeRadar(fallback.abilityRadar),
    knowledgeMastery: normalizeKnowledge(source.knowledgeMastery).length ? normalizeKnowledge(source.knowledgeMastery) : normalizeKnowledge(fallback.knowledgeMastery),
    answerDistribution: normalizeDistribution(source.answerDistribution).length ? normalizeDistribution(source.answerDistribution) : normalizeDistribution(fallback.answerDistribution),
    weakReasons: normalizeReasons(source.weakReasons).length ? normalizeReasons(source.weakReasons) : normalizeReasons(fallback.weakReasons)
  };
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function formatWeakPoints(items = []) {
  if (!items.length) return '暂无薄弱点';
  return items.map((item) => item.name || item.knowledge).filter(Boolean).join('、');
}

function backToCourses() {
  router.push({ path: '/student/courses', query: { studentId: studentId.value } });
}

async function loadOverview() {
  loading.value = true;
  error.value = '';
  try {
    overview.value = await getStudentCourseGroupAnalysisOverview(studentId.value);
    if (!selectedCourseId.value && courses.value.length) selectedCourseId.value = courses.value[0].course.id;
    if (selectedCourseId.value) await loadCourseDetail(selectedCourseId.value);
  } catch (err) {
    error.value = err.message || '学情分析加载失败';
  } finally {
    loading.value = false;
  }
}

async function loadCourseDetail(courseId) {
  if (!courseId) return;
  selectedCourseId.value = courseId;
  detailLoading.value = true;
  detailError.value = '';
  try {
    courseDetail.value = await getStudentCourseGroupAnalysis(studentId.value, courseId);
  } catch (err) {
    detailError.value = err.message || '课程学情加载失败';
  } finally {
    detailLoading.value = false;
  }
}

async function generateProfile() {
  if (!selectedCourseId.value || generatingCourseId.value) return;
  generatingCourseId.value = selectedCourseId.value;
  detailError.value = '';
  try {
    courseDetail.value = await generateStudentCourseGroupProfile(studentId.value, selectedCourseId.value);
    await loadOverview();
  } catch (err) {
    detailError.value = err.message || 'AI 学生画像生成失败';
  } finally {
    generatingCourseId.value = '';
  }
}

function openPracticeGenerate() {
  if (!selectedCourseId.value) return;
  const unitItems = courseDetail.value?.units || selectedCourse.value?.units || [];
  const targetUnit = unitItems.find((item) => Number(item.summary?.wrongCount || 0) > 0) || unitItems[0] || null;
  const targetCourseId = targetUnit?.course?.id || selectedCourseId.value;
  router.push({
    path: '/student/analysis/practice-generate',
    query: {
      studentId: studentId.value,
      courseId: targetCourseId,
      courseTitle: targetUnit?.course?.title || courseDetail.value?.course?.title || selectedCourse.value?.course?.title || ''
    }
  });
}

onMounted(loadOverview);
</script>

<template>
  <main class="analysis-shell">
    <header class="analysis-topbar">
      <button type="button" class="icon-btn" aria-label="返回课程" @click="backToCourses">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div>
        <span class="small-chip">学情分析</span>
        <h1>{{ overview?.student?.name || '学生' }} 的学习画像</h1>
        <p>{{ overview?.student?.className || '班级' }} · 根据答题记录生成课程画像和练习建议</p>
      </div>
      <button type="button" class="refresh-btn" :disabled="loading" @click="loadOverview">
        <span class="material-symbols-outlined">refresh</span>
        刷新
      </button>
    </header>

    <section v-if="error" class="analysis-empty">
      <span class="material-symbols-outlined">error</span>
      <strong>{{ error }}</strong>
      <button type="button" @click="loadOverview">重新加载</button>
    </section>

    <template v-else>
      <section class="analysis-summary">
        <article>
          <strong>{{ summary.courseCount || 0 }}</strong>
          <span>课程</span>
        </article>
        <article>
          <strong>{{ summary.answeredCount || 0 }}</strong>
          <span>累计答题</span>
        </article>
        <article>
          <strong>{{ formatPercent(summary.accuracy) }}</strong>
          <span>平均正确率</span>
        </article>
        <article class="wide">
          <strong>{{ formatWeakPoints(topWeakPoints) }}</strong>
          <span>主要薄弱点</span>
        </article>
      </section>

      <section class="analysis-layout">
        <aside class="course-list-panel">
          <header>
            <span class="small-chip">课程画像</span>
            <h2>按课程查看</h2>
          </header>
          <div class="course-list">
            <button
              v-for="item in courses"
              :key="item.course.id"
              type="button"
              class="course-analysis-card"
              :class="{ active: item.course.id === selectedCourseId }"
              @click="loadCourseDetail(item.course.id)"
            >
              <div>
                <strong>{{ item.course.title }}</strong>
                <span>{{ item.course.subject }} · {{ item.course.grade }}</span>
              </div>
              <dl>
                <div>
                  <dt>正确率</dt>
                  <dd>{{ formatPercent(item.summary.accuracy) }}</dd>
                </div>
                <div>
                  <dt>答题</dt>
                  <dd>{{ item.summary.answeredCount }}/{{ item.summary.totalQuestions }}</dd>
                </div>
              </dl>
              <p>{{ item.profile?.aiConversationSummary || formatWeakPoints(item.weakPoints) }}</p>
            </button>
          </div>
        </aside>

        <section class="detail-panel">
          <header>
            <div>
              <span class="small-chip">课程详情</span>
              <h2>{{ courseDetail?.course?.title || selectedCourse?.course?.title || '选择课程' }}</h2>
              <p>{{ courseDetail?.course?.teacher || selectedCourse?.course?.teacher || '任课老师' }}</p>
            </div>
            <div class="detail-actions">
              <button type="button" :disabled="!hasAnswers || generatingCourseId" @click="generateProfile">
                <span class="material-symbols-outlined">auto_awesome</span>
                {{ generatingCourseId ? '分析中' : profile ? '重新分析' : '生成画像' }}
              </button>
              <button type="button" :disabled="!selectedCourseId" @click="openPracticeGenerate">
                <span class="material-symbols-outlined">quiz</span>
                生成针对练习
              </button>
            </div>
          </header>

          <p v-if="detailError" class="detail-error">{{ detailError }}</p>

          <div v-if="detailLoading" class="analysis-empty compact">
            <span class="material-symbols-outlined">hourglass_top</span>
            <strong>正在加载课程学情</strong>
          </div>

          <template v-else-if="courseDetail">
            <section class="compact-metrics" aria-label="课程答题指标">
              <article v-for="item in metricCards" :key="item.label" :class="`metric-${item.tone}`">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <em>{{ item.meta }}</em>
              </article>
            </section>

            <section class="chart-grid">
              <article class="radar-card">
                <div class="chart-card-header">
                  <div>
                    <span class="small-chip">能力画像</span>
                    <h3>六维学习雷达</h3>
                  </div>
                  <strong>{{ radarScore }}</strong>
                </div>
                <VChart class="echart radar-echart" :option="radarOption" autoresize />
                <div class="radar-legend">
                  <span v-for="item in abilityMetrics" :key="item.label">
                    {{ item.label }} {{ formatPercent(item.value) }}
                  </span>
                </div>
              </article>

              <article class="knowledge-chart-card">
                <div class="chart-card-header">
                  <div>
                    <span class="small-chip">知识点</span>
                    <h3>掌握度柱状图</h3>
                  </div>
                  <strong>{{ knowledgeChartItems.length }}</strong>
                </div>
                <VChart v-if="knowledgeChartItems.length" class="echart knowledge-echart" :option="knowledgeBarOption" autoresize />
                <div v-if="knowledgeDiagnosisItems.length" class="knowledge-diagnosis">
                  <div v-for="item in knowledgeDiagnosisItems" :key="item.name">
                    <strong :title="item.name">{{ item.name }}</strong>
                    <span>{{ item.answered }}/{{ item.total || item.answered }} 题</span>
                    <em>{{ formatPercent(item.accuracy) }}</em>
                    <i :class="`status-${item.tone}`">{{ item.status }}</i>
                  </div>
                </div>
                <p v-else class="muted">暂无知识点答题数据</p>
              </article>
            </section>

            <section class="insight-grid">
              <article class="composition-card">
                <div>
                  <span class="small-chip">答题构成</span>
                  <h3>完成状态分布</h3>
                </div>
                <div class="donut-row">
                  <VChart class="echart donut-echart" :option="answerPieOption" autoresize />
                  <dl>
                    <div v-for="item in answerComposition" :key="item.label">
                      <dt><i :style="{ background: item.color }"></i>{{ item.label }}</dt>
                      <dd>{{ item.value }} 题 · {{ item.percent }}%</dd>
                    </div>
                  </dl>
                </div>
              </article>

              <article class="weak-reason-card">
                <div>
                  <span class="small-chip">薄弱归因</span>
                  <h3>需要优先复盘</h3>
                </div>
                <ul v-if="weakReasonItems.length">
                  <li v-for="item in weakReasonItems" :key="item">{{ item }}</li>
                </ul>
                <p v-else class="muted">当前课程暂无明显薄弱归因，继续完成练习后会自动补全。</p>
              </article>
            </section>

            <section class="profile-panel">
              <h3>AI 学生画像</h3>
              <p v-if="profile?.aiConversationSummary">{{ profile.aiConversationSummary }}</p>
              <p v-else class="muted">还没有生成 AI 画像。完成答题后点击“生成画像”。</p>
              <div class="profile-columns">
                <article>
                  <h4>薄弱点</h4>
                  <ul>
                    <li v-for="item in profile?.weakPoints || []" :key="item.knowledge || item.name">
                      {{ item.knowledge || item.name }}：{{ item.reason || formatPercent(item.accuracy) }}
                    </li>
                    <li v-if="!(profile?.weakPoints || []).length">暂无画像数据</li>
                  </ul>
                </article>
                <article>
                  <h4>练习建议</h4>
                  <ul>
                    <li>难度：{{ profile?.recommendedPractice?.difficulty || '待分析' }}</li>
                    <li>题型：{{ (profile?.recommendedPractice?.questionTypes || ['choice', 'blank']).join('、') }}</li>
                    <li>知识点：{{ (profile?.recommendedPractice?.knowledge || []).join('、') || '待分析' }}</li>
                  </ul>
                </article>
              </div>
            </section>

            <section class="wrong-panel">
              <h3>错题记录</h3>
              <article v-for="question in courseDetail.wrongQuestions" :key="question.id">
                <strong>{{ question.title }}</strong>
                <span>{{ question.knowledge.join('、') }} · {{ question.difficulty || '练习' }}</span>
                <p>你的答案：{{ question.studentAnswer || '空' }}；正确答案：{{ question.correctAnswer }}</p>
              </article>
              <p v-if="!courseDetail.wrongQuestions.length" class="muted">当前课程暂无错题记录。</p>
            </section>
          </template>
        </section>
      </section>
    </template>
  </main>
</template>

<style scoped>
.analysis-shell {
  width: 100%;
  height: 100vh;
  overflow-y: auto;
  background:
    radial-gradient(circle at 8% 8%, rgba(81, 201, 135, .2), transparent 30%),
    var(--wash);
  color: var(--ink);
  padding: 20px;
}

.analysis-topbar,
.analysis-summary,
.analysis-layout {
  width: min(1280px, 100%);
  margin: 0 auto;
}

.analysis-topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0 16px;
}

.analysis-topbar div {
  flex: 1;
}

.analysis-topbar h1 {
  margin: 8px 0 0;
  font-family: var(--font-serif);
  font-size: 34px;
}

.analysis-topbar p,
.course-analysis-card span,
.course-analysis-card p,
.detail-panel header p,
.compact-metrics span,
.compact-metrics em,
.muted,
.wrong-panel span {
  color: var(--muted);
}

.icon-btn,
.refresh-btn,
.detail-panel header button,
.analysis-empty button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  background: var(--deep);
  color: #80f3a8;
  padding: 0 14px;
  font-weight: 800;
}

.icon-btn {
  width: 42px;
  padding: 0;
}

.analysis-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.analysis-summary article,
.course-list-panel,
.detail-panel,
.analysis-empty {
  border: 1px solid rgba(255, 255, 255, .78);
  background: rgba(255, 255, 255, .72);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.analysis-summary article {
  min-height: 92px;
  border-radius: 14px;
  padding: 16px;
}

.analysis-summary strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 26px;
}

.analysis-layout {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 14px;
  padding: 14px 0 36px;
}

.course-list-panel,
.detail-panel {
  border-radius: 16px;
  padding: 16px;
}

.course-list-panel {
  position: sticky;
  top: 14px;
  align-self: start;
  max-height: calc(100vh - 28px);
  overflow-y: auto;
}

.course-list-panel h2,
.detail-panel h2 {
  margin: 8px 0 0;
  font-size: 22px;
}

.course-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.course-analysis-card {
  display: grid;
  gap: 10px;
  border: 1px solid rgba(16, 55, 35, .08);
  border-radius: 12px;
  background: rgba(255, 255, 255, .58);
  padding: 12px;
  text-align: left;
}

.course-analysis-card.active {
  border-color: rgba(47, 172, 102, .4);
  background: var(--mint);
}

.course-analysis-card dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.course-analysis-card dt {
  color: var(--muted);
  font-size: 12px;
}

.course-analysis-card dd {
  margin: 2px 0 0;
  font-weight: 900;
}

.course-analysis-card p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-panel header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid rgba(16, 55, 35, .08);
  padding-bottom: 14px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.detail-panel header button:disabled {
  cursor: default;
  background: rgba(16, 55, 35, .08);
  color: var(--muted);
}

.detail-error {
  color: #b42318;
  font-weight: 800;
}

.compact-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(132px, 1fr));
  gap: 8px;
  margin-top: 14px;
  border: 1px solid rgba(16, 55, 35, .08);
  border-radius: 14px;
  background: rgba(255, 255, 255, .5);
  padding: 8px;
}

.compact-metrics article {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 10px;
  overflow: hidden;
  min-height: 58px;
  border-radius: 10px;
  background: rgba(255, 255, 255, .62);
  padding: 10px 12px;
}

.compact-metrics article::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--green);
  content: "";
}

.compact-metrics .metric-teal::before {
  background: var(--teal);
}

.compact-metrics .metric-blue::before {
  background: #4a8db8;
}

.compact-metrics .metric-orange::before {
  background: #e36f45;
}

.compact-metrics span {
  font-size: 12px;
  font-weight: 800;
}

.compact-metrics strong {
  grid-row: span 2;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 24px;
  line-height: 1;
}

.compact-metrics em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.chart-grid,
.insight-grid {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.chart-grid {
  grid-template-columns: minmax(300px, .9fr) minmax(360px, 1.1fr);
}

.insight-grid {
  grid-template-columns: minmax(280px, .8fr) minmax(320px, 1.2fr);
}

.radar-card,
.knowledge-chart-card,
.composition-card,
.weak-reason-card {
  border: 1px solid rgba(16, 55, 35, .08);
  border-radius: 14px;
  background: rgba(255, 255, 255, .62);
  padding: 14px;
}

.chart-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.chart-card-header h3,
.composition-card h3,
.weak-reason-card h3 {
  margin: 7px 0 0;
  font-size: 18px;
}

.chart-card-header > strong {
  font-family: var(--font-mono);
  font-size: 26px;
}

.echart {
  width: 100%;
  min-width: 0;
}

.radar-echart {
  height: 286px;
  margin-top: 8px;
}

.knowledge-echart {
  height: 218px;
  margin-top: 8px;
}

.donut-echart {
  height: 166px;
}

.knowledge-diagnosis {
  display: grid;
  gap: 7px;
  margin-top: 10px;
}

.knowledge-diagnosis div {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) 64px 52px 58px;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border-radius: 9px;
  background: rgba(16, 55, 35, .04);
  padding: 7px 9px;
}

.knowledge-diagnosis strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-diagnosis span,
.knowledge-diagnosis em {
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.knowledge-diagnosis em {
  color: var(--deep);
  font-family: var(--font-mono);
}

.knowledge-diagnosis i {
  justify-self: end;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}

.knowledge-diagnosis .status-strong {
  background: rgba(47, 172, 102, .12);
  color: var(--green);
}

.knowledge-diagnosis .status-steady {
  background: rgba(74, 163, 162, .13);
  color: var(--teal);
}

.knowledge-diagnosis .status-weak {
  background: rgba(227, 111, 69, .13);
  color: #c24f2e;
}

.knowledge-diagnosis .status-muted {
  background: rgba(16, 55, 35, .07);
  color: var(--muted);
}

.radar-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.radar-legend span {
  overflow: hidden;
  border-radius: 999px;
  background: rgba(47, 172, 102, .08);
  color: var(--deep);
  padding: 5px 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 800;
}

.donut-row {
  display: grid;
  grid-template-columns: 166px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  margin-top: 14px;
}

.donut-row dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.donut-row dl div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.donut-row dt,
.donut-row dd {
  margin: 0;
  font-weight: 800;
}

.donut-row dt {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--ink);
}

.donut-row dd {
  color: var(--muted);
  font-size: 13px;
}

.donut-row i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.weak-reason-card ul {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.weak-reason-card li {
  border-left: 3px solid var(--green);
  border-radius: 8px;
  background: rgba(47, 172, 102, .08);
  padding: 8px 10px;
  line-height: 1.55;
}

.profile-panel,
.wrong-panel {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.profile-panel h3,
.wrong-panel h3 {
  margin: 0;
  font-size: 18px;
}

.profile-panel,
.wrong-panel article {
  border-radius: 12px;
  background: rgba(255, 255, 255, .56);
  padding: 14px;
}

.profile-panel p,
.wrong-panel p {
  margin: 0;
  line-height: 1.65;
}

.profile-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.profile-columns article {
  border: 1px solid rgba(16, 55, 35, .08);
  border-radius: 12px;
  padding: 12px;
}

.profile-columns h4 {
  margin: 0 0 8px;
}

.profile-columns ul {
  margin: 0;
  padding-left: 18px;
}

.profile-columns li {
  margin: 5px 0;
  line-height: 1.55;
}

.wrong-panel article {
  display: grid;
  gap: 6px;
}

.analysis-empty {
  display: grid;
  width: min(680px, calc(100% - 36px));
  min-height: 220px;
  place-items: center;
  gap: 10px;
  margin: 30px auto;
  border-radius: 16px;
  padding: 28px;
  text-align: center;
}

.analysis-empty.compact {
  width: 100%;
  min-height: 180px;
}

.analysis-empty .material-symbols-outlined {
  color: var(--green);
  font-size: 36px;
}

@media (max-width: 1080px) {
  .analysis-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analysis-layout {
    grid-template-columns: 1fr;
  }

  .chart-grid,
  .insight-grid {
    grid-template-columns: 1fr;
  }

  .compact-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .course-list-panel {
    position: static;
    max-height: none;
  }
}

@media (max-width: 720px) {
  .analysis-topbar,
  .detail-panel header {
    align-items: stretch;
    flex-direction: column;
  }

  .analysis-summary,
  .radar-legend,
  .compact-metrics,
  .profile-columns {
    grid-template-columns: 1fr;
  }

  .donut-row {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .knowledge-diagnosis div {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .knowledge-diagnosis em,
  .knowledge-diagnosis i {
    justify-self: start;
  }
}
</style>
