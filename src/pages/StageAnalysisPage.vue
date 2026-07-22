<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CourseWorkflowRail from '../components/CourseWorkflowRail.vue';
import { fetchCourseAnalysis, fetchCourseQuestionDetail, streamCourseAnalysisReport } from '../data/courseAnalysisApiClient.js';
import { listQuestionBanks } from '../data/questionBankApiClient.js';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => String(route.params.courseId || ''));
const analysis = ref(null);
const loading = ref(true);
const loadError = ref('');
const selectedClassId = ref(String(route.query.classId || ''));
const selectedSessionId = ref(String(route.query.sessionId || ''));
const activeTab = ref('questions');
const search = ref('');
const expandedQuestionId = ref('');
const questionDetails = ref({});
const detailLoadingId = ref('');
const detailError = ref('');
const aiGenerating = ref(false);
const aiStreamText = ref('');
const aiError = ref('');
const bankDialogOpen = ref(false);
const banks = ref([]);
const bankLoading = ref(false);
const bankError = ref('');
let requestSequence = 0;

const summary = computed(() => analysis.value?.summary || {});
const latestReport = computed(() => analysis.value?.latestReport || null);
const filteredQuestions = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return (analysis.value?.questionStats || []).filter((item) => !keyword || [item.title, item.weakPoint, ...(item.knowledge || [])].join(' ').toLowerCase().includes(keyword));
});

function filters() {
  return { classId: selectedClassId.value || undefined, sessionId: selectedSessionId.value || undefined };
}

async function loadAnalysis(force = false) {
  const current = ++requestSequence;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await fetchCourseAnalysis(courseId.value, filters(), { force });
    if (current === requestSequence) analysis.value = result;
  } catch (error) {
    if (current === requestSequence) loadError.value = error.message || '题析数据加载失败';
  } finally {
    if (current === requestSequence) loading.value = false;
  }
}

async function syncFilterQuery() {
  const query = { ...route.query };
  if (selectedClassId.value) query.classId = selectedClassId.value; else delete query.classId;
  if (selectedSessionId.value) query.sessionId = selectedSessionId.value; else delete query.sessionId;
  await router.replace({ query });
  expandedQuestionId.value = '';
  await loadAnalysis(true);
}

async function changeClass(event) {
  selectedClassId.value = event.target.value;
  selectedSessionId.value = '';
  await syncFilterQuery();
}

async function changeSession(event) {
  selectedSessionId.value = event.target.value;
  await syncFilterQuery();
}

async function openQuestionDetail(questionId) {
  if (expandedQuestionId.value === questionId) { expandedQuestionId.value = ''; return; }
  expandedQuestionId.value = questionId;
  if (questionDetails.value[questionId]) return;
  detailLoadingId.value = questionId;
  detailError.value = '';
  try {
    questionDetails.value = { ...questionDetails.value, [questionId]: await fetchCourseQuestionDetail(courseId.value, questionId, filters()) };
  } catch (error) {
    detailError.value = error.message || '题目详情加载失败';
  } finally {
    detailLoadingId.value = '';
  }
}

async function generateAiReport() {
  aiGenerating.value = true;
  aiStreamText.value = '';
  aiError.value = '';
  try {
    await streamCourseAnalysisReport(courseId.value, filters(), {
      onDelta: (text) => { aiStreamText.value += text; },
      onReport: (report) => { analysis.value = { ...analysis.value, latestReport: report }; }
    });
    await loadAnalysis(true);
    activeTab.value = 'report';
  } catch (error) {
    aiError.value = error.message || 'AI 分析生成失败';
  } finally {
    aiGenerating.value = false;
  }
}

async function openBankDialog() {
  if (!latestReport.value?.id) { activeTab.value = 'report'; aiError.value = '请先生成当前范围的 AI 分析报告'; return; }
  bankDialogOpen.value = true;
  bankLoading.value = true;
  bankError.value = '';
  try {
    const result = await listQuestionBanks({ pageSize: 100 }, { force: true });
    banks.value = result.data || [];
  } catch (error) {
    bankError.value = error.message || '题库列表加载失败';
  } finally {
    bankLoading.value = false;
  }
}

