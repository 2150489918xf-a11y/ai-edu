<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  courseId: {
    type: String,
    default: ''
  },
  activeStep: {
    type: String,
    default: ''
  },
  lockedSteps: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['blocked']);
const router = useRouter();
const lockedStepKeys = computed(() => new Set(props.lockedSteps));

const steps = [
  { key: 'generate', label: '生成', icon: 'auto_awesome', path: '/workspace' },
  { key: 'mindmap', label: '导图', icon: 'account_tree', path: '/mindmap' },
  { key: 'ppt', label: 'PPT', icon: 'desktop_windows', path: '/ppt' },
  { key: 'lesson-plan', label: '教案', icon: 'article', path: '/lesson-plan' },
  { key: 'analysis', label: '题析', icon: 'analytics', path: '/analysis' }
];

function navigate(step) {
  if (step.key === props.activeStep) return;
  if (lockedStepKeys.value.has(step.key)) {
    emit('blocked', step.key);
    return;
  }
  if (!props.courseId) return;
  router.push(`/preclass/courses/${props.courseId}${step.path}`);
}
</script>

<template>
  <nav class="course-workflow-rail" aria-label="课程工作台步骤">
    <button
      v-for="step in steps"
      :key="step.key"
      class="course-workflow-step"
      :class="{
        active: step.key === activeStep,
        locked: lockedStepKeys.has(step.key)
      }"
      type="button"
      :aria-current="step.key === activeStep ? 'step' : undefined"
      :aria-disabled="lockedStepKeys.has(step.key) ? 'true' : undefined"
      @click="navigate(step)"
    >
      <span class="material-symbols-outlined">{{ step.icon }}</span>
      <span>{{ step.label }}</span>
    </button>
    <div class="course-workflow-ai" aria-hidden="true">AI</div>
  </nav>
</template>

<style scoped>
.course-workflow-rail {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: var(--edu-gap-xs);
  padding-top: 10px;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, .42);
}

.course-workflow-step {
  display: grid;
  width: 60px;
  min-height: 58px;
  place-items: center;
  gap: 4px;
  border: 0;
  border-radius: 0 var(--edu-radius-md) var(--edu-radius-md) 0;
  background: transparent;
  color: var(--soft);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.course-workflow-step .material-symbols-outlined {
  font-size: 22px;
}

.course-workflow-step.active {
  background: var(--mint);
  color: var(--green);
}

.course-workflow-step.locked:not(.active) {
  opacity: .72;
}

.course-workflow-step:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: -3px;
}

.course-workflow-ai {
  position: absolute;
  left: 14px;
  bottom: 16px;
  display: grid;
  width: var(--edu-control-h);
  height: var(--edu-control-h);
  place-items: center;
  border-radius: 50%;
  background: var(--deep);
  color: #7df0a0;
  font-family: var(--font-number);
  font-size: 13px;
  font-weight: 800;
}
</style>
