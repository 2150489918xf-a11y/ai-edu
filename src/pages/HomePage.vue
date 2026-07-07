<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { notify, store } from '../data/mockStore';

const router = useRouter();
const activeMode = ref('prep');
const reportGenerated = ref(false);

const modes = {
  prep: {
    title: '函数单调性需要补齐例题梯度',
    text: '上周测验显示学生能读图判断增减区间，但在定义证明和区间书写上仍有分化，建议先补一组分层例题。',
    progress: 78,
    lesson: '高一函数单调性',
    status: '78% 进度',
    route: '/preclass/courses'
  },
  live: {
    title: '下一节课建议加入区间书写诊断',
    text: '课堂讲到单调区间判断后，建议下发 1 道图像题，现场判断学生是否会把端点和定义域一起考虑。',
    progress: 72,
    lesson: '课中授课 ・ 高一函数单调性',
    status: '72% 准备',
    route: '/in-class/ppts'
  },
  review: {
    title: '课后总结待生成学情报告',
    text: '系统已回收函数图像判断、定义辨析和区间书写错因，可生成阶段分析和下一轮讲评建议。',
    progress: 81,
    lesson: '课后反馈 ・ 高一函数单调性',
    status: '81% 回收',
    route: '/after-class'
  },
  bank: {
    title: '题库建议补充分层变式题',
    text: '“由图像写单调区间”和“用定义证明单调性”的题目偏少，建议生成 6 道分层诊断题。',
    progress: 64,
    lesson: '习题库 ・ 高一函数单调性专项',
    status: '64% 覆盖',
    route: '/question-banks'
  }
};

const active = computed(() => modes[activeMode.value]);
const monotonicityCourse = computed(() => store.courses.find((course) => course.id === 'math-monotonicity'));
const progressValue = computed(() => (reportGenerated.value ? 68 : active.value.progress));

function openMode(mode) {
  activeMode.value = mode;
  router.push(modes[mode].route);
}

function generatePlan() {
  reportGenerated.value = true;
  notify('已生成本周复习大纲');
}
</script>

