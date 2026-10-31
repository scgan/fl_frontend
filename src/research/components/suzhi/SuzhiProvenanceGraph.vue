<!--
  溯知主题演进图组件：将 TopicClustering 返回的里程碑交给分层图布局引擎，生成自上而下的
  有向演进图，支持节点与关系详情查看，并把 Citation 点击事件交回工作台打开原文。
-->
<script setup lang="ts">
import { graphlib, layout as runDagreLayout } from '@dagrejs/dagre'
import { computed, ref, watch } from 'vue'

import type {
  ProvenanceGraph,
  ProvenanceGraphEdge,
  ProvenanceGraphNode,
} from '@/research/types/agents'

const props = defineProps<{ graph: ProvenanceGraph | null }>()
const emit = defineEmits<{ citation: [citationId: number] }>()

const selectedNode = ref<ProvenanceGraphNode | null>(null)
const selectedEdge = ref<ProvenanceGraphEdge | null>(null)
const nodeWidth = 188
const nodeHeight = 70
const minimumCanvasWidth = 760
const minimumCanvasHeight = 520

interface LayoutNode {
  node: ProvenanceGraphNode
  x: number
  y: number
}

interface LayoutEdge {
  id: string
  edge: ProvenanceGraphEdge
  path: string
}

interface Point {
  x: number
  y: number
}

interface GraphLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

const selectedCitations = computed(() => (
  selectedNode.value?.citation_ids ?? selectedEdge.value?.citation_ids ?? []
))

/** 按中英文字符近似像素宽度截断节点文本，保证富文本始终留在矩形边框内。 */
function nodeText(value: string, maxWidth: number, fontSize: number): string {
  const normalized = value.replace(/[{}|]/g, '').trim()
  let width = 0
  let output = ''
  for (const character of normalized) {
    const codePoint = character.codePointAt(0) ?? 0
    const factor = codePoint <= 0x7f ? (character === ' ' ? 0.35 : 0.62) : 1.05
    const characterWidth = fontSize * factor
    if (width + characterWidth > maxWidth - fontSize) return `${output}…`
    output += character
    width += characterWidth
  }
  return output
}

