<script setup>
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps({
  messages: {
    type: Array,
    required: true
  },
  title: {
    type: String,
    default: 'AI 教学助手'
  },
  currentSlideLabel: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '继续告诉 AI 你想调整的内容...'
  },
  sendLabel: {
    type: String,
    default: '发送'
  },
  loadingLabel: {
    type: String,
    default: '思考中'
  },
  loading: {
    type: Boolean,
    default: false
  },
  showThinking: {
    type: Boolean,
    default: true
  },
  showVoice: {
    type: Boolean,
    default: false
  },
  suggestions: {
    type: Array,
    default: () => []
  },
  pickerMode: {
    type: Boolean,
    default: false
  },
  selectedElement: {
    type: Object,
    default: null
  },
  voiceInput: {
    type: Object,
    default: () => ({
      delay: 1200,
      transcript: ''
    })
  }
});

const emit = defineEmits(['send', 'apply', 'togglePicker', 'clearSelection', 'suggestion']);
const draft = ref('');
const voiceListening = ref(false);
const feedRef = ref(null);
const voiceDelay = computed(() => props.voiceInput?.delay ?? 1200);
const voiceTranscript = computed(() => props.voiceInput?.transcript ?? '');

function formatMessageText(value) {
  if (value === '[object Object]') return 'AI 请求失败，请重试。';
  if (Array.isArray(value)) return value.map(formatMessageText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    return String(
      value.message ||
      value.error?.message ||
      value.content ||
      value.text ||
      JSON.stringify(value)
    );
  }
  return String(value || '');
}

function scrollToBottom() {
  nextTick(() => {
    const feed = feedRef.value;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  });
}

watch(
  () => [props.messages.length, props.loading, formatMessageText(props.messages.at(-1)?.text)],
  scrollToBottom,
  { flush: 'post' }
);

function send() {
  const text = draft.value.trim();
  if (!text) return;
  emit('send', text);
  draft.value = '';
}

function startVoiceInput() {
  if (voiceListening.value) return;
  voiceListening.value = true;
  draft.value = '';
  window.setTimeout(() => {
    draft.value = voiceTranscript.value;
    voiceListening.value = false;
  }, voiceDelay.value);
}

function useSuggestion(suggestion) {
  if (typeof suggestion === 'string') {
    draft.value = suggestion;
    emit('suggestion', suggestion);
    return;
  }
  if (suggestion.text) {
    draft.value = suggestion.text;
  }
  emit('suggestion', suggestion);
}
</script>

<template>
  <aside class="ai-panel">
    <header class="ai-head">
      <img class="ai-logo-avatar" src="/assets/eduai-logo.png" alt="AI 助手" />
      <div>
        <strong>{{ title }}</strong>
        <span v-if="currentSlideLabel">当前页：{{ currentSlideLabel }}</span>
      </div>
      <button v-if="currentSlideLabel" class="more" type="button" :class="{ active: pickerMode }" aria-label="选择元素" @click="emit('togglePicker')">
        <span class="material-symbols-outlined">ads_click</span>
      </button>
    </header>

    <div ref="feedRef" class="chat-feed">
      <article
        v-for="(message, index) in messages"
        :key="message.id ?? `${message.role}-${index}-${formatMessageText(message.text)}`"
        class="message"
        :class="message.role"
      >
        <template v-if="message.role === 'ai'">
          <img class="ai-logo-avatar" src="/assets/eduai-logo.png" alt="AI" />
          <div class="message-body">
            <div v-if="message.time || message.title" class="ai-meta">
              <span>AI<span v-if="message.time"> ・ {{ message.time }}</span></span>
              <em v-if="message.title">{{ message.title }}</em>
            </div>
            <p><strong v-if="message.title && !message.proposal">{{ message.title }}：</strong>{{ formatMessageText(message.text) }}</p>
            <div v-if="message.proposal" class="proposal">
              <small>{{ typeof message.proposal === 'string' ? '新增 ・ 教师活动' : '改动 ・ 副标题' }}</small>
              <template v-if="typeof message.proposal === 'string'">
                <strong>{{ message.proposal }}</strong>
              </template>
              <template v-else>
                <b>{{ message.proposal.before }}</b>
                <b class="after">{{ message.proposal.after }}</b>
              </template>
            </div>
            <div v-if="message.actions" class="message-actions">
              <button
                v-for="action in message.actions"
                :key="action"
                :class="{ primary: action === '采纳改动' }"
                type="button"
                :disabled="loading"
                @click="action === '采纳改动' && emit('apply')"
              >
                {{ action }}
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          {{ formatMessageText(message.text) }}
          <span v-if="message.time">王老师 ・ {{ message.time }}</span>
        </template>
      </article>
      <article v-if="loading && showThinking" class="message ai ai-thinking">
        <img class="ai-logo-avatar" src="/assets/eduai-logo.png" alt="AI" />
        <div class="message-body">
          <div class="ai-meta">
            <span>AI ・ 正在生成</span>
          </div>
          <p><i></i><i></i><i></i></p>
        </div>
      </article>
    </div>

    <footer class="chat-input">
      <div v-if="$slots.tools || suggestions.length" class="composer-tools">
        <slot name="tools"></slot>
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.label ?? suggestion"
          type="button"
          @click="useSuggestion(suggestion)"
        >
          {{ suggestion.label ?? suggestion }}
        </button>
      </div>
      <div v-if="selectedElement || pickerMode" class="context-chip" :class="{ empty: !selectedElement }">
        <template v-if="selectedElement">
          <span class="material-symbols-outlined">data_object</span>
          <strong>引用元素</strong>
          <button type="button" aria-label="清除选择" @click="emit('clearSelection')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </template>
        <template v-else>
          <span class="material-symbols-outlined">ads_click</span>
          <strong>在 PPT 上点选要修改的元素</strong>
        </template>
      </div>
      <div class="composer">
        <button
          v-if="showVoice"
          class="voice-btn"
          type="button"
          :class="{ listening: voiceListening }"
          aria-label="语音输入"
          @click="startVoiceInput"
        >
          <span v-if="!voiceListening" class="material-symbols-outlined">keyboard_voice</span>
          <span v-else class="voice-wave" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
        </button>
        <textarea
          v-model="draft"
          :placeholder="voiceListening ? '正在识别语音...' : placeholder"
          @keydown.enter.prevent="send"
        ></textarea>
        <button class="send-btn" type="button" :disabled="loading" @click="send">
          {{ loading ? loadingLabel : sendLabel }}
        </button>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.ai-panel {
  position: relative;
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: 58px minmax(0, 1fr) auto;
  border-left: 1px solid var(--line);
  background: rgba(255, 255, 255, .84);
  overflow: hidden;
  backdrop-filter: blur(18px);
}

