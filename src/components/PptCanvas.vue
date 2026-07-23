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
      left: `${(element.bounds.x / 1280) * 100}%`,
      top: `${(element.bounds.y / 720) * 100}%`,
      width: `${(element.bounds.width / 1280) * 100}%`,
      height: `${(element.bounds.height / 720) * 100}%`,
      zIndex: 20 + index
    }
  }));
});

const useGeneratedLayout = computed(() => props.slide.imageSrc === null || (!props.slide.imageSrc && props.slide.generated));
const slideImageSrc = computed(() => props.slide.imageSrc || `/assets/newton-ppt/slide-${String(props.current).padStart(2, '0')}.png`);
</script>

<template>
  <section class="canvas-wrap">
    <article class="slide-card">
      <img
        v-if="!useGeneratedLayout"
        :src="slideImageSrc"
        :alt="`${String(current).padStart(2, '0')} ${slide.title}`"
      />

      <div v-else class="generated-slide">
        <span class="generated-marker">{{ slide.marker || String(current).padStart(2, '0') }}</span>
        <div class="generated-content">
          <strong>{{ slide.title }}</strong>
          <p>{{ slide.subtitle }}</p>
          <ul v-if="slide.bullets?.length">
            <li v-for="item in slide.bullets.slice(0, 6)" :key="item">{{ item }}</li>
          </ul>
        </div>
        <footer>{{ slide.footer }}</footer>
      </div>

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

.generated-slide {
  position: relative;
  display: grid;
  grid-template-rows: 1fr auto;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 64px 72px 42px;
  background:
    linear-gradient(135deg, rgba(15, 95, 53, .92), rgba(10, 53, 34, .96)),
    var(--deep);
  color: #f5fff8;
}

.generated-slide::before {
  content: "";
  position: absolute;
  inset: 28px;
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 10px;
}

.generated-slide::after {
  content: "";
  position: absolute;
  right: -120px;
  bottom: -160px;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(126, 240, 160, .24), transparent 64%);
}

.generated-marker {
  position: absolute;
  right: 58px;
  top: 46px;
  color: rgba(255, 255, 255, .26);
  font-family: var(--font-mono);
  font-size: 62px;
  font-weight: 800;
}

.generated-content {
  position: relative;
  z-index: 1;
  align-self: center;
  max-width: 760px;
}

.generated-content strong {
  display: block;
  font-family: var(--font-serif);
  font-size: clamp(34px, 4.6vw, 66px);
  line-height: 1.12;
  font-weight: 800;
}

.generated-content p {
  max-width: 680px;
  margin-top: 22px;
  color: rgba(245, 255, 248, .76);
  font-size: clamp(17px, 1.5vw, 24px);
  line-height: 1.55;
  font-weight: 600;
}

.generated-content ul {
  display: grid;
  gap: 12px;
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
}

.generated-content li {
  position: relative;
  padding-left: 20px;
  color: rgba(245, 255, 248, .84);
  font-size: clamp(15px, 1.25vw, 20px);
  line-height: 1.42;
  font-weight: 600;
}

.generated-content li::before {
  content: "";
  position: absolute;
  left: 0;
  top: .62em;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7df0a0;
}

.generated-slide footer {
  position: relative;
  z-index: 1;
  color: rgba(245, 255, 248, .58);
  font-size: 14px;
  font-weight: 650;
}

.picker-layer,
.edit-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.picker-layer.active {
  pointer-events: auto;
}

.picker-hotspot {
  position: absolute;
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

.applied-edit {
  position: absolute;
  display: grid;
  place-items: center;
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
</style>
