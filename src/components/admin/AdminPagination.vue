<script setup>
import { computed } from 'vue';

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 }
});
const emit = defineEmits(['change']);
const totalPages = computed(() => Math.max(Math.ceil(props.total / props.pageSize), 1));

function go(page) {
  const next = Math.min(Math.max(page, 1), totalPages.value);
  if (next !== props.page) emit('change', next);
}
</script>

<template>
  <footer class="admin-pagination">
    <span>共 {{ total }} 条，第 {{ page }} / {{ totalPages }} 页</span>
    <div>
      <button type="button" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <button type="button" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
    </div>
  </footer>
</template>
