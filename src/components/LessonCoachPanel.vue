<script setup>
import { ref } from 'vue';
import { lessonPrompts } from '../data/lessonPlanMock';

defineProps({
  messages: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['insert', 'send']);
const draft = ref('');

function send(text = draft.value) {
  const value = text.trim();
  if (!value) return;
  emit('send', value);
  draft.value = '';
}
</script>

<template>
  <aside class="coach-panel">
    <header class="coach-head">
      <img class="ai-logo-avatar" src="/assets/eduai-logo.png" alt="AI 助手" />
      <div>
        <strong>AI ・ 教案副驾</strong>
        <span>正在跟随：环节 3 ・ 新知讲授</span>
      </div>
      <button class="more" type="button" aria-label="更多">
        <span class="material-symbols-outlined">more_vert</span>
      </button>
    </header>

    <div class="coach-feed">
      <article v-for="message in messages" :key="message.id" class="coach-message" :class="message.role">
        <template v-if="message.role === 'ai'">
          <div class="meta">
            <span>✦ AI ・ {{ message.time }}</span>
            <em v-if="message.badge">{{ message.badge }}</em>
          </div>
          <p>{{ message.text }}</p>
          <div v-if="message.proposal" class="proposal">
            <small>新增 ・ 教师活动</small>
            <strong>{{ message.proposal }}</strong>
          </div>
          <div v-if="message.proposal" class="actions">
            <button class="primary" type="button" @click="$emit('insert')">插入到教师活动</button>
            <button type="button">换种说法</button>
          </div>
        </template>
        <template v-else>
          {{ message.text }}
          <span>王老师 ・ 12:09</span>
        </template>
      </article>
    </div>

    <footer class="coach-input">
      <div class="prompt-divider"><span></span><em>也可以这样问</em><span></span></div>
      <div class="prompt-list">
        <button v-for="prompt in lessonPrompts" :key="prompt" type="button" @click="send(prompt)">
          “ {{ prompt }} ”
        </button>
      </div>
      <div class="input-row">
        <textarea v-model="draft" placeholder="问问 AI ・ 比如 “帮我加一个分层提问”" @keydown.enter.prevent="send()"></textarea>
        <button type="button" @click="send()">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.coach-panel {
  position: relative;
  border-left: 1px solid var(--line);
  background: rgba(255, 255, 255, .86);
  overflow: hidden;
}

.coach-head {
  height: 64px;
  display: grid;
  grid-template-columns: 34px 1fr 34px;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
}

.plus,
.more {
  display: grid;
  place-items: center;
  border-radius: 10px;
}

.plus {
  width: 30px;
  height: 30px;
  border: 1px solid var(--green);
  border-radius: 50%;
  background: transparent;
  color: var(--green);
}

.more {
  width: 34px;
  height: 34px;
  border: 0;
  background: #f1f8f4;
  color: var(--soft);
}

.coach-head strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
}

.coach-head span {
  color: var(--soft);
  font-size: 12px;
}

.coach-feed {
  position: absolute;
  inset: 64px 0 220px;
  padding: 20px 18px;
  overflow-y: auto;
}

.coach-message {
  margin-bottom: 22px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
  color: var(--soft);
  font-size: 12px;
}

.meta em {
  height: 22px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--mint);
  color: #229956;
  font-style: normal;
  font-weight: 700;
  line-height: 22px;
}

.coach-message p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  font-weight: 500;
}

.coach-message.teacher {
  max-width: 260px;
  margin-left: auto;
  padding: 13px 16px;
  border-radius: 12px;
  background: var(--mint);
  color: var(--ink);
  font-size: 14px;
  font-weight: 500;
}

.coach-message.teacher span {
  display: block;
  margin-top: 8px;
  color: var(--soft);
  font-size: 11px;
  text-align: right;
}

.proposal {
  margin-top: 12px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f7fcf9;
}

.proposal small {
  display: block;
  margin-bottom: 6px;
  color: #229956;
  font-size: 12px;
  font-weight: 700;
}

.proposal strong {
  font-size: 13px;
  line-height: 1.55;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.actions button {
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: #f8fcf9;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.actions .primary {
  border: 0;
  background: var(--green);
  color: #fff;
}

.coach-input {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 16px;
}

.prompt-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  color: var(--soft);
  font-size: 12px;
}

.prompt-divider span {
  height: 1px;
  background: var(--line);
}

.prompt-divider em {
  font-style: normal;
}

.prompt-list {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.prompt-list button {
  height: 34px;
  border: 0;
  border-radius: 9px;
  background: #f0f8f4;
  color: #17854b;
  font-size: 13px;
  font-weight: 600;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 42px;
  gap: 10px;
}

.input-row textarea {
  height: 42px;
  resize: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  outline: none;
  background: #f8fcf9;
  padding: 12px;
  color: var(--ink);
  font-size: 13px;
}

.input-row > button {
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--green);
  color: #fff;
}
</style>
