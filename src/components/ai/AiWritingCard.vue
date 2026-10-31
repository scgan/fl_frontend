<!-- AI 对话中的知识库写作任务卡：确认来源、衔接阶段产物并对指定稿件发起修改。 -->
<script setup>
import { computed, ref, watch } from 'vue'
import { writingActionLabel, writingActionLocked } from '@/research/utils/writing-actions'

const props = defineProps({
  result: { type: Object, required: true },
  sourceRunId: { type: String, required: true },
  actions: { type: Object, default: () => ({}) },
  artifacts: { type: Array, default: () => [] },
  knowledgeBases: { type: Array, default: () => [] },
  loading: Boolean,
  busy: Boolean,
  query: { type: String, default: '' },
  error: { type: String, default: '' },
})
const emit = defineEmits(['run', 'export', 'reload'])
const stages = {
  RQ: '选题与研究问题',
  PLAN: '论文提纲',
  DRAFT: '章节起草',
  REVISE: '学术修改',
  THEORY: '理论框架',
}
// 表单仅描述当前任务，知识库与产物 ID 仍由服务端重新授权和校验。
const knowledgeBaseId = ref(null)
const stage = ref('')
const topic = ref('')
const requirements = ref('')
// 只有识别到用户额外要求时才展示补充说明；清空编辑内容时保留输入框，避免输入中途消失。
const supplementVisible = ref(false)
// 明确任务默认只读；只有用户主动更正或原需求模糊时才展示任务选择。
const correctingTask = ref(false)
const artifactId = ref('')
const sectionRef = ref('')
const sourceText = ref('')
const instruction = ref('')
const editing = ref(false)
const planning = computed(() => props.result.status === 'NEEDS_INPUT')
const confirmation = computed(() => props.actions.confirm)
const currentAction = computed(() => props.actions[planning.value ? 'confirm' : 'revise'])
const formLocked = computed(() => writingActionLocked(currentAction.value))
const confirmationLibrary = computed(
  () =>
    props.knowledgeBases.find((item) => item.id === confirmation.value?.writing?.knowledge_base_id)
      ?.name || `知识库 #${confirmation.value?.writing?.knowledge_base_id}`,
)
const libraryName = computed(
  () =>
    props.knowledgeBases.find((item) => item.id === props.result.knowledge_base_id)?.name ||
    `知识库 #${props.result.knowledge_base_id}`,
)
const availableArtifacts = computed(() =>
  props.artifacts.filter(
    (item) =>
      item.knowledge_base_id === knowledgeBaseId.value &&
      ({ PLAN: ['RQ'], DRAFT: ['PLAN'], REVISE: ['DRAFT', 'REVISE'] }[stage.value] || []).includes(
        item.stage,
      ),
  ),
)
const currentArtifact = computed(() =>
  availableArtifacts.value.find((item) => item.artifact_id === artifactId.value),
)
const sections = computed(() => currentArtifact.value?.sections || [])
const libraryAvailable = computed(() =>
  props.knowledgeBases.some((item) => item.id === knowledgeBaseId.value),
)
const ready = computed(
  () =>
    !props.loading &&
    !formLocked.value &&
    Boolean(stages[stage.value]) &&
    libraryAvailable.value &&
    topic.value.trim().length >= 2 &&
    (stage.value !== 'DRAFT' || (artifactId.value && sectionRef.value)) &&
    (stage.value !== 'REVISE' ||
      ((artifactId.value || sourceText.value.trim()) && instruction.value.trim().length >= 2)),
)