.ai-head {
  height: 58px;
  display: grid;
  grid-template-columns: 34px 1fr 34px;
  gap: var(--edu-gap-sm);
  align-items: center;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
}

.ai-plus,
.more {
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  background: #f8fcf9;
}

.ai-plus {
  width: 30px;
  height: 30px;
  border-color: var(--green);
  border-radius: 50%;
  color: var(--green);
}

.more {
  width: var(--edu-icon-h);
  height: var(--edu-icon-h);
  border-radius: var(--edu-radius-sm);
  color: var(--ink);
}

.more.active {
  border-color: rgba(47, 172, 102, .40);
  background: var(--mint);
  color: var(--green);
}

.ai-head strong {
  display: block;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0;
}

.ai-head span {
  color: var(--soft);
  font-size: var(--edu-caption);
}

.chat-feed {
  position: static;
  inset: auto;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.message {
  margin-bottom: 12px;
}

.message:last-child {
  margin-bottom: 0;
}

.ai-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--edu-gap-xs);
  margin-bottom: 6px;
  color: var(--soft);
  font-size: var(--edu-caption);
}

.ai-meta em {
  display: inline-flex;
  height: 22px;
  align-items: center;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--mint);
  color: #229956;
  font-style: normal;
  font-weight: 500;
}

.message p {
  margin: 0;
  color: var(--muted);
  font-size: var(--edu-body);
  line-height: 1.58;
  font-weight: 400;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.message.ai {
  display: grid;
  grid-template-columns: var(--edu-icon-h) minmax(0, 1fr);
  gap: var(--edu-gap-sm);
}

.message.ai .message-body {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-md);
  background: white;
  padding: 11px 13px;
  overflow: hidden;
}

.ai-thinking p {
  display: inline-flex;
  width: 68px;
  justify-content: center;
  gap: 6px;
}

.ai-thinking i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: ai-bounce 1s ease-in-out infinite;
}

.ai-thinking i:nth-child(2) {
  animation-delay: .14s;
}

.ai-thinking i:nth-child(3) {
  animation-delay: .28s;
}

@keyframes ai-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: .38;
  }

  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.message.teacher {
  width: max-content;
  max-width: 250px;
  margin-left: auto;
  padding: 11px 13px;
  border-radius: var(--edu-radius-md);
  background: var(--deep);
  color: white;
  font-size: var(--edu-body);
  font-weight: 400;
}

.message.teacher span {
  display: block;
  margin-top: 8px;
  color: rgba(255, 255, 255, .62);
  font-size: 11px;
  text-align: right;
}

.proposal {
  margin-top: 10px;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: var(--edu-radius-sm);
  background: #f4faf6;
}

.proposal small,
.proposal b {
  display: block;
}

.proposal small {
  color: var(--soft);
  font-size: 11px;
}

.proposal b {
  margin-top: 6px;
  font-size: var(--edu-body-lg);
}

.proposal .after {
  color: #16824a;
}

