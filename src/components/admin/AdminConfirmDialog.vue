<script setup>
defineProps({
  open: Boolean,
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  busy: Boolean
});
const emit = defineEmits(['close', 'confirm']);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="admin-dialog-layer" @keydown.esc="emit('close')">
      <button class="admin-dialog-backdrop" type="button" aria-label="取消操作" @click="emit('close')" />
      <section class="admin-confirm-dialog" role="alertdialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <span class="material-symbols-outlined admin-dialog-warning">warning</span>
        <h2>{{ title || '确认操作' }}</h2>
        <p>{{ message }}</p>
        <div class="admin-dialog-actions">
          <button class="admin-button secondary" type="button" :disabled="busy" @click="emit('close')">取消</button>
          <button class="admin-button danger" type="button" :disabled="busy" @click="emit('confirm')">
            {{ busy ? '处理中…' : confirmText }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