/** 任务或恢复快照变化时初始化；默认沿用最近一次明确使用的写作知识库。 */
function initialize() {
  knowledgeBaseId.value =
    props.result.knowledge_base_id || props.artifacts.at(-1)?.knowledge_base_id || null
  stage.value = props.result.stage || ''
  topic.value = props.result.research_topic ?? props.query
  restoreDetectedInstructions()
  correctingTask.value = false
  artifactId.value = ''
  sectionRef.value = props.result.section_ref || ''
  const submitted = props.actions.confirm
  if (planning.value && submitted?.writing) {
    knowledgeBaseId.value = submitted.writing.knowledge_base_id
    stage.value = submitted.writing.stage
    topic.value = submitted.query
    artifactId.value = submitted.writing.artifact_id || ''
    sectionRef.value = submitted.writing.section_ref || ''
    sourceText.value = submitted.writing.source_text || ''
    instruction.value = submitted.writing.revise_instruction || ''
    requirements.value = submitted.writing.writing_requirements || ''
    if (stage.value === 'REVISE') {
      instruction.value ||= requirements.value
      requirements.value = ''
    }
    supplementVisible.value = Boolean(requirements.value.trim())
  }
}
/** 按任务恢复已识别的要求；学术修改归入专属字段，其他任务仅展示非空的补充说明。 */
function restoreDetectedInstructions() {
  const detected = props.result.writing_requirements || ''
  instruction.value = stage.value === 'REVISE' ? props.result.revise_instruction || detected : ''
  requirements.value = stage.value === 'REVISE' ? '' : detected
  supplementVisible.value = Boolean(requirements.value.trim())
}
watch(() => [props.result, props.actions.confirm?.runId], initialize, { immediate: true })
watch(
  () => props.actions.revise?.status,
  (status) => {
    if (status === 'SUCCESS') editing.value = false
  },
)
watch(
  availableArtifacts,
  (items) => {
    if (!items.some((item) => item.artifact_id === artifactId.value))
      artifactId.value = items.at(-1)?.artifact_id || ''
  },
  { immediate: true },
)
watch(sections, (items) => {
  if (!items.some((item) => item.section_id === sectionRef.value)) sectionRef.value = ''
})

/** 仅发送界面中已明确确认的知识库、前序版本和章节。 */
function generate() {
  if (!ready.value || props.busy) return
  const writing = { knowledge_base_id: knowledgeBaseId.value, stage: stage.value }
  if (stage.value !== 'REVISE' && supplementVisible.value && requirements.value.trim())
    writing.writing_requirements = requirements.value.trim()
  if (planning.value && props.result.stage && stage.value !== props.result.stage)
    writing.task_corrected = true
  if (artifactId.value) writing.artifact_id = artifactId.value
  if (stage.value === 'DRAFT') writing.section_ref = sectionRef.value
  if (stage.value === 'REVISE') {
    writing.revise_instruction = instruction.value.trim()
    if (!artifactId.value) writing.source_text = sourceText.value.trim()
  }
  sendAction(planning.value ? 'confirm' : 'revise', topic.value.trim(), writing)
}
/** 更正任务时清除旧任务的规格及输入，保留独立的研究主题和知识库。 */
function changeTask() {
  requirements.value = ''
  supplementVisible.value = false
  artifactId.value = ''
  sectionRef.value = ''
  instruction.value = ''
  sourceText.value = ''
}
/** 取消更正时恢复原识别任务及其要求，防止标题和选择不一致。 */
function restoreTask() {
  stage.value = props.result.stage
  changeTask()
  restoreDetectedInstructions()
  correctingTask.value = false
}
/** 每个请求携带来源卡和稳定操作标识，供服务端去重与历史恢复。 */
function sendAction(key, query, writing) {
  if (props.busy || locked(key)) return
  emit('run', {
    query,
    writing: { ...writing, source_run_id: props.sourceRunId, source_action: key },
  })
}
/** 判断单项操作是否已被接受，不影响同卡片的其他选题或章节。 */
function locked(key) {
  return writingActionLocked(props.actions[key])
}
/** 在原按钮文案后附加生成、完成或重试状态。 */
function actionText(key, label) {
  const state = writingActionLabel(props.actions[key])
  return state ? `${label} · ${state}` : label
}
/** 阶段操作绑定当前产物，不依赖模型猜测选题或章节对应的 ID。 */
function nextStage(key, next, query, extra = {}) {
  sendAction(key, query, {
    knowledge_base_id: props.result.knowledge_base_id,
    stage: next,
    artifact_id: props.result.artifact_id,
    ...extra,
  })
}
/** 在当前稿件下面展开修改要求，提交后生成新版本并保留原稿。 */
function revise() {
  if (props.busy || locked('revise')) return
  stage.value = 'REVISE'
  knowledgeBaseId.value = props.result.knowledge_base_id
  artifactId.value = props.result.artifact_id
  topic.value = props.result.research_topic || props.query
  instruction.value = props.actions.revise?.writing?.revise_instruction || ''
  requirements.value = ''
  supplementVisible.value = false
  editing.value = true
}
</script>

