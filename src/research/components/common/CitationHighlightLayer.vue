<!-- 启明与文献阅读共用连续高亮层；统一合成透明度，避免行间重叠变深或出现逐行边框。 -->
<script setup lang="ts">
import type { CitationHighlightRect } from '@/research/utils/citationHighlight'
defineProps<{ rects: CitationHighlightRect[] }>()
</script>

<template>
  <div class="citation-highlight-layer" aria-hidden="true">
    <span
      v-for="(rect, index) in rects"
      :key="index"
      class="citation-highlight"
      :style="{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }"
    ></span>
  </div>
</template>

<style scoped>
.citation-highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.42;
  mix-blend-mode: multiply;
}
.citation-highlight {
  position: absolute;
  box-sizing: border-box;
  background: rgb(255 221 87);
}
</style>
