<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../data/authApiClient';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const username = ref('');
const password = ref('');

const isStudentMode = computed(() => route.path.startsWith('/student'));
const isAdminMode = computed(() => route.path.startsWith('/admin'));
const modeLabel = computed(() => {
  if (isAdminMode.value) return '教务处登录';
  return isStudentMode.value ? '学生登录' : '教师登录';
});
const roleHint = computed(() => {
  if (isAdminMode.value) return '进入教师、班级、学生与课程分配管理台';
  return isStudentMode.value ? '进入学生课程与答题界面' : '进入教师备课、题库与学情分析工作台';
});
const demoAccountText = computed(() => {
  if (isAdminMode.value) return 'admin-office / admin123';
  return isStudentMode.value ? 'stu-chenyu / student123' : 'teacher-wang / teacher123';
});

function fillDemoAccount() {
  if (isAdminMode.value) {
    username.value = 'admin-office';
    password.value = 'admin123';
    return;
  }
  username.value = isStudentMode.value ? 'stu-chenyu' : 'teacher-wang';
  password.value = isStudentMode.value ? 'student123' : 'teacher123';
}

function switchMode(mode) {
  if (mode === 'admin') {
    router.replace('/admin/login');
    return;
  }
  router.replace(mode === 'student' ? '/student/login' : '/login');
}

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const session = await login({
      username: username.value,
      password: password.value
    });
    if (session.user?.role === 'student') {
      router.replace({
        path: '/student/courses',
        query: { studentId: session.profile?.id }
      });
      return;
    }
    if (session.user?.role === 'admin') {
      router.replace('/admin');
      return;
    }
    router.replace('/');
  } catch (err) {
    error.value = err.message || '登录失败';
  } finally {
    loading.value = false;
  }
}

watch(() => route.path, fillDemoAccount, { immediate: true });
</script>

<template>
  <main class="login-shell">
    <section class="login-panel">
      <div class="brand-block">
        <span class="small-chip">EduAI</span>
        <h1>{{ modeLabel }}</h1>
        <p>{{ roleHint }}</p>
      </div>

      <div class="mode-switch" aria-label="登录身份">
        <button type="button" :class="{ active: !isStudentMode && !isAdminMode }" @click="switchMode('teacher')">
          <span class="material-symbols-outlined">co_present</span>
          教师登录
        </button>
        <button type="button" :class="{ active: isStudentMode }" @click="switchMode('student')">
          <span class="material-symbols-outlined">school</span>
          学生登录
        </button>
        <button type="button" :class="{ active: isAdminMode }" @click="switchMode('admin')">
          <span class="material-symbols-outlined">admin_panel_settings</span>
          教务处登录
        </button>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label>
          <span>账号</span>
          <input v-model="username" autocomplete="username" placeholder="请输入账号" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" />
        </label>

        <p v-if="error" class="login-error">{{ error }}</p>

        <button type="submit" :disabled="loading">
          <span class="material-symbols-outlined">login</span>
          {{ loading ? '登录中' : '登录' }}
        </button>
      </form>

      <div class="demo-account">
        <strong>演示账号</strong>
        <span>{{ demoAccountText }}</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-shell {
  display: grid;
  width: 100vw;
  height: 100vh;
  place-items: center;
  background:
    radial-gradient(circle at 12% 12%, rgba(81, 201, 135, .22), transparent 32%),
    radial-gradient(circle at 92% 8%, rgba(69, 171, 205, .16), transparent 30%),
    var(--wash);
  color: var(--ink);
  padding: 24px;
}

.login-panel {
  display: grid;
  width: min(460px, 100%);
  gap: 18px;
  border: 1px solid rgba(255, 255, 255, .78);
  border-radius: 18px;
  background: rgba(255, 255, 255, .78);
  box-shadow: var(--shadow-soft);
  padding: 24px;
  backdrop-filter: blur(18px);
}

.brand-block h1 {
  margin: 12px 0 0;
  font-family: var(--font-serif);
  font-size: 34px;
  line-height: 1.2;
}

.brand-block p,
.demo-account span {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  border-radius: 12px;
  background: rgba(16, 55, 35, .06);
  padding: 6px;
}

.mode-switch button,
.login-form button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  font-weight: 800;
}

.mode-switch button {
  background: transparent;
  color: var(--muted);
}

.mode-switch button.active {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 8px 18px rgba(16, 55, 35, .08);
}

.login-form {
  display: grid;
  gap: 14px;
}

.login-form label {
  display: grid;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
}

.login-form input {
  width: 100%;
  min-height: 46px;
  border: 1px solid rgba(16, 55, 35, .14);
  border-radius: 10px;
  background: rgba(255, 255, 255, .9);
  color: var(--ink);
  padding: 0 12px;
  outline: none;
}

.login-form button {
  background: var(--deep);
  color: #80f3a8;
}

.login-form button:disabled {
  cursor: not-allowed;
  opacity: .62;
}

.login-error {
  margin: 0;
  color: #b42318;
  font-size: 13px;
  font-weight: 800;
}

.demo-account {
  display: grid;
  gap: 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .62);
  padding: 12px;
}
</style>
