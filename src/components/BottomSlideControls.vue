<script setup>
defineProps({
  current: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
});

defineEmits(['prev', 'next']);
</script>

<template>
  <footer class="bottom-controls">
    <div class="pager">
      <button class="nav-btn" type="button" aria-label="上一页" :disabled="current === 1" @click="$emit('prev')">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <strong>{{ String(current).padStart(2, '0') }}</strong>
      <span>/ {{ total }}</span>
      <button class="nav-btn next" type="button" aria-label="下一页" :disabled="current === total" @click="$emit('next')">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  </footer>
</template>

<style scoped>
.bottom-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border-top: 1px solid var(--line);
  background: rgba(255, 255, 255, .82);
  backdrop-filter: blur(16px);
}

.pager {
  display: flex;
  align-items: center;
  gap: var(--edu-gap-xs);
}

.nav-btn {
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: #f8fcf9;
  color: var(--ink);
  font-size: var(--edu-body);
  font-weight: 500;
}

.nav-btn {
  width: 34px;
  padding: 0;
}

.nav-btn.next {
  border: 0;
  background: var(--deep);
  color: #80f3a8;
}

.nav-btn:disabled {
  opacity: .45;
  cursor: default;
}

.pager {
  padding: 0 4px;
}

.pager strong {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
}

.pager span {
  color: var(--soft);
  font-size: 13px;
}
</style>