function chooseBank(bankId) {
  router.push({ path: `/question-banks/${bankId}/generate`, query: { analysisReportId: latestReport.value.id } });
}

function formatAnswer(value) {
  if (value && typeof value === 'object' && 'value' in value) return String(value.value ?? '');
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

onMounted(() => loadAnalysis());
</script>

<template>
  <main class="analysis-page">
    <header class="analysis-header">
      <button class="back-btn" type="button" @click="router.push(`/preclass/courses/${courseId}/workspace`)"><span class="material-symbols-outlined">chevron_left</span>返回课程</button>
      <div class="header-copy">
        <span>COURSE INTELLIGENCE</span>
        <h1>课程题析</h1>
        <p>{{ analysis?.course?.title || '正在读取课程信息…' }} · 真实课堂答题数据与 AI 教学洞察</p>
      </div>
      <div class="header-actions">
        <button class="soft-btn" type="button" @click="openBankDialog"><span class="material-symbols-outlined">library_add</span>引用学情生成题目</button>
        <button class="primary-btn" type="button" :disabled="aiGenerating || !summary.answerCount" @click="generateAiReport"><span class="material-symbols-outlined">auto_awesome</span>{{ aiGenerating ? '分析生成中…' : '生成 AI 分析' }}</button>
      </div>
    </header>

    <section class="analysis-shell">
      <CourseWorkflowRail :course-id="courseId" active-step="analysis" />
      <section class="analysis-scroll">
        <div v-if="loadError" class="state-card error-state"><strong>暂时无法读取题析数据</strong><p>{{ loadError }}</p><button class="primary-btn" type="button" @click="loadAnalysis(true)">重新加载</button></div>
        <template v-else>
          <section class="filter-bar">
            <div><span>分析范围</span><strong>{{ analysis?.scope?.type === 'session' ? '单次课堂' : analysis?.scope?.type === 'class' ? '指定班级' : '整门课程' }}</strong></div>
            <label>班级<select :value="selectedClassId" @change="changeClass"><option value="">全部班级</option><option v-for="item in analysis?.filters?.classes || []" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
            <label>课堂场次<select :value="selectedSessionId" @change="changeSession"><option value="">全部场次</option><option v-for="item in analysis?.filters?.sessions || []" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
            <span class="updated">数据更新时间 {{ formatDate(analysis?.source?.updatedAt) }}</span>
          </section>

          <section class="kpi-grid" :class="{ loading }">
            <article><span>参与学生</span><strong>{{ summary.participantCount || 0 }}</strong><em>去重学生</em></article>
            <article><span>作答次数</span><strong>{{ summary.answerCount || 0 }}</strong><em>有效提交</em></article>
            <article class="accent"><span>平均正确率</span><strong>{{ summary.accuracy || 0 }}%</strong><em>全部作答</em></article>
            <article><span>平均用时</span><strong>{{ summary.averageTimeSeconds || 0 }}<small>s</small></strong><em>有效计时</em></article>
            <article><span>薄弱题目</span><strong>{{ summary.weakQuestionCount || 0 }}</strong><em>正确率低于 60%</em></article>
          </section>

          <nav class="tabs"><button :class="{ active: activeTab === 'questions' }" @click="activeTab = 'questions'">题目统计</button><button :class="{ active: activeTab === 'answers' }" @click="activeTab = 'answers'">作答明细</button><button :class="{ active: activeTab === 'report' }" @click="activeTab = 'report'">AI 分析报告</button></nav>

          <section class="content-grid">
            <div class="main-panel">
              <template v-if="activeTab === 'questions'">
                <div class="panel-title"><div><span>QUESTION PERFORMANCE</span><h2>薄弱题优先</h2></div><label class="search-box"><span class="material-symbols-outlined">search</span><input v-model="search" type="search" placeholder="搜索题目、知识点或错因"></label></div>
                <div v-if="!filteredQuestions.length" class="empty-state"><span class="material-symbols-outlined">quiz</span><strong>{{ analysis?.questionStats?.length ? '没有匹配的题目' : '课程还没有可分析的题目' }}</strong><p>课程题目产生课堂作答后，这里会自动形成统计。</p></div>
                <article v-for="(question, index) in filteredQuestions" :key="question.id" class="question-card" :class="{ weak: question.answerCount && question.accuracy < 60 }">
                  <button class="question-main" type="button" @click="openQuestionDetail(question.id)"><span class="rank">{{ String(index + 1).padStart(2, '0') }}</span><div><div class="chips"><i>{{ question.type }}</i><i>{{ question.difficulty }}</i><i v-for="point in question.knowledge" :key="point">{{ point }}</i></div><h3>{{ question.title }}</h3><p>{{ question.weakPoint || question.analysis || '暂无错因说明' }}</p></div><div class="metric"><strong>{{ question.accuracy }}%</strong><span>{{ question.answerCount }} 次作答</span></div><span class="material-symbols-outlined">{{ expandedQuestionId === question.id ? 'expand_less' : 'expand_more' }}</span></button>
                  <section v-if="expandedQuestionId === question.id" class="question-detail">
                    <p v-if="detailLoadingId === question.id">正在加载学生作答详情…</p><p v-else-if="detailError" class="error-copy">{{ detailError }}</p>
                    <template v-else-if="questionDetails[question.id]"><div class="detail-metrics"><span>正确 {{ questionDetails[question.id].metrics.correctCount }}</span><span>错误 {{ questionDetails[question.id].metrics.wrongCount }}</span><span>平均 {{ questionDetails[question.id].metrics.averageTimeSeconds }} 秒</span></div><div class="distribution"><h4>答案分布</h4><div v-for="item in questionDetails[question.id].answerDistribution" :key="item.value"><span>{{ item.value }}</span><i><b :style="{ width: `${item.percent}%` }"></b></i><strong>{{ item.count }} 人 · {{ item.percent }}%</strong></div></div><div class="student-table"><h4>学生提交答案</h4><div class="table-head"><span>学生</span><span>答案</span><span>结果</span><span>课堂</span><span>提交时间</span></div><div v-for="item in questionDetails[question.id].submissions" :key="item.id"><span>{{ item.studentName }}</span><span>{{ formatAnswer(item.answer) }}</span><span :class="item.isCorrect ? 'correct' : 'wrong'">{{ item.isCorrect ? '正确' : '错误' }}</span><span>{{ item.sessionTitle }}</span><span>{{ formatDate(item.submittedAt) }}</span></div></div></template>
                  </section>
                </article>
              </template>

              <template v-else-if="activeTab === 'answers'">
                <div class="panel-title"><div><span>ANSWER LOG</span><h2>最近作答明细</h2></div><em>{{ analysis?.answerRecords?.length || 0 }} 条</em></div>
                <div v-if="!analysis?.answerRecords?.length" class="empty-state"><span class="material-symbols-outlined">history</span><strong>暂无课堂作答</strong><p>学生提交答案后会在这里显示。</p></div>
                <div v-else class="answer-table"><div class="table-head"><span>学生</span><span>题目</span><span>答案</span><span>结果</span><span>用时</span><span>课堂</span></div><div v-for="item in analysis.answerRecords" :key="item.id"><span>{{ item.studentName }}</span><span>{{ item.questionTitle }}</span><span>{{ formatAnswer(item.answer) }}</span><span :class="item.isCorrect ? 'correct' : 'wrong'">{{ item.isCorrect ? '正确' : '错误' }}</span><span>{{ item.durationSeconds }}s</span><span>{{ item.sessionTitle }}</span></div></div>
              </template>

              <template v-else>
                <div class="panel-title"><div><span>AI REPORT</span><h2>当前范围分析报告</h2></div><button class="primary-btn" type="button" :disabled="aiGenerating || !summary.answerCount" @click="generateAiReport">{{ latestReport ? '重新生成' : '生成报告' }}</button></div>
                <div v-if="aiGenerating" class="stream-card"><span class="material-symbols-outlined">auto_awesome</span><strong>DeepSeek 正在分析真实答题数据</strong><p>{{ aiStreamText || '正在梳理课程表现与薄弱题…' }}</p></div>
                <div v-else-if="latestReport" class="report-body"><div v-if="latestReport.isStale" class="stale-banner"><span class="material-symbols-outlined">update</span>答题数据已经更新，当前报告仍可查看，建议重新生成。</div><h3>{{ latestReport.summary?.overview || '课程学情结论' }}</h3><ul><li v-for="item in latestReport.summary?.conclusions || []" :key="item">{{ item }}</li></ul><h3>薄弱知识点</h3><div class="weak-grid"><article v-for="item in latestReport.weakPoints" :key="item.name"><strong>{{ item.name }}</strong><p>{{ item.evidence }}</p><em>{{ item.priority || '建议关注' }}</em></article></div><h3>教学建议</h3><ol><li v-for="item in latestReport.teachingSuggestions" :key="item">{{ item }}</li></ol></div>
                <div v-else class="empty-state"><span class="material-symbols-outlined">auto_awesome</span><strong>还没有 AI 分析报告</strong><p>客观统计已经就绪。点击生成后才会调用 DeepSeek，并保存当前筛选范围的报告。</p></div>
                <p v-if="aiError" class="error-copy">{{ aiError }}</p>
              </template>
            </div>

            <aside class="insight-panel"><span class="eyebrow">TEACHING SIGNAL</span><h2>本次教学信号</h2><div class="signal"><strong>{{ summary.accuracy || 0 }}%</strong><span>课程平均正确率</span><i><b :style="{ width: `${summary.accuracy || 0}%` }"></b></i></div><h3>优先讲评</h3><button v-for="item in (analysis?.questionStats || []).filter(q => q.answerCount).slice(0, 3)" :key="item.id" @click="activeTab = 'questions'; openQuestionDetail(item.id)"><span>{{ item.accuracy }}%</span><strong>{{ item.title }}</strong></button><div class="report-status"><span class="material-symbols-outlined">{{ latestReport?.isStale ? 'update' : latestReport ? 'verified' : 'pending_actions' }}</span><div><strong>{{ latestReport?.isStale ? '报告需要更新' : latestReport ? 'AI 报告已保存' : '等待生成报告' }}</strong><p>{{ latestReport ? formatDate(latestReport.generatedAt) : '不会自动消耗 AI 调用' }}</p></div></div></aside>
          </section>
        </template>
      </section>
    </section>

    <Teleport to="body"><div v-if="bankDialogOpen" class="dialog-backdrop" @click.self="bankDialogOpen = false"><section class="bank-dialog" role="dialog" aria-modal="true"><header><div><span>SELECT QUESTION BANK</span><h2>选择目标题库</h2><p>当前学情报告会作为 AI 生题上下文。</p></div><button type="button" @click="bankDialogOpen = false"><span class="material-symbols-outlined">close</span></button></header><p v-if="bankLoading">正在读取题库…</p><p v-else-if="bankError" class="error-copy">{{ bankError }}</p><div v-else class="bank-list"><button v-for="bank in banks" :key="bank.id" type="button" @click="chooseBank(bank.id)"><span class="material-symbols-outlined">library_books</span><div><strong>{{ bank.title }}</strong><p>{{ bank.subject }} · {{ bank.grade || '全年级' }}</p></div><span class="material-symbols-outlined">arrow_forward</span></button><p v-if="!banks.length">暂无可用题库，请先创建题库。</p></div></section></div></Teleport>
  </main>
</template>

<style scoped>
.analysis-page{height:100vh;overflow:hidden;background:#f3f8f5;color:var(--ink)}.analysis-header{height:var(--edu-topbar-h);display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:24px;padding:0 var(--edu-page-pad);border-bottom:1px solid var(--line);background:rgba(255,255,255,.94)}.back-btn,.header-actions,.header-actions button{display:flex;align-items:center;gap:8px}.back-btn{border:0;background:none;font-weight:800}.header-copy span,.panel-title span,.eyebrow,.bank-dialog header span{color:#1f9b59;font:700 10px/1.2 var(--font-mono);letter-spacing:.14em}.header-copy h1{font-family:var(--font-serif);font-size:28px}.header-copy p{margin-top:3px;color:var(--muted);font-size:12px}.header-actions{justify-content:flex-end}.analysis-shell{height:calc(100vh - var(--edu-topbar-h));display:grid;grid-template-columns:64px minmax(0,1fr);overflow:hidden}.analysis-scroll{overflow-y:auto;padding:22px var(--edu-page-pad) 56px}.state-card,.filter-bar,.kpi-grid article,.main-panel,.insight-panel{border:1px solid var(--line);background:rgba(255,255,255,.84);border-radius:16px}.error-state{padding:28px}.filter-bar{display:grid;grid-template-columns:minmax(150px,1fr) 210px 240px auto;align-items:end;gap:16px;padding:14px 18px}.filter-bar>div span,.filter-bar label,.updated{display:grid;gap:6px;color:var(--muted);font-size:11px;font-weight:750}.filter-bar>div strong{font-size:18px}.filter-bar select{height:38px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:0 12px;color:var(--ink);font-weight:700}.updated{align-self:center;justify-self:end}.kpi-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:14px}.kpi-grid.loading{opacity:.45}.kpi-grid article{min-height:118px;padding:18px}.kpi-grid article.accent{background:#143e2b;color:#fff}.kpi-grid span,.kpi-grid em{display:block;color:var(--muted);font-size:11px;font-style:normal}.kpi-grid .accent span,.kpi-grid .accent em{color:#b8d2c3}.kpi-grid strong{display:block;margin:13px 0 9px;font:800 34px/1 var(--font-mono)}.kpi-grid small{font-size:14px}.tabs{display:flex;gap:4px;margin:18px 0 12px;border-bottom:1px solid var(--line)}.tabs button{border:0;border-bottom:2px solid transparent;background:none;padding:11px 18px;color:var(--muted);font-weight:800}.tabs button.active{border-color:#1fa95e;color:#137944}.content-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}.main-panel,.insight-panel{padding:20px}.panel-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.panel-title h2,.insight-panel h2,.bank-dialog h2{margin-top:4px;font:800 24px/1.2 var(--font-serif)}.panel-title em{font-style:normal;color:var(--muted)}.search-box{width:min(340px,45%);height:40px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:11px;background:#fff;padding:0 12px}.search-box input{width:100%;border:0;outline:0;background:none}.question-card{overflow:hidden;border-top:1px solid var(--line)}.question-card:first-of-type{border-top:0}.question-card.weak{background:linear-gradient(90deg,rgba(255,241,225,.55),transparent 55%)}.question-main{width:100%;display:grid;grid-template-columns:44px minmax(0,1fr) 82px 24px;align-items:center;gap:14px;border:0;background:none;padding:17px 6px;text-align:left}.rank{color:#95a69c;font:700 14px var(--font-mono)}.question-main h3{margin:7px 0 5px;font-size:15px}.question-main p{color:var(--muted);font-size:12px}.chips{display:flex;flex-wrap:wrap;gap:5px}.chips i{border-radius:99px;background:#edf6f0;padding:3px 7px;color:#347452;font-size:9px;font-style:normal;font-weight:800}.metric{text-align:right}.metric strong,.metric span{display:block}.metric strong{color:#d66c2c;font:800 22px var(--font-mono)}.metric span{margin-top:4px;color:var(--muted);font-size:10px}.question-detail{border-top:1px solid #dce9e0;background:#f7fbf8;padding:18px 64px}.detail-metrics{display:flex;gap:8px}.detail-metrics span{border-radius:8px;background:#fff;padding:7px 10px;font-size:11px;font-weight:800}.distribution{margin-top:16px}.distribution h4,.student-table h4{margin-bottom:9px}.distribution>div{display:grid;grid-template-columns:70px minmax(0,1fr) 100px;align-items:center;gap:10px;margin:7px 0;font-size:11px}.distribution i{height:7px;border-radius:99px;background:#dfe9e2}.distribution b{display:block;height:100%;border-radius:inherit;background:#28ae67}.student-table{margin-top:18px;overflow-x:auto}.student-table>div,.answer-table>div{min-width:650px;display:grid;grid-template-columns:110px minmax(100px,1fr) 72px 140px 120px;gap:10px;padding:9px;border-top:1px solid var(--line);font-size:11px}.student-table .table-head,.answer-table .table-head{border:0;background:#edf4ef;font-weight:800}.correct{color:#16834a;font-weight:800}.wrong,.error-copy{color:#c84934;font-weight:800}.answer-table{overflow-x:auto}.answer-table>div{grid-template-columns:100px minmax(180px,1.5fr) minmax(90px,1fr) 60px 55px minmax(120px,1fr)}.empty-state{min-height:280px;display:grid;place-items:center;align-content:center;gap:10px;color:var(--muted);text-align:center}.empty-state .material-symbols-outlined{font-size:40px;color:#35a967}.insight-panel{position:sticky;top:0}.signal{margin:18px 0;padding:18px;border-radius:14px;background:#143e2b;color:#fff}.signal strong,.signal span{display:block}.signal strong{font:800 38px var(--font-mono)}.signal span{margin:5px 0 14px;color:#bcd3c5;font-size:11px}.signal i{height:6px;display:block;border-radius:99px;background:#2b5842}.signal b{display:block;height:100%;border-radius:inherit;background:#65dd95}.insight-panel h3{margin:16px 0 8px;font-size:12px}.insight-panel>button{width:100%;display:grid;grid-template-columns:44px 1fr;gap:10px;border:0;border-top:1px solid var(--line);background:none;padding:12px 0;text-align:left}.insight-panel>button span{color:#d66c2c;font:800 13px var(--font-mono)}.insight-panel>button strong{font-size:11px}.report-status{display:flex;gap:10px;margin-top:16px;border-radius:12px;background:#edf6f0;padding:13px}.report-status p{margin-top:3px;color:var(--muted);font-size:10px}.stream-card,.stale-banner{border-radius:14px;padding:18px}.stream-card{min-height:240px;background:#eef8f2}.stream-card>span{color:#1ba15a;font-size:30px}.stream-card p{margin-top:14px;white-space:pre-wrap;line-height:1.7}.stale-banner{display:flex;align-items:center;gap:8px;background:#fff4df;color:#9a651f}.report-body h3{margin:20px 0 10px}.report-body li{margin:8px 0;line-height:1.6}.weak-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.weak-grid article{border:1px solid var(--line);border-radius:12px;padding:14px}.weak-grid p{margin:7px 0;color:var(--muted);font-size:12px}.weak-grid em{color:#d16b2f;font-size:10px;font-style:normal}.dialog-backdrop{position:fixed;inset:0;z-index:300;display:grid;place-items:center;background:rgba(10,32,21,.42);backdrop-filter:blur(8px)}.bank-dialog{width:min(620px,calc(100vw - 40px));max-height:75vh;overflow:auto;border-radius:20px;background:#f8fcf9;padding:22px;box-shadow:0 32px 90px rgba(9,38,22,.3)}.bank-dialog header{display:flex;justify-content:space-between}.bank-dialog header button{width:36px;height:36px;border:0;border-radius:50%;background:#e9f4ed}.bank-dialog header p{margin-top:7px;color:var(--muted)}.bank-list{display:grid;gap:9px;margin-top:18px}.bank-list button{display:grid;grid-template-columns:36px 1fr 24px;align-items:center;gap:12px;border:1px solid var(--line);border-radius:13px;background:#fff;padding:13px;text-align:left}.bank-list p{margin-top:4px;color:var(--muted);font-size:11px}@media(max-width:1100px){.analysis-header{grid-template-columns:auto 1fr}.header-actions{grid-column:1/-1;display:none}.kpi-grid{grid-template-columns:repeat(3,1fr)}.content-grid{grid-template-columns:1fr}.insight-panel{position:static}.filter-bar{grid-template-columns:1fr 1fr}.updated{justify-self:start}}@media(max-width:720px){.analysis-shell{grid-template-columns:1fr}.analysis-shell>:first-child{display:none}.analysis-scroll{padding:14px}.analysis-header{padding:0 14px}.header-copy p{display:none}.filter-bar,.kpi-grid{grid-template-columns:1fr}.question-main{grid-template-columns:30px 1fr}.question-main .metric,.question-main>.material-symbols-outlined{display:none}.question-detail{padding:14px}.weak-grid{grid-template-columns:1fr}}
</style>
