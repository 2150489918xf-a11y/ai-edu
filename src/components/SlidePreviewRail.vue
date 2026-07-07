<script setup>
defineProps({
  slides: {
    type: Array,
    required: true
  },
  currentIndex: {
    type: Number,
    required: true
  }
});

defineEmits(['select']);
</script>

<template>
  <aside class="preview-rail">
    <header class="preview-head">
      <div>
        <strong>幻灯片</strong>
        <span>{{ slides.length }} 页</span>
      </div>
    </header>

    <div class="preview-list">
      <button
        v-for="(slide, index) in slides"
        :key="slide.id"
        class="preview-item"
        :class="{ active: index === currentIndex }"
        type="button"
        @click="$emit('select', index)"
      >
        <span class="preview-thumb">
          <img
            :src="slide.imageSrc || `/assets/newton-ppt/slide-${String(slide.id).padStart(2, '0')}.png`"
            :alt="`${String(slide.id).padStart(2, '0')} ${slide.label}`"
          />
        </span>
        <span class="preview-meta">
          <strong>{{ String(slide.id).padStart(2, '0') }} ・ {{ slide.label }}</strong>
          <small>{{ slide.title }}</small>
        </span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.preview-rail {
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, .72);
  overflow: hidden;
  backdrop-filter: blur(16px);
}

.preview-head {
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
}

.preview-head strong {
  display: block;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: 0;
}

.preview-head span {
  color: var(--soft);
  font-size: var(--edu-caption);
}

.preview-list {
  display: grid;
  gap: var(--edu-gap-xs);
  padding: 12px 10px;
  max-height: calc(100% - 58px);
  overflow-y: auto;
}

.preview-item {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: var(--edu-gap-sm);
  align-items: center;
  min-height: 60px;
  padding: 7px;
  border: 1px solid transparent;
  border-radius: var(--edu-radius-md);
  background: transparent;
  text-align: left;
}

.preview-item.active {
  border-color: var(--green);
  background: #eefaf3;
  box-shadow: inset 0 0 0 1px rgba(47, 172, 102, .18);
}

.preview-thumb {
  position: relative;
  width: 52px;
  height: 38px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
}

.preview-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-meta {
  min-width: 0;
}

.preview-meta strong,
.preview-meta small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-meta strong {
  font-size: var(--edu-caption);
  font-weight: 600;
}

.preview-meta small {
  margin-top: 4px;
  color: var(--soft);
  font-size: 11px;
}
</style>
