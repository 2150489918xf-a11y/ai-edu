<script setup>
import { computed } from 'vue';
import { pptElementMap } from '../data/pptElements';

const emit = defineEmits(['selectElement']);

const props = defineProps({
  slide: {
    type: Object,
    required: true
  },
  current: {
    type: Number,
    required: true
  },
  pickerMode: {
    type: Boolean,
    default: false
  },
  selectedElement: {
    type: Object,
    default: null
  },
  appliedEdits: {
    type: Object,
    default: () => ({})
  }
});

const hotspots = computed(() => {
  const elements = pptElementMap[props.current] || [];
  return elements.map((element, index) => ({
    ...element,
    style: {
      left: `${element.bounds.x / 1280 * 100}%`,
      top: `${element.bounds.y / 720 * 100}%`,
      width: `${element.bounds.width / 1280 * 100}%`,
      height: `${element.bounds.height / 720 * 100}%`,
      zIndex: 20 + index
    }
  }));
});
const slideImageSrc = computed(() => props.slide.imageSrc || `/assets/newton-ppt/slide-${String(props.current).padStart(2, '0')}.png`);
</script>

<template>
  <section class="canvas-wrap">
    <article class="slide-card">
      <img
        :src="slideImageSrc"
        :alt="`${String(current).padStart(2, '0')} ${slide.title}`"
      />
      <div v-if="pickerMode || selectedElement" class="picker-layer" :class="{ active: pickerMode }">
        <button
          v-for="hotspot in hotspots"
          :key="hotspot.id"
          class="picker-hotspot"
          :class="{ selected: selectedElement?.id === hotspot.id }"
          :style="hotspot.style"
          type="button"
          :aria-label="hotspot.label"
          @click="emit('selectElement', hotspot)"
        />
      </div>
      <div v-if="appliedEdits[current]" class="edit-layer">
        <div
          v-for="edit in appliedEdits[current]"
          :key="edit.id"
          class="applied-edit"
          :class="edit.role"
          :style="edit.style"
        >
          <strong>{{ edit.text }}</strong>
          <span>已应用</span>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.canvas-wrap {
  position: absolute;
  inset: 0 0 56px;
  display: grid;
  place-items: center;
  padding: 22px;
  background:
    linear-gradient(90deg, rgba(226, 235, 229, .55) 1px, transparent 1px),
    linear-gradient(180deg, rgba(226, 235, 229, .55) 1px, transparent 1px);
  background-size: 48px 48px;
  background-color: var(--wash);
}

.slide-card {
  position: relative;
  width: min(980px, calc(100% - 18px), calc((100vh - 150px) * 16 / 9));
  aspect-ratio: 16 / 9;
  height: auto;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  box-shadow: var(--shadow-editor);
}

.slide-card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.picker-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.edit-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 16;
}

.applied-edit {
  position: absolute;
  display: grid;
  place-items: center;
  overflow: visible;
  border-radius: 4px;
  background: rgba(255, 255, 255, .88);
  box-shadow:
    inset 0 0 0 1px rgba(47, 172, 102, .32),
    0 0 0 3px rgba(47, 172, 102, .10);
  color: #123623;
  text-align: center;
}

.applied-edit strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  padding: 0 12px;
  font-family: var(--font-serif);
  font-size: clamp(20px, 5.2vw, 58px);
  font-weight: 700;
  line-height: 1.12;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.applied-edit span {
  position: absolute;
  right: 10px;
  top: -28px;
  display: inline-flex;
  height: 24px;
  align-items: center;
  border-radius: 999px;
  background: var(--deep);
  color: #7df0a0;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
}

.picker-layer.active {
  pointer-events: auto;
}

.picker-hotspot {
  position: absolute;
  display: grid;
  align-content: start;
  justify-items: start;
  border: 1px dashed transparent;
  border-radius: 4px;
  background: transparent;
  color: transparent;
  padding: 0;
  opacity: 0;
  outline: 1px solid transparent;
  outline-offset: -2px;
  transition: opacity .14s ease, border-color .14s ease, background .14s ease, outline-color .14s ease;
}

.picker-layer.active .picker-hotspot:hover,
.picker-hotspot:hover,
.picker-hotspot.selected {
  opacity: 1;
  border-color: rgba(25, 112, 65, .62);
  background: rgba(47, 172, 102, .075);
  outline-color: rgba(255, 255, 255, .72);
  box-shadow:
    inset 0 0 0 1px rgba(47, 172, 102, .18),
    0 0 0 1px rgba(16, 55, 35, .06);
}

.picker-hotspot.selected {
  border-style: solid;
  border-color: rgba(25, 112, 65, .78);
  background: rgba(47, 172, 102, .10);
}

.picker-layer.active .picker-hotspot {
  cursor: crosshair;
}

</style>