<template>
  <section class="home-content">
    <header class="topbar">
      <div class="brand-row">
        <img class="brand-logo" src="/assets/eduai-logo.png" alt="EduAI" />
        <div class="brand">EduAI Workbench</div>
        <span class="brand-chip">教师办公系统</span>
      </div>
      <label class="search">
        <span class="material-symbols-outlined">search</span>
        <input type="search" placeholder="搜索资源、文档..." />
      </label>
      <div class="top-actions">
        <button class="circle-btn" type="button" aria-label="通知" @click="notify('暂无新的系统通知')">
          <span class="material-symbols-outlined">notifications</span>
        </button>
        <button class="circle-btn" type="button" aria-label="帮助" @click="notify('演示模式：所有数据均为前端 Mock')">
          <span class="material-symbols-outlined">help</span>
        </button>
      </div>
    </header>

    <main>
      <section class="hero">
        <p class="welcome">欢迎回来，王老师 ・ 2026 年 6 月 1 日 ・ 周一</p>
        <div class="title-row">
          <h1>首页</h1>
          <div class="hero-actions">
            <button class="soft-btn" type="button" @click="notify('已切换到本周视图')">
              <span class="material-symbols-outlined">calendar_month</span>
              本周
              <span class="material-symbols-outlined">expand_more</span>
            </button>
            <button class="primary-btn" type="button" @click="notify('报表已导出到演示下载队列')">
              <span class="material-symbols-outlined">download</span>
              导出报表
            </button>
          </div>
        </div>
      </section>

      <section class="quick-grid" aria-label="课时生命周期入口">
        <button class="quick-card active" type="button" @click="openMode('prep')">
          <span class="arrow"><span class="material-symbols-outlined">arrow_forward</span></span>
          <h2>课前准备</h2>
          <p>教案、资料与课堂任务</p>
          <span class="pill"><i class="pill-dot"></i>3 项待处理</span>
          <i class="card-art"></i>
        </button>
        <button class="quick-card" type="button" @click="openMode('live')">
          <span class="arrow"><span class="material-symbols-outlined">arrow_forward</span></span>
          <h2>进入课堂</h2>
          <p>快速开始当前课时</p>
          <span class="pill"><i class="pill-dot"></i>下一节 08:30</span>
          <i class="card-art play"></i>
        </button>
        <button class="quick-card" type="button" @click="openMode('review')">
          <span class="arrow"><span class="material-symbols-outlined">arrow_forward</span></span>
          <h2>课后总结</h2>
          <p>回收反馈与生成总结</p>
          <span class="pill"><i class="pill-dot"></i>2 份待生成</span>
          <i class="card-art bars"><span></span><span></span><span></span></i>
        </button>
        <button class="quick-card" type="button" @click="openMode('bank')">
          <span class="arrow"><span class="material-symbols-outlined">arrow_forward</span></span>
          <h2>习题库</h2>
          <p>按知识点筛题练习</p>
          <span class="pill"><i class="pill-dot"></i>432 道题</span>
          <i class="card-art"></i>
        </button>
      </section>

      <section class="content-grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>本周教学重点分析</h2>
              <p>基于上周测验、课堂互动和错题数据，系统自动整理本周需要优先处理的知识点，并生成可直接使用的复习大纲。</p>
            </div>
          </div>

          <div class="metrics">
            <div class="metric"><strong>128</strong><span>条课堂数据</span></div>
            <div class="metric"><strong>5</strong><span>个薄弱点</span></div>
            <div class="metric"><strong style="color:var(--green)">+12%</strong><span>错误率上升</span></div>
          </div>

          <div class="analysis-body">
            <article class="ai-advice">
              <div class="advice-top">
                <span class="small-chip"><span class="material-symbols-outlined">auto_awesome</span>AI 教学建议</span>
              </div>
              <div class="advice-main">
                <h3>{{ active.title }}</h3>
                <p>{{ active.text }}</p>
              </div>
              <button class="advice-action" type="button" @click="generatePlan">
                {{ reportGenerated ? '已生成复习大纲' : '生成复习大纲' }}
              </button>
            </article>

            <div class="risk-list">
              <header><strong>本周风险诊断</strong><span>按错误率排序</span></header>
              <div class="risk-row">
                <b>01</b><strong>单调区间书写</strong><small>错误率 +12%</small>
                <div class="bar"><i style="width:100%"></i></div>
              </div>
              <div class="risk-row">
                <b>02</b><strong>图像端点判断</strong><small>待补 6 题</small>
                <div class="bar"><i style="width:74%"></i></div>
              </div>
              <div class="risk-row">
                <b>03</b><strong>定义证明步骤</strong><small>3 个潜在弱项</small>
                <div class="bar"><i style="width:45%"></i></div>
              </div>
              <nav class="risk-tabs" aria-label="分析视图">
                <button class="active" type="button">诊断</button>
                <button type="button" @click="router.push('/question-banks')">练习</button>
                <button type="button" @click="router.push('/after-class')">回收</button>
              </nav>
            </div>
          </div>
        </section>

        <aside class="panel plan-panel">
          <div class="plan-title">
            <div>
              <span class="small-chip">备课进度</span>
              <h2>本周备课计划</h2>
            </div>
            <button class="more-btn" type="button" @click="notify('已打开备课计划菜单')">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <div class="progress-head">
            <span>本周材料完成度</span>
            <strong>{{ progressValue }}%</strong>
          </div>
          <div class="progress-line"><i :style="{ width: `${progressValue}%` }"></i></div>
          <div class="progress-meta"><span>{{ monotonicityCourse?.hasOutline ? '1 项已完成' : '0 项已完成' }}</span><span>目标 3 项</span></div>
          <div class="next-lesson">
            <small>下一节课</small>
            <div class="lesson-line">
              <strong>{{ active.lesson }}</strong>
              <span>周一 08:30 ・ A203</span>
            </div>
            <span class="status-pill">{{ reportGenerated ? '68% 进度' : active.status }}</span>
          </div>
          <small class="todo-heading">今日待推进</small>
          <div class="task-list">
            <div class="task"><span class="material-symbols-outlined">description</span><span>校对《高一函数单调性》课件</span><em>待整理</em></div>
            <div class="task"><span class="material-symbols-outlined">emoji_objects</span><span>补充分层诊断题</span><em style="color:var(--green)">AI 草稿</em></div>
            <div class="task"><span class="material-symbols-outlined">check_circle</span><span>回收函数图像错题</span><em class="is-done">已分配</em></div>
          </div>
        </aside>
      </section>
    </main>
  </section>
</template>