.message-actions {
  display: flex;
  gap: var(--edu-gap-xs);
  margin-top: 10px;
}

.message-actions button,
.send-btn {
  height: 32px;
  border-radius: var(--edu-radius-sm);
  border: 1px solid var(--line);
  background: #f8fcf9;
  color: var(--ink);
  padding: 0 14px;
  font-size: var(--edu-body);
  font-weight: 500;
}

.message-actions button.primary,
.send-btn {
  border: 0;
  background: var(--deep);
  color: #80f3a8;
}

.message-actions button:disabled,
.send-btn:disabled {
  opacity: .72;
}

.chat-input {
  position: static;
  inset: auto;
  display: block;
  flex-shrink: 0;
  padding: 8px 8px 12px;
  border-top: 1px solid var(--line);
  background: rgba(255, 255, 255, .92);
}

.composer-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.composer-tools button {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(248, 252, 249, .90);
  color: var(--ink);
  padding: 0 10px;
  font-size: var(--edu-caption);
  font-weight: 600;
}

.composer-tools .material-symbols-outlined {
  color: #229956;
  font-size: 18px;
  font-variation-settings: "FILL" 0, "wght" 360, "GRAD" 0, "opsz" 20;
}

.context-chip {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 7px;
  width: min(100%, 288px);
  min-height: 30px;
  margin: 0 0 7px;
  border: 1px solid rgba(47, 172, 102, .24);
  border-radius: 6px;
  background: rgba(244, 250, 246, .96);
  color: var(--ink);
  padding: 5px 6px 5px 8px;
  box-shadow: 0 8px 24px rgba(14, 45, 29, .08);
}

.context-chip.empty {
  grid-template-columns: 18px minmax(0, 1fr);
  border-color: rgba(16, 55, 35, .10);
  background: rgba(255, 255, 255, .92);
  color: var(--muted);
}

.context-chip > .material-symbols-outlined {
  color: #268c52;
  font-size: 17px;
  font-variation-settings: "FILL" 0, "wght" 340, "GRAD" 0, "opsz" 20;
}

.context-chip strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-chip button {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--soft);
}

.context-chip button:hover {
  background: rgba(16, 55, 35, .07);
  color: var(--ink);
}

.context-chip button .material-symbols-outlined {
  font-size: 16px;
  font-variation-settings: "FILL" 0, "wght" 330, "GRAD" 0, "opsz" 20;
}

.composer {
  width: 100%;
  min-height: 112px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px;
  grid-template-rows: minmax(62px, 1fr) auto;
  align-items: end;
  gap: 6px;
  border: 1px solid rgba(16, 55, 35, .12);
  border-radius: 6px;
  background: rgba(250, 253, 251, .94);
  padding: 7px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, .9) inset,
    0 12px 28px rgba(14, 45, 29, .08);
}

.voice-btn + textarea {
  grid-column: 2 / 3;
}

.chat-input textarea {
  grid-column: 1 / 3;
  min-width: 0;
  height: 78px;
  resize: none;
  border: 0;
  outline: none;
  background: transparent;
  padding: 9px 2px 5px;
  color: var(--ink);
  font-size: var(--edu-body);
  line-height: 1.35;
}

.composer .voice-btn {
  grid-column: 1 / 2;
  grid-row: 2;
}

.composer .voice-btn + textarea {
  grid-column: 1 / 3;
}

.voice-btn {
  position: relative;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  align-self: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--soft);
}

.voice-btn.listening {
  background: rgba(47, 172, 102, .12);
  color: #1f8847;
}

.voice-btn.listening::before {
  content: "";
  position: absolute;
  inset: -4px;
  border: 1px solid rgba(47, 172, 102, .30);
  border-radius: 7px;
  animation: voice-pulse 1.15s ease-out infinite;
}

.voice-btn .material-symbols-outlined {
  font-size: 18px;
  font-variation-settings: "FILL" 0, "wght" 330, "GRAD" 0, "opsz" 20;
}

.voice-wave {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.voice-wave i {
  width: 3px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  animation: voice-bar .78s ease-in-out infinite;
}

.voice-wave i:nth-child(2) {
  height: 13px;
  animation-delay: .12s;
}

.voice-wave i:nth-child(3) {
  animation-delay: .24s;
}

@keyframes voice-pulse {
  0% {
    transform: scale(.86);
    opacity: .72;
  }

  100% {
    transform: scale(1.18);
    opacity: 0;
  }
}

@keyframes voice-bar {
  0%,
  100% {
    transform: scaleY(.62);
    opacity: .55;
  }

  45% {
    transform: scaleY(1.25);
    opacity: 1;
  }
}

.send-btn {
  grid-column: 2;
  grid-row: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  height: 34px;
  min-width: 64px;
  padding: 0 12px;
  border-radius: 5px;
  white-space: nowrap;
}
</style>
