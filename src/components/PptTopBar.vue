<script setup>
defineProps({
  courseTitle: {
    type: String,
    required: true
  },
  current: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
});

defineEmits(['back', 'export']);
</script>

<template>
  <header class="ppt-topbar">
    <div class="top-left">
      <button class="ghost-btn back-btn" type="button" @click="$emit('back')">
        <span class="material-symbols-outlined">chevron_left</span>
        返回大纲
      </button>
      <span class="save-chip"><i></i>已自动保存</span>
      <div class="title-block">
        <div>
          <h1>{{ courseTitle }}</h1>
          <span>PPT 课件</span>
        </div>
        <p>{{ total }} 页 ・ 当前 {{ current }} / {{ total }} ・ AI 可对每页提建议</p>
      </div>
    </div>

    <div class="top-actions">
      <button class="ghost-btn" type="button" @click="$emit('export')">
        <span class="material-symbols-outlined">download</span>
        导出
      </button>
    </div>
  </header>
</template>

<style scoped>
.ppt-topbar {
  height: var(--edu-topbar-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--edu-page-pad);
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .90);
  backdrop-filter: blur(18px);
}

.top-left,
.top-actions {
  display: flex;
  align-items: center;
  gap: var(--edu-gap-md);
}

.ghost-btn,
.primary-btn {
  display: inline-flex;
  height: var(--edu-control-compact-h);
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border-radius: var(--edu-radius-sm);
  font-size: var(--edu-body);
  font-weight: 500;
  white-space: nowrap;
}

.ghost-btn {
  border: 1px solid var(--line);
  background: #f8fcf9;
  color: var(--ink);
}

.primary-btn {
  border: 0;
  background: var(--deep);
  color: #80f3a8;
}

.save-chip {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--mint);
  color: #229956;
  font-size: var(--edu-caption);
  font-weight: 500;
}

.save-chip i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
}

.title-block {
  margin-left: 4px;
}

.title-block > div {
  display: flex;
  align-items: baseline;
  gap: var(--edu-gap-sm);
}

.title-block h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 24px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0;
}

.title-block span,
.title-block p {
  color: var(--soft);
  font-size: var(--edu-body);
  font-weight: 500;
}

.title-block span {
  font-size: var(--edu-caption);
  font-weight: 600;
}

.title-block p {
  margin: 5px 0 0;
}
</style>