/** 将 Dagre 给出的分层控制点转为平滑 SVG 路径。 */
function edgePath(points: Point[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0]?.x} ${points[0]?.y} L ${points[1]?.x} ${points[1]?.y}`
  const commands = [`M ${points[0]?.x} ${points[0]?.y}`]
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]
    const next = points[index + 1]
    if (!point || !next) continue
    const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
    commands.push(`Q ${point.x} ${point.y} ${midpoint.x} ${midpoint.y}`)
  }
  const last = points[points.length - 1]
  if (last) commands.push(`L ${last.x} ${last.y}`)
  return commands.join(' ')
}

/**
 * 使用 Dagre 的分层图算法统一计算节点顺序、层间间距和长边控制点。
 *
 * 布局不再信任模型提供的绝对轨道，也不在前端维护碰撞规则；Dagre 会通过虚拟节点为跨层边
 * 预留通道，并在每层内重排节点以减少交叉。无效端点会被跳过，避免历史异常数据中断整张图。
 */
function buildGraphLayout(graph: ProvenanceGraph | null): GraphLayout {
  if (!graph?.nodes.length) {
    return { nodes: [], edges: [], width: minimumCanvasWidth, height: minimumCanvasHeight }
  }

  const dagreGraph = new graphlib.Graph({ multigraph: true })
  dagreGraph.setGraph({
    rankdir: 'TB',
    ranker: 'network-simplex',
    acyclicer: 'greedy',
    nodesep: 52,
    edgesep: 24,
    ranksep: 62,
    marginx: 44,
    marginy: 44,
  })
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  for (const node of graph.nodes) {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  }
  graph.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) return
    dagreGraph.setEdge(edge.source, edge.target, { edgeIndex: index }, `edge-${index}`)
  })
  runDagreLayout(dagreGraph)

  const nodes = graph.nodes.flatMap((node) => {
    const position = dagreGraph.node(node.id) as Point | undefined
    return position ? [{ node, x: position.x, y: position.y }] : []
  })
  const edges = graph.edges.flatMap((edge, index) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) return []
    const route = dagreGraph.edge({ v: edge.source, w: edge.target, name: `edge-${index}` }) as {
      points?: Point[]
    } | undefined
    const path = edgePath(route?.points ?? [])
    return path ? [{ id: `edge-${index}`, edge, path }] : []
  })
  const dimensions = dagreGraph.graph() as { width?: number; height?: number }
  return {
    nodes,
    edges,
    width: Math.max(minimumCanvasWidth, dimensions.width ?? minimumCanvasWidth),
    height: Math.max(minimumCanvasHeight, dimensions.height ?? minimumCanvasHeight),
  }
}

const graphLayout = computed(() => buildGraphLayout(props.graph))
const layoutNodes = computed(() => graphLayout.value.nodes)
const layoutEdges = computed(() => graphLayout.value.edges)
const canvasWidth = computed(() => graphLayout.value.width)
const canvasHeight = computed(() => graphLayout.value.height)

/** 选择一个里程碑并在右侧展示详情。 */
function selectNode(node: ProvenanceGraphNode): void {
  selectedNode.value = node
  selectedEdge.value = null
}

/** 选择一条演进关系并在右侧展示详情。 */
function selectEdge(edge: ProvenanceGraphEdge): void {
  selectedEdge.value = edge
  selectedNode.value = null
}

watch(() => props.graph, (graph) => {
  selectedNode.value = graph?.nodes[0] ?? null
  selectedEdge.value = null
}, { deep: true, immediate: true })
</script>

<template>
  <section class="provenance-shell">
    <header>
      <div><span>EVOLUTION MAP</span><h2>{{ graph?.title ?? '研究演进图' }}</h2></div>
      <p v-if="graph">{{ graph.nodes.length }} 个节点 · {{ graph.edges.length }} 条关系</p>
    </header>
    <div v-if="graph?.nodes.length" class="graph-layout">
      <div class="graph-scroll">
        <svg
          class="graph-canvas"
          role="img"
          :aria-label="graph.title"
          :viewBox="'0 0 ' + canvasWidth + ' ' + canvasHeight"
          :style="{ maxWidth: canvasWidth + 'px' }"
        >
          <defs>
            <marker id="provenance-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 1 L 9 5 L 0 9 Z" />
            </marker>
            <filter id="provenance-shadow" x="-20%" y="-30%" width="140%" height="170%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#4d4191" flood-opacity=".12" />
            </filter>
          </defs>
          <g class="graph-edges">
            <g
              v-for="item in layoutEdges"
              :key="item.id"
              class="graph-edge"
              :class="{ selected: selectedEdge === item.edge }"
              role="button"
              tabindex="0"
              @click="selectEdge(item.edge)"
              @keydown.enter.prevent="selectEdge(item.edge)"
              @keydown.space.prevent="selectEdge(item.edge)"
            >
              <path class="edge-visible" :d="item.path" marker-end="url(#provenance-arrow)" />
              <path class="edge-hit-area" :d="item.path" />
            </g>
          </g>
          <g class="graph-nodes">
            <g
              v-for="item in layoutNodes"
              :key="item.node.id"
              class="graph-node"
              :class="{ selected: selectedNode === item.node }"
              role="button"
              tabindex="0"
              :transform="'translate(' + (item.x - nodeWidth / 2) + ' ' + (item.y - nodeHeight / 2) + ')'"
              @click="selectNode(item.node)"
              @keydown.enter.prevent="selectNode(item.node)"
              @keydown.space.prevent="selectNode(item.node)"
            >
              <rect :width="nodeWidth" :height="nodeHeight" rx="8" filter="url(#provenance-shadow)" />
              <text :x="nodeWidth / 2" y="29" class="node-title">{{ nodeText(item.node.label, 160, 11) }}</text>
              <text :x="nodeWidth / 2" y="49" class="node-meta">{{ nodeText(item.node.subtitle, 160, 9) }}</text>
            </g>
          </g>
        </svg>
      </div>
      <aside class="graph-inspector">
        <template v-if="selectedNode">
          <span>演进里程碑</span>
          <h3>{{ selectedNode.label }}</h3>
          <div class="node-subtitle">{{ selectedNode.subtitle || '演进节点' }}</div>
          <p>{{ selectedNode.summary }}</p>
        </template>
        <template v-else-if="selectedEdge">
          <span>{{ selectedEdge.relation }}</span>
          <h3>{{ selectedEdge.label }}</h3>
          <p>{{ selectedEdge.summary }}</p>
        </template>
        <div v-if="selectedCitations.length" class="citations">
          <small>关联 Evidence</small>
          <button
            v-for="citationId in selectedCitations"
            :key="citationId"
            type="button"
            @click="emit('citation', citationId)"
          >[{{ citationId }}]</button>
        </div>
      </aside>
    </div>
    <div v-else class="graph-empty">本次 Evidence 没有形成可展示的演进里程碑。</div>
  </section>
</template>

<style scoped>
.provenance-shell { min-height: 100%; padding: 22px 24px 42px; box-sizing: border-box; color: #294643; background: radial-gradient(circle at 45% 30%, #f3faf8 0, #fff 48%); }
.provenance-shell > header { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
.provenance-shell header span,.graph-inspector > span { color: #197568; font-size: 9px; font-weight: 800; letter-spacing: .14em; }
.provenance-shell h2 { margin: 5px 0 0; color: #173b3a; font: 600 20px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
.provenance-shell header p { margin: 0; color: #738784; font-size: 10px; }
.graph-layout { min-height: 560px; display: grid; grid-template-columns: minmax(0, 1fr) 230px; border: 1px solid #d9e5e2; background: rgba(255,255,255,.82); }
.graph-scroll { min-width: 0; overflow: auto; background: #fff; }
.graph-canvas { display: block; width: 100%; height: auto; margin: 0 auto; background: #fff; }
.edge-visible { fill: none; stroke: #777286; stroke-width: 1.6; transition: stroke .16s ease,stroke-width .16s ease; }
.edge-hit-area { fill: none; stroke: transparent; stroke-width: 14; cursor: pointer; }
.graph-edge { outline: none; }
.graph-edge:hover .edge-visible,.graph-edge:focus .edge-visible,.graph-edge.selected .edge-visible { stroke: #5f51c9; stroke-width: 2.2; }
#provenance-arrow path { fill: #777286; }
.graph-node { cursor: pointer; outline: none; }
.graph-node rect { fill: #faf9ff; stroke: #9d91ec; stroke-width: 1.3; transition: stroke .16s ease,stroke-width .16s ease,fill .16s ease; }
.graph-node:hover rect,.graph-node:focus rect,.graph-node.selected rect { fill: #f5f2ff; stroke: #6859d9; stroke-width: 2; }
.node-title,.node-meta { text-anchor: middle; dominant-baseline: middle; pointer-events: none; }
.node-title { fill: #342f51; font-size: 11px; font-weight: 700; }
.node-meta { fill: #746c91; font-size: 9px; }
.graph-inspector { padding: 24px 18px; border-left: 1px solid #d9e5e2; background: rgba(247,250,249,.9); overflow-wrap: anywhere; }
.graph-inspector h3 { margin: 7px 0 8px; color: #183d3a; font-size: 15px; }
.graph-inspector .node-subtitle { color: #8a6734; font-size: 10px; }
.graph-inspector p { color: #566d69; font-size: 11px; line-height: 1.8; }
.citations { margin-top: 20px; padding-top: 14px; border-top: 1px solid #d8e2df; }
.citations small { display: block; margin-bottom: 9px; color: #758985; font-size: 9px; }
.citations button { margin: 0 6px 6px 0; padding: 5px 8px; border: 1px solid #9dc0ba; background: #fff; color: #197568; cursor: pointer; }
.graph-empty { margin: 15vh auto; color: #758985; text-align: center; }
@media (max-width: 760px) {
  .provenance-shell { padding: 18px 12px 30px; }
  .provenance-shell > header { align-items: start; flex-direction: column; gap: 8px; }
  .graph-layout { min-height: 0; grid-template-columns: minmax(0, 1fr); }
  .graph-scroll { width: 100%; }
  .graph-canvas { width: 760px; max-width: none !important; }
  .graph-inspector { border-top: 1px solid #d9e5e2; border-left: 0; }
}
</style>