<template>
  <section class="writing-card" aria-label="知识库写作任务">
    <div class="writing-heading">
      <strong>{{ stages[planning ? stage : result.stage] || '请明确写作任务' }}</strong>
      <span
        >{{
          planning
            ? writingActionLabel(confirmation) || (stage ? '待确认' : '待明确任务')
            : libraryName
        }}{{ result.version ? ` · 第 ${result.version} 版` : '' }}</span
      >
    </div>
    <div v-if="planning && formLocked" class="submitted-task" role="status">
      <p>{{ confirmationLibrary }} · {{ stages[confirmation.writing.stage] }}</p>
      <p>{{ confirmation.query }}</p>
      <p
        v-if="
          confirmation.writing.stage === 'REVISE' &&
          (confirmation.writing.revise_instruction || confirmation.writing.writing_requirements)
        "
      >
        修改要求：{{
          confirmation.writing.revise_instruction || confirmation.writing.writing_requirements
        }}
      </p>
      <p v-else-if="confirmation.writing.writing_requirements">
        补充说明：{{ confirmation.writing.writing_requirements }}
      </p>
      <p class="writing-tip">
        {{
          confirmation.status === 'SUCCESS'
            ? '此任务已完成，结果见下方写作卡片。'
            : '此任务已提交，正在生成，请勿重复提交。'
        }}
      </p>
    </div>
    <template v-else-if="planning || editing">
      <p class="writing-tip">
        {{
          planning && !result.stage
            ? result.clarification_question ||
              '请选择这次希望得到的写作成果，再确认知识库和研究主题。'
            : '确认知识库和研究主题后生成；材料不足时会明确提示。'
        }}
      </p>
      <p v-if="currentAction" class="writing-tip" role="status">
        {{ writingActionLabel(currentAction)
        }}{{ currentAction.error ? `：${currentAction.error}` : '' }}
      </p>
      <p v-if="editing && !loading && !libraryAvailable" class="writing-error">
        原知识库已不可访问，无法继续修改该稿件。
      </p>
      <p v-if="error" class="writing-error">
        {{ error }} <button type="button" @click="emit('reload')">重新加载</button>
      </p>
      <form class="writing-form" @submit.prevent="generate">
        <fieldset class="writing-fields" :disabled="busy || formLocked">
          <label
            >知识库
            <select
              v-model="knowledgeBaseId"
              aria-label="知识库"
              :disabled="busy || loading || editing"
              required
            >
              <option :value="null" disabled>
                {{ loading ? '正在加载知识库…' : '请选择知识库' }}
              </option>
              <option v-for="item in knowledgeBases" :key="item.id" :value="item.id">
                {{ item.name }} · {{ item.corpus_count }} 篇
              </option>
            </select>
          </label>
          <p v-if="!loading && !error && !knowledgeBases.length" class="writing-tip">
            暂无知识库，请先在知识库管理中添加文献。<router-link to="/user/knowledge-bases"
              >管理知识库</router-link
            >
          </p>
          <div v-if="!editing && result.stage && !correctingTask" class="identified-task">
            <div>
              <span>已识别任务</span><strong>{{ stages[stage] }}</strong>
            </div>
            <button
              type="button"
              class="action-button"
              :disabled="busy"
              @click="correctingTask = true"
            >
              更正任务
            </button>
          </div>
          <label v-else-if="!editing"
            >写作任务
            <select
              v-model="stage"
              aria-label="写作任务"
              :disabled="busy"
              required
              @change="changeTask"
            >
              <option value="" disabled>请选择希望得到的成果</option>
              <option v-for="(label, code) in stages" :key="code" :value="code">{{ label }}</option>
            </select>
            <span class="writing-tip">选题用于确定研究方向；提纲用于安排论文结构。</span>
            <button
              v-if="result.stage"
              type="button"
              class="action-button"
              :disabled="busy"
              @click="restoreTask"
            >
              保持原任务
            </button>
          </label>
          <label
            >研究主题<input
              v-model="topic"
              aria-label="研究主题"
              placeholder="例如：双减政策下教师工作负担"
              maxlength="3900"
              :disabled="busy"
              required
          /></label>
          <label v-if="planning && stage !== 'REVISE' && supplementVisible"
            >补充说明（从问题中识别，可修改或清空）<textarea
              v-model="requirements"
              aria-label="补充说明"
              maxlength="1000"
              rows="2"
              :disabled="busy"
            />
          </label>
          <label v-if="['PLAN', 'DRAFT', 'REVISE'].includes(stage) && !editing"
            >前序产物
            <select v-model="artifactId" aria-label="前序产物" :disabled="busy">
              <option value="">
                {{
                  stage === 'PLAN'
                    ? '直接根据主题生成'
                    : stage === 'REVISE'
                      ? '粘贴待修改原文'
                      : '请选择提纲'
                }}
              </option>
              <option
                v-for="item in availableArtifacts"
                :key="item.artifact_id"
                :value="item.artifact_id"
              >
                {{ stages[item.stage] }} · {{ item.section_ref || item.research_topic }} ·
                {{ item.artifact_id.slice(0, 6) }}
              </option>
            </select>
          </label>
          <label v-if="stage === 'DRAFT'"
            >目标章节
            <select v-model="sectionRef" aria-label="目标章节" :disabled="busy" required>
              <option value="" disabled>请选择章节</option>
              <option v-for="item in sections" :key="item.section_id" :value="item.section_id">
                {{ item.section_id }} {{ item.title }}
              </option>
            </select>
          </label>
          <label v-if="stage === 'REVISE' && !artifactId"
            >待修改原文<textarea
              v-model="sourceText"
              maxlength="4000"
              :disabled="busy"
              rows="5"
              required
            />
          </label>
          <label v-if="stage === 'REVISE'"
            >修改要求<textarea
              v-model="instruction"
              maxlength="500"
              :disabled="busy"
              rows="2"
              required
              placeholder="例如：补充文献支持，调整论证结构"
            />
          </label>
          <div class="writing-actions">
            <button class="action-button primary" :disabled="busy || !ready">
              {{
                actionText(planning ? 'confirm' : 'revise', editing ? '生成修改版本' : '确认并生成')
              }}</button
            ><button v-if="editing" type="button" class="action-button" @click="editing = false">
              收起
            </button>
          </div>
        </fieldset>
      </form>
    </template>
    <template v-else>
      <p class="writing-tip">
        {{ result.section_ref ? `章节 ${result.section_ref} · ` : ''
        }}{{
          result.artifact_id
            ? '已保存阶段产物，可继续创作或导出。'
            : '本轮未保存可继续使用的阶段产物。'
        }}
      </p>
      <p v-for="item in result.limitations || []" :key="item" class="writing-tip">{{ item }}</p>
      <div v-if="result.artifact_id" class="writing-actions">
        <template v-if="result.stage === 'RQ'">
          <button
            v-for="(item, index) in result.research_questions || []"
            :key="index"
            class="action-button"
            :disabled="busy || locked(`plan:${index}`)"
            @click="nextStage(`plan:${index}`, 'PLAN', item.question)"
          >
            {{ actionText(`plan:${index}`, `按选题 ${index + 1} 生成提纲`) }}
          </button>
        </template>
        <template v-if="result.stage === 'PLAN'">
          <button
            v-for="item in result.sections || []"
            :key="item.section_id"
            class="action-button"
            :disabled="busy || locked(`draft:${item.section_id}`)"
            @click="
              nextStage(`draft:${item.section_id}`, 'DRAFT', result.research_topic, {
                section_ref: item.section_id,
              })
            "
          >
            {{ actionText(`draft:${item.section_id}`, `起草 ${item.section_id} ${item.title}`) }}
          </button>
        </template>
        <button
          v-if="['DRAFT', 'REVISE'].includes(result.stage)"
          class="action-button"
          :disabled="busy || locked('revise')"
          @click="revise"
        >
          {{ actionText('revise', '修改本节') }}
        </button>
        <button class="action-button" :disabled="busy" @click="emit('export', result.artifact_id)">
          导出 Word
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.writing-card {
  margin: 18px 0;
  padding: 18px;
  border: 1px solid #dce8e5;
  border-radius: 12px;
  background: #f7faf9;
  color: #31575a;
}
.writing-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.writing-heading span,
.writing-tip {
  font-size: 12px;
  color: #718985;
  line-height: 1.7;
}
.writing-form {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}
.writing-fields {
  display: grid;
  gap: 14px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.submitted-task {
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.7;
}
.identified-task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.identified-task div {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.identified-task span {
  color: #718985;
}
.writing-form label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 550;
}
.writing-form input,
.writing-form select,
.writing-form textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid #cfded9;
  border-radius: 7px;
  padding: 9px 10px;
  background: #fff;
  color: #31575a;
  font: inherit;
}
.writing-form textarea {
  resize: vertical;
}
.writing-form :is(input, select, textarea):focus-visible {
  outline: 2px solid #075e60;
  outline-offset: 2px;
}
.writing-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.action-button {
  border: 1px solid #cadcd6;
  border-radius: 7px;
  padding: 8px 12px;
  background: #fff;
  color: #31575a;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  overflow-wrap: anywhere;
}
.action-button.primary {
  color: #fff;
  background: #075e60;
  border-color: #075e60;
}
.action-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.writing-error {
  color: #a3483c;
  font-size: 13px;
}
@media (max-width: 760px) {
  .writing-card {
    padding: 14px;
  }
  .writing-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
}
</style>
