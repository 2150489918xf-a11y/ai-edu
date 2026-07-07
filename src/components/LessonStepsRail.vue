<script setup>
defineProps({
  steps: {
    type: Array,
    required: true
  }
});
</script>

<template>
  <aside class="steps-rail">
    <header class="steps-head">
      <div>
        <strong>教学环节</strong>
        <span>8 项</span>
      </div>
      <button type="button" aria-label="新增教学环节">
        <span class="material-symbols-outlined">add</span>
      </button>
    </header>

    <div class="progress-row">
      <span>完成度</span>
      <strong>5 / 8</strong>
    </div>
    <div class="progress"><i></i></div>

    <div class="step-list">
      <button
        v-for="step in steps"
        :key="step.id"
        class="step-item"
        :class="{ active: step.active, done: step.done }"
        type="button"
      >
        <span class="step-index">
          <span v-if="step.done" class="material-symbols-outlined">check</span>
          <b v-else>{{ step.id }}</b>
        </span>
        <span class="step-copy">
          <strong>{{ step.title }}</strong>
          <small>{{ step.desc }}</small>
        </span>
        <em>{{ step.time }}</em>
      </button>
    </div>

    <footer>
      <button class="ai-fill" type="button">
        <span class="material-symbols-outlined">auto_awesome</span>
        AI 一键补完待写环节
      </button>
      <button class="add-custom" type="button">
        <span class="material-symbols-outlined">add</span>
        新增自定义环节
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.steps-rail {
  position: relative;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, .78);
  overflow: hidden;
}

.steps-head {
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 18px;
}

.steps-head strong {
  font-size: 16px;
  font-weight: 700;
}

.steps-head span {
  display: inline-flex;
  height: 22px;
  align-items: center;
  margin-left: 8px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--mint);
  color: #7d938a;
  font-size: 12px;
}

.steps-head button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: var(--mint);
  color: var(--green);
}

.progress-row {
  display: flex;
  justify-content: space-between;
  padding: 0 18px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.progress {
  height: 4px;
  margin: 8px 18px 18px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7f1eb;
}

.progress i {
  display: block;
  width: 62.5%;
  height: 100%;
  background: var(--green);
}

.step-list {
  display: grid;
  gap: 8px;
  padding: 0 10px;
  max-height: calc(100% - 214px);
  overflow-y: auto;
  padding-bottom: 112px;
}

.step-item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 28px;
  min-height: 52px;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  text-align: left;
}

.step-item.active {
  border-color: var(--green);
  background: #e7f7ee;
}

.step-index {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #edf7f1;
  color: #1aa65b;
  font-size: 12px;
  font-weight: 700;
}

.step-item.active .step-index {
  background: var(--green);
  color: #fff;
}

.step-index .material-symbols-outlined {
  font-size: 15px;
}

.step-copy {
  min-width: 0;
}

.step-copy strong,
.step-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-copy strong {
  font-size: 13px;
  font-weight: 700;
}

.step-copy small,
.step-item em {
  color: var(--soft);
  font-size: 11px;
  font-style: normal;
}

.step-item.active small,
.step-item.active em {
  color: #16824a;
  font-weight: 600;
}

footer {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 18px;
  display: grid;
  gap: 10px;
}

footer button {
  height: 36px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
}

.ai-fill {
  border: 0;
  background: var(--mint);
  color: #138a4b;
}

.add-custom {
  border: 1px solid var(--line);
  background: #f8fcf9;
  color: var(--ink);
}
</style>
