<script setup>
defineProps({
  courseTitle: {
    type: String,
    required: true
  }
});

defineEmits(['back', 'openPpt', 'export', 'rewrite']);
</script>

<template>
  <header class="lesson-topbar">
    <div class="top-left">
      <button class="ghost-btn back-btn" type="button" @click="$emit('back')">
        <span class="material-symbols-outlined">chevron_left</span>
        返回大纲
      </button>
      <span class="save-chip"><i></i>已自动保存</span>
      <div class="title-block">
        <div>
          <h1>{{ courseTitle }}</h1>
          <span>教案</span>
        </div>
        <p>高一 ・ 物理 ・ 第 3 课时 / 共 12 课时 ・ 时长 45 分钟</p>
      </div>
    </div>

    <div class="top-actions">
      <button class="ghost-btn" type="button" @click="$emit('openPpt')">
        <span class="material-symbols-outlined">desktop_windows</span>
        切到 PPT
      </button>
      <button class="ghost-btn" type="button" @click="$emit('export')">
        <span class="material-symbols-outlined">download</span>
        导出
      </button>
      <button class="primary-btn" type="button" @click="$emit('rewrite')">
        <span class="material-symbols-outlined">add</span>
        用 AI 重写
      </button>
    </div>
  </header>
</template>

<style scoped>
.lesson-topbar {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .92);
}

.top-left,
.top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ghost-btn,
.primary-btn {
  display: inline-flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
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
  font-size: 12px;
  font-weight: 600;
}

.save-chip i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
}

.title-block {
  margin-left: 8px;
}

.title-block > div {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.title-block h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0;
}

.title-block span {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 9px;
  border-radius: 8px;
  background: var(--mint);
  color: #229956;
  font-size: 12px;
  font-weight: 700;
}

.title-block p {
  margin: 7px 0 0;
  color: var(--soft);
  font-size: 13px;
  font-weight: 500;
}
</style>
