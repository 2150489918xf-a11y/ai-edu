<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { logout } from './data/authApiClient';
import { store } from './data/mockStore';

const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 1080;
const route = useRoute();
const router = useRouter();
const scale = ref(1);

const navItems = [
  { to: '/', label: '工作台', icon: 'home' },
  { to: '/preclass/courses', label: '课前', icon: 'edit_calendar' },
  { to: '/knowledge-base', label: '知识库', icon: 'folder_open' },
  { to: '/question-banks', label: '题库', icon: 'quiz' },
  { to: '/in-class/ppts', label: '课中', icon: 'cast_for_education' },
  { to: '/learning-analysis', label: '学情分析', icon: 'analytics' }
];

const usesFullscreen = computed(() => Boolean(route.meta.fullscreen));

const frameStyle = computed(() => {
  if (usesFullscreen.value) {
    return {};
  }
  return {
    transform: `scale(${scale.value})`
  };
});

function updateScale() {
  scale.value = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT, 1);
}

function isActive(item) {
  if (item.to === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(item.to.split('/').slice(0, 2).join('/'));
}

function handleTeacherLogout() {
  logout();
  router.replace('/login');
}

onMounted(() => {
  updateScale();
  window.addEventListener('resize', updateScale);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateScale);
});
</script>

<template>
  <div class="app-viewport">
    <main class="app-frame" :class="{ 'is-fullscreen': usesFullscreen }" :style="frameStyle">
      <template v-if="usesFullscreen">
        <RouterView />
      </template>

      <template v-else>
        <aside class="side-rail" aria-label="主导航">
          <nav class="rail-group">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              v-slot="{ navigate, href }"
              :to="item.to"
              custom
            >
              <a
                class="rail-btn"
                :class="{ active: isActive(item) }"
                :href="href"
                :data-tip="item.label"
                :aria-label="item.label"
                @click="navigate"
              >
                <span class="material-symbols-outlined">{{ item.icon }}</span>
              </a>
            </RouterLink>
          </nav>
          <button
            type="button"
            class="rail-btn rail-logout"
            data-tip="退出登录"
            aria-label="退出登录"
            @click="handleTeacherLogout"
          >
            <span class="material-symbols-outlined">logout</span>
          </button>
        </aside>
        <section class="shell-content">
          <RouterView />
        </section>
      </template>
    </main>

    <transition name="toast">
      <div v-if="store.toast" class="toast" role="status">
        <span class="material-symbols-outlined">check_circle</span>
        {{ store.toast.message }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.app-viewport {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background:
    radial-gradient(circle at 100% 0%, rgba(176, 232, 200, .72), transparent 28%),
    var(--wash);
}

.app-frame {
  position: relative;
  width: 1440px;
  height: 1080px;
  flex: 0 0 auto;
  overflow: hidden;
  padding: 49px 24px 44px 88px;
  transform-origin: top center;
}

.app-frame.is-fullscreen {
  width: 100vw;
  height: 100vh;
  padding: 0;
  background: var(--wash);
  transform: none;
}

.shell-content {
  width: 100%;
  height: 100%;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 34px;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 999px;
  background: rgba(10, 53, 34, .92);
  color: white;
  box-shadow: var(--shadow);
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 600;
}

.toast .material-symbols-outlined {
  color: #80f3a8;
  font-size: 18px;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
