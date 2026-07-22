<script setup>
defineProps({
  loading: Boolean,
  error: { type: String, default: '' },
  empty: Boolean,
  emptyTitle: { type: String, default: '暂无数据' },
  emptyText: { type: String, default: '调整筛选条件后再试。' }
});
defineEmits(['retry']);
</script>

<template>
  <div v-if="loading" class="admin-skeleton-list" aria-label="正在加载">
    <span v-for="index in 5" :key="index" />
  </div>
  <div v-else-if="error" class="admin-inline-state is-error">
    <span class="material-symbols-outlined">error</span>
    <div><strong>数据加载失败</strong><p>{{ error }}</p></div>
    <button class="admin-button secondary" type="button" @click="$emit('retry')">重新加载</button>
  </div>
  <div v-else-if="empty" class="admin-inline-state">
    <span class="material-symbols-outlined">inbox</span>
    <div><strong>{{ emptyTitle }}</strong><p>{{ emptyText }}</p></div>
  </div>
  <slot v-else />
</template>
