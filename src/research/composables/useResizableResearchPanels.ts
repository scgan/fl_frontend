/** 为三栏智能研究工作台提供统一的面板宽度、拖拽边界和 CSS 变量。 */
import { computed, ref, type Ref } from 'vue'

interface ResizableResearchPanelsOptions {
  /** 三栏主体元素，用于按实际可用宽度计算拖拽上限。 */
  body: Ref<HTMLElement | null>
  /** 工作台 CSS 自定义属性前缀，例如 qiming。 */
  cssPrefix: string
  /** 左侧历史栏初始宽度。 */
  historyDefault: number
  /** 右侧 Evidence 栏初始宽度。 */
  evidenceDefault: number
  /** 中央结果区必须保留的最小宽度。 */
  contentMinimum: number
  /** 返回共享历史栏当前是否可见。 */
  isHistoryVisible: () => boolean
  /** 返回当前模块 Evidence 栏是否可见。 */
  isEvidenceVisible: () => boolean
}

/** 把面板宽度限制在可读范围和当前工作台实际剩余空间内。 */
function clampPanelWidth(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

/**
 * 建立可复用的左右面板宽度状态和拖拽处理器。
 *
 * @param options 工作台元素、CSS 前缀、初始宽度和可见性读取器。
 * @returns 面板样式以及历史栏、Evidence 栏的拖拽处理函数。
 */
export function useResizableResearchPanels(options: ResizableResearchPanelsOptions) {
  const historyPanelWidth = ref(options.historyDefault)
  const evidencePanelWidth = ref(options.evidenceDefault)
  const panelStyle = computed(() => ({
    [`--${options.cssPrefix}-history-width`]: `${historyPanelWidth.value}px`,
    [`--${options.cssPrefix}-evidence-width`]: `${evidencePanelWidth.value}px`,
  }))

  /** 调整左栏时扣除当前可见的右栏，避免中央区被拖拽到不可阅读。 */
  function resizeHistoryPanel(delta: number): void {
    const bodyWidth = options.body.value?.clientWidth ?? 0
    const evidenceSpace = options.isEvidenceVisible() ? evidencePanelWidth.value + 8 : 0
    const maximum = Math.min(420, bodyWidth - evidenceSpace - options.contentMinimum - 8)
    historyPanelWidth.value = clampPanelWidth(historyPanelWidth.value + delta, 180, maximum)
  }

  /** 调整右栏时扣除当前可见的左栏；向右拖动表示缩窄右栏。 */
  function resizeEvidencePanel(delta: number): void {
    const bodyWidth = options.body.value?.clientWidth ?? 0
    const historySpace = options.isHistoryVisible() ? historyPanelWidth.value + 8 : 0
    const maximum = Math.min(520, bodyWidth - historySpace - options.contentMinimum - 8)
    evidencePanelWidth.value = clampPanelWidth(evidencePanelWidth.value - delta, 280, maximum)
  }

  return { panelStyle, resizeHistoryPanel, resizeEvidencePanel }
}
