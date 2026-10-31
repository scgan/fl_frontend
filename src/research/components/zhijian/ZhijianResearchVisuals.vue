<!--
  智鉴研究内容可视化：展示 A/B 专属论文数量，以及仅由后端校验后时间节点
  构成的双轨时间轴；不在浏览器端推断文献归属、年份或 Citation 有效性。
-->
<script setup lang="ts">
import { computed } from 'vue'
import ResearchMarkdown from '@/research/components/common/ResearchMarkdown.vue'

import type { ZhijianResult } from '@/research/types/agents'

const props = withDefaults(defineProps<{
  objectA: string
  objectB: string
  objectADocuments: number
  objectBDocuments: number
  timeline: ZhijianResult['timeline']
  showPaperCounts?: boolean
  /** 连续展示时将时间轴放到独立章节，避免总览重复绘制同一组事件。 */
  showTimeline?: boolean
  /** 对话入口已发布的引用；专业页面未传入时保留原有纯文本事件。 */
  citationIndices?: number[]
}>(), {
  showPaperCounts: true,
  showTimeline: true,
  citationIndices: () => [],
})
const emit = defineEmits<{ 'citation-click': [index: number] }>()

const maximumDocuments = computed(() => Math.max(props.objectADocuments, props.objectBDocuments, 1))
const timelineRows = computed(() => props.timeline)

/** 在事件后附加已发布的来源，未验证的编号不生成点击入口。 */
function eventContent(item: ZhijianResult['timeline'][number]): string {
  const indices = [...new Set(item.citation_ids || [])].filter((index) =>
    props.citationIndices.includes(index) && !item.event.includes(`[${index}]`),
  )
  return [item.event, indices.map((index) => `[${index}]`).join(' ')].filter(Boolean).join(' ')
}

/** 按两侧最大文献数归一化柱长，只用于显示比例，不改变后端原始计数。 */
function documentBarWidth(value: number): string {
  return `${Math.round((value / maximumDocuments.value) * 100)}%`
}
</script>

<template>
  <section class="research-visuals" :aria-label="showPaperCounts && showTimeline ? '论文数量与双轨时间轴' : showPaperCounts ? '两侧专属论文数量' : '双轨时间轴'">
    <section v-if="showPaperCounts" class="paper-comparison">
      <h3>两侧专属论文数量</h3>
      <p>按本次运行的 EvidenceAssignment 去重统计来源文献。</p>
      <div class="paper-row">
        <strong>A · {{ objectA }}</strong><div><i :style="{ width: documentBarWidth(objectADocuments) }" /></div><b>{{ objectADocuments }} 篇</b>
      </div>
      <div class="paper-row object-b">
        <strong>B · {{ objectB }}</strong><div><i :style="{ width: documentBarWidth(objectBDocuments) }" /></div><b>{{ objectBDocuments }} 篇</b>
      </div>
    </section>

    <section v-if="showTimeline" class="dual-timeline">
      <h3>双轨时间轴</h3>
      <div class="lane-headings"><strong>A · {{ objectA }}</strong><span>年份</span><strong>B · {{ objectB }}</strong></div>
      <div v-if="timelineRows.length" class="timeline-body">
        <article v-for="item in timelineRows" :key="`${item.year}-${item.object}-${item.event}`" class="timeline-row">
          <div v-if="item.object === 'A' || item.object === 'SHARED'" class="timeline-event object-a"><ResearchMarkdown :content="eventContent(item)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></div><div v-else />
          <time>{{ item.year }}</time>
          <div v-if="item.object === 'B' || item.object === 'SHARED'" class="timeline-event object-b"><ResearchMarkdown :content="eventContent(item)" :citation-indices="citationIndices" @citation-click="emit('citation-click', $event)" /></div><div v-else />
        </article>
      </div>
      <p v-else class="timeline-empty">当前 Evidence 没有可验证年份的双侧事件，未生成时间轴。</p>
    </section>
  </section>
</template>

<style scoped>
.research-visuals { display: grid; gap: 18px; margin-top: 22px; }
.paper-comparison, .dual-timeline { padding: 18px; border: 1px solid #d8e1ea; background: #fff; }
.research-visuals h3 { margin: 0; color: #20364e; font-size: 13px; }
.paper-comparison > p { margin: 6px 0 16px; color: #7d8da0; font-size: 9px; }
.paper-row { display: grid; grid-template-columns: minmax(110px, 160px) 1fr 48px; gap: 12px; align-items: center; margin-top: 12px; }
.paper-row strong, .paper-row b { color: #354a62; font-size: 10px; }
.paper-row b { text-align: right; }
.paper-row > div { height: 12px; border-radius: 6px; background: #edf2f7; overflow: hidden; }
.paper-row i { display: block; min-width: 4px; height: 100%; border-radius: inherit; background: #39a675; }
.paper-row.object-b i { background: #3978df; }
.lane-headings { display: grid; grid-template-columns: 1fr 64px 1fr; gap: 14px; align-items: center; margin-top: 16px; color: #52677e; font-size: 10px; text-align: center; }
.lane-headings strong:first-child { color: #268b68; text-align: right; }
.lane-headings strong:last-child { color: #2868d7; text-align: left; }
.timeline-body { position: relative; margin-top: 8px; }
.timeline-body::before { position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: #c7d3df; content: ''; }
.timeline-row { position: relative; display: grid; grid-template-columns: 1fr 64px 1fr; gap: 14px; align-items: center; min-height: 74px; }
.timeline-row time { z-index: 1; justify-self: center; padding: 5px 7px; border: 1px solid #b9c8d8; border-radius: 12px; background: #fff; color: #20364e; font: 700 10px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
.timeline-event { padding: 10px 12px; border: 1px solid #d8e1ea; background: #f7f9fa; }
.timeline-event.object-a { border-right: 3px solid #39a675; text-align: right; }
.timeline-event.object-b { border-left: 3px solid #3978df; }
.timeline-event :deep(p) { margin: 0; color: #354a62; font-size: 10px; line-height: 1.65; }
.timeline-event { min-width: 0; overflow-wrap: anywhere; }
.timeline-empty { margin: 18px 0 0; padding: 18px; background: #f7f9fb; color: #7d8da0; font-size: 10px; text-align: center; }
@media (max-width: 760px) { .paper-row { grid-template-columns: 100px 1fr 42px; } .lane-headings, .timeline-row { grid-template-columns: 1fr 52px 1fr; gap: 8px; } }
</style>
