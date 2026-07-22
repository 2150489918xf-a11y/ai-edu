<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { getAdminSummary } from '../../data/adminApiClient';

const loading = ref(true);
const error = ref('');
const summary = ref({});

const summaryItems = computed(() => [
  { label: '教师', value: summary.value.teacherCount || 0, icon: 'co_present', to: '/admin/teachers', note: '教师账号与任教关系' },
  { label: '学生', value: summary.value.studentCount || 0, icon: 'school', to: '/admin/students', note: '学生档案与班级归属' },
  { label: '班级', value: summary.value.classCount || 0, icon: 'groups', to: '/admin/classes', note: '教学班与负责人' },
  { label: '课程', value: summary.value.courseCount || 0, icon: 'menu_book', to: '/admin/courses', note: '课程基础信息与任课教师' },
  { label: '个人课程分配', value: summary.value.enrollmentCount || 0, icon: 'assignment_ind', to: '/admin/enrollments', note: '学生个人课程关系' }
]);

async function loadSummary(options = {}) {
  loading.value = true;
  error.value = '';
  try {
    summary.value = await getAdminSummary(options);
  } catch (err) {
    error.value = err.message || '教务统计加载失败';
  } finally {
    loading.value = false;
  }
}

function handleRefresh() { loadSummary({ force: true }); }
onMounted(() => {
  loadSummary();
  window.addEventListener('admin:refresh', handleRefresh);
});
onBeforeUnmount(() => window.removeEventListener('admin:refresh', handleRefresh));
</script>

<template>
  <section class="admin-page">
    <header class="admin-page-header">
      <div><h2>教学组织概览</h2><p>查看当前人员、班级、课程和分配数据。</p></div>
      <RouterLink class="admin-button" to="/admin/enrollments">
        <span class="material-symbols-outlined">add_task</span>课程分配
      </RouterLink>
    </header>

    <p v-if="error" class="admin-notice is-error">{{ error }}</p>
    <div class="admin-overview-grid" :aria-busy="loading">
      <RouterLink v-for="item in summaryItems" :key="item.label" class="admin-metric-card" :to="item.to">
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <div><strong>{{ loading ? '—' : item.value }}</strong><b>{{ item.label }}</b><small>{{ item.note }}</small></div>
        <span class="material-symbols-outlined admin-metric-arrow">arrow_forward</span>
      </RouterLink>
    </div>

    <section class="admin-panel admin-overview-guide">
      <header><div><h3>常用管理</h3><p>按教务工作流程进入对应模块。</p></div></header>
      <div>
        <RouterLink to="/admin/teachers"><span class="material-symbols-outlined">person_add</span><b>新增教师</b><small>创建教师登录账号与档案</small></RouterLink>
        <RouterLink to="/admin/students"><span class="material-symbols-outlined">person_add_alt</span><b>新增学生</b><small>建立学号、账号与班级关系</small></RouterLink>
        <RouterLink to="/admin/classes"><span class="material-symbols-outlined">group_add</span><b>新建班级</b><small>配置年级、学科和负责人</small></RouterLink>
        <RouterLink to="/admin/courses"><span class="material-symbols-outlined">library_add</span><b>新建课程</b><small>配置课程和任课教师</small></RouterLink>
      </div>
    </section>
  </section>
</template>

<style scoped>
.admin-overview-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .75rem; }
.admin-metric-card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; min-height: 8.5rem; align-items: start; gap: .875rem; border: 1px solid var(--admin-border); border-radius: .625rem; background: #fff; color: var(--admin-text); padding: 1.125rem; text-decoration: none; transition: border-color .18s ease, transform .18s ease; }
.admin-metric-card:hover { border-color: #9bc7b2; transform: translateY(-2px); }
.admin-metric-card > .material-symbols-outlined:first-child { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: .5rem; background: var(--admin-accent-soft); color: var(--admin-accent); }
.admin-metric-card div { display: grid; gap: .2rem; }
.admin-metric-card strong { font-size: 1.75rem; font-variant-numeric: tabular-nums; line-height: 1; }
.admin-metric-card b { font-size: .875rem; }
.admin-metric-card small { color: var(--admin-muted); font-size: .75rem; line-height: 1.5; }
.admin-metric-arrow { color: #9aa6a1; font-size: 1rem; }
.admin-overview-guide { padding: 1.25rem; }
.admin-overview-guide header h3 { margin: 0; font-size: 1rem; }
.admin-overview-guide header p { margin: .3rem 0 0; color: var(--admin-muted); font-size: .8125rem; }
.admin-overview-guide > div { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; margin-top: 1rem; }
.admin-overview-guide a { display: grid; grid-template-columns: auto 1fr; gap: .25rem .65rem; border: 1px solid var(--admin-border); border-radius: .5rem; color: var(--admin-text); padding: .875rem; text-decoration: none; }
.admin-overview-guide a .material-symbols-outlined { grid-row: 1 / 3; color: var(--admin-accent); }
.admin-overview-guide a b { font-size: .8125rem; }
.admin-overview-guide a small { color: var(--admin-muted); font-size: .75rem; }
@media (max-width: 1279px) { .admin-overview-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 767px) { .admin-overview-grid, .admin-overview-guide > div { grid-template-columns: 1fr; } }
</style>
