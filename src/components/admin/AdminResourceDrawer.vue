<script setup>
defineProps({
  open: Boolean,
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  busy: Boolean
});
const emit = defineEmits(['close']);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="admin-drawer-layer">
      <button class="admin-drawer-backdrop" type="button" aria-label="关闭侧边栏" @click="emit('close')" />
      <aside
        class="admin-resource-drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
        @keydown.esc="emit('close')"
      >
        <header class="admin-drawer-header">
          <div>
            <h2>{{ title }}</h2>
            <p v-if="description">{{ description }}</p>
          </div>
          <button class="admin-icon-button" type="button" aria-label="关闭" :disabled="busy" @click="emit('close')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>
        <div class="admin-drawer-body"><slot /></div>
        <footer v-if="$slots.footer" class="admin-drawer-footer"><slot name="footer" /></footer>
      </aside>
    </div>
  </Teleport>
</template>
