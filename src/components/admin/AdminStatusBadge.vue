<script setup>
defineProps({ status: { type: String, default: 'active' } });
</script>

<template>
  <span class="admin-status" :class="status === 'active' ? 'is-active' : 'is-archived'">
    <span aria-hidden="true" />{{ status === 'active' ? '正常' : '已停用' }}
  </span>
</template>
