<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { getStoredAuthUser, logout } from '../data/authApiClient';
import '../styles/admin-system.css';

const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const session = getStoredAuthUser();

const navItems = [
  { to: '/admin/overview', label: '工作台', icon: 'space_dashboard' },
  { to: '/admin/teachers', label: '教师管理', icon: 'co_present' },
  { to: '/admin/students', label: '学生管理', icon: 'school' },
  { to: '/admin/classes', label: '班级管理', icon: 'groups' },
  { to: '/admin/courses', label: '课程管理', icon: 'menu_book' },
  { to: '/admin/enrollments', label: '课程分配', icon: 'assignment_ind' }
];

const pageTitle = computed(() => route.meta.title || '教务管理');
const adminName = computed(() => session?.profile?.name || '教务管理员');

watch(() => route.fullPath, () => {
  menuOpen.value = false;
});

function requestRefresh() {
  window.dispatchEvent(new CustomEvent('admin:refresh'));
}

function handleLogout() {
  logout();
  router.replace('/admin/login');
}
</script>

<template>
  <div class="admin-system-shell">
    <a class="admin-skip-link" href="#admin-main">跳到主要内容</a>
    <button
      v-if="menuOpen"
      class="admin-nav-backdrop"
      type="button"
      aria-label="关闭导航"
      @click="menuOpen = false"
    />

    <aside class="admin-sidebar" :class="{ 'is-open': menuOpen }">
      <div class="admin-brand">
        <span class="admin-brand-mark">ED</span>
        <div>
          <strong>EduAI 教务中心</strong>
          <span>教学组织管理</span>
        </div>
      </div>

      <nav class="admin-nav" aria-label="教务管理导航">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" active-class="router-link-active">
          <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="admin-sidebar-footer">
        <div class="admin-profile-tile">
          <span class="admin-profile-avatar">教</span>
          <div>
            <strong>{{ adminName }}</strong>
            <span>系统管理员</span>
          </div>
        </div>
        <button class="admin-sidebar-logout" type="button" @click="handleLogout">
          <span class="material-symbols-outlined" aria-hidden="true">logout</span>
          退出登录
        </button>
      </div>
    </aside>

    <div class="admin-workspace">
      <header class="admin-topbar">
        <div class="admin-topbar-heading">
          <button class="admin-mobile-menu" type="button" aria-label="打开导航" @click="menuOpen = true">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <div>
            <span>教务管理 / {{ pageTitle }}</span>
            <h1>{{ pageTitle }}</h1>
          </div>
        </div>
        <div class="admin-topbar-actions">
          <button class="admin-icon-button" type="button" title="刷新当前页面" @click="requestRefresh">
            <span class="material-symbols-outlined">refresh</span>
          </button>
          <div class="admin-topbar-user">
            <span class="admin-profile-avatar">教</span>
            <div>
              <strong>{{ adminName }}</strong>
              <span>教务处</span>
            </div>
          </div>
        </div>
      </header>

      <main id="admin-main" class="admin-main" tabindex="-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
