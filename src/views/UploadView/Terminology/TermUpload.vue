<!-- 术语上传：录入术语名、所属类别（用于术语自身的归类与筛选）、出处与中英文定义；附件选填（仅 PDF），学生只需「上传附件 + 提交」，附件的大模型提取与文献入库由系统自动完成。 -->
<script>
// 模块级草稿暂存：切换菜单（组件销毁）后返回时恢复未提交的术语内容。
// 仅在 SPA 会话内有效——页面刷新后文件对象无法恢复，属浏览器限制。
const termDraft = {
  formModel: null,
}
</script>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  TERM_API_READY,
  addEntryToList,
  countTermAttachments,
  createDefinitionEntry,
  createSourceMla,
  getTermCategoryOptions,
  moveEntryInList,
  removeEntryFromList,
  submitTerm,
} from '@/api/terminology'

const formRef = ref()

// 页面提示文案：右下角提示条与右上角问号图标共用同一份文字
const formTipText =
  '提示：附件均为选填，仅支持 PDF，每个条目可上传多个附件。三个模块都可以「+ 新增」多条，新增多条后可用「上移 / 下移」调整顺序（顺序即提交顺序）。提交后附件由系统在后台自动识别并入库为文献，附件的所属类别与术语的所属类别保持一致，可在文献管理处查看上传文献。'

// 表单模型：
//   sources           术语出处 = 多条 MLA（附件在模块上，可多个）
//   definitions_cn/en 中/英文定义 = 多条定义，每条包含 定义文本 + 多条 MLA 出处 + 附件（可多个）
const createFormModel = () => ({
  name: '', // 术语名
  category: '', // 所属类别（必选，直接取现有大类，用于把术语关联到某一大类下）
  sources: [createSourceMla()], // 术语出处（多条 MLA）
  sourceAttachments: [], // 术语出处附件（选填，可多个）
  definitions_cn: [createDefinitionEntry()], // 术语定义（中文）
  definitions_en: [createDefinitionEntry()], // 术语定义（英文）
})

const formModel = ref(createFormModel())

/* ---------------- 多条目：新增 / 删除 / 排序 ---------------- */

// 术语出处：每条就是一个 MLA 输入框
const addSource = () => addEntryToList(formModel.value.sources, createSourceMla)
const removeSource = (index) => removeEntryFromList(formModel.value.sources, index)
const moveSource = (index, offset) => moveEntryInList(formModel.value.sources, index, offset)

// 中/英文定义：新增/删除/排序「定义条目」
const definitionFactories = {
  definitions_cn: createDefinitionEntry,
  definitions_en: createDefinitionEntry,
}
const addDefinition = (listKey) => addEntryToList(formModel.value[listKey], definitionFactories[listKey])
const removeDefinition = (listKey, index) => removeEntryFromList(formModel.value[listKey], index)
const moveDefinition = (listKey, index, offset) =>
  moveEntryInList(formModel.value[listKey], index, offset)

// 每个定义里的多条 MLA：新增/删除/排序
const addDefinitionMla = (listKey, index) =>
  addEntryToList(formModel.value[listKey][index].sources, createSourceMla)
const removeDefinitionMla = (listKey, index, mlaIndex) =>
  removeEntryFromList(formModel.value[listKey][index].sources, mlaIndex)
const moveDefinitionMla = (listKey, index, mlaIndex, offset) =>
  moveEntryInList(formModel.value[listKey][index].sources, mlaIndex, offset)

// 单条目里的必填规则（配合 :prop="`sources.${index}.mla`" 使用）
const requiredRule = (message) => [{ required: true, message, trigger: 'blur' }]

// 注意：附件均为选填，不要给附件加 required 规则，否则很多同学会因为附件缺失无法提交
const rules = {
  name: [{ required: true, message: '术语名不能为空', trigger: 'blur' }],
  category: [{ required: true, message: '所属类别不能为空', trigger: 'change' }],
}

const submitLoading = ref(false)

// 后端术语接口是否就绪（见 @/api/terminology.js），未就绪时只整理提交步骤、不发起请求
const apiReady = TERM_API_READY

/* ---------------- 所属类别：直接读取现有大类 ---------------- */

const categoryOptions = ref([])
const categoryLoading = ref(false)

const loadCategories = async () => {
  categoryLoading.value = true
  try {
    categoryOptions.value = await getTermCategoryOptions()
  } catch {
    categoryOptions.value = []
  } finally {
    categoryLoading.value = false
  }
}

// 注意：必须放在 loadCategories 定义之后，否则 const 的暂时性死区会抛错（整页白屏）
onMounted(loadCategories)

// 恢复模块级草稿：切菜单再回来，未提交的内容不丢
if (termDraft.formModel) {
  formModel.value = termDraft.formModel
}
watch(
  formModel,
  () => {
    termDraft.formModel = formModel.value
  },
  { deep: true },
)

// 是否有新选择的附件（三个模块的所有条目都算）
const hasAttachment = computed(() => countTermAttachments(formModel.value) > 0)

// 提交中的全屏加载提示：附件的大模型提取与文献入库都由系统自动完成
const submitLoadingText = computed(() =>
  hasAttachment.value ? '正在处理附件并提交，请勿操作…' : '正在提交术语，请勿操作…',
)

/* ---------------- 提交 ---------------- */

const onSubmit = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitLoading.value = true
  try {
    // 附件由系统自动完成「大模型提取 → 文献入库 → 按术语类别绑定」，学生只需上传 + 提交
    const result = await submitTerm(formModel.value)

    if (result.mock) {
      ElMessage.info('术语上传接口尚未接入，已按接口约定整理好「附件入库 + 术语提交」步骤，详见控制台')
      console.log('附件自动入库计划：', result.plan)
      console.log('待提交的术语表单数据（multipart/form-data）：', result.formData)
      return
    }

    if (result.ok === false) {
      ElMessage.error(result.message)
      return
    }

    // 标题与文献库里已有文献重复时是直接关联的，这里说清楚，避免误会成"文件没上传成功"
    if (result.reused?.length) {
      ElMessage.warning({
        message: `附件「${result.reused.map((item) => item.file).join('」、「')}」在文献库中已有同名文献，已直接关联已有文献，未重复入库`,
        duration: 10000,
        showClose: true,
      })
    }

    if (result.backendExtract) {
      // 新契约：附件文件已随术语提交，后台线程完成「大模型提取 → 文献入库 → 关联」
      ElMessage.success({
        message: '术语提交成功，附件正在后台识别，完成后可在术语查找中查看',
        duration: 10000,
        showClose: true,
      })
    } else {
      ElMessage.success('术语上传成功')
    }
    onReset()
  } finally {
    submitLoading.value = false
  }
}

const onReset = () => {
  formRef.value?.resetFields()
  formModel.value = createFormModel()
  // 提交成功后的重置：同时清掉模块级草稿
  termDraft.formModel = null
}
</script>

<template>
  <PageContainer title="术语上传">
    <div class="form-container">
      <div class="form-wrapper">
        <el-form
          ref="formRef"
          v-loading.fullscreen.lock="submitLoading"
          :element-loading-text="submitLoadingText"
          :model="formModel"
          :rules="rules"
          label-width="210px"
          style="width: 100%"
        >
        <el-alert
          v-if="!apiReady"
          class="api-hint"
          type="info"
          show-icon
          :closable="false"
          title="术语上传接口尚未接入"
          description="表单、附件识别与文献入库的步骤都已按接口约定准备好，后端接口就绪后即可正常提交。"
        />

        <!-- 基本信息：与下面的模块放在同一种容器里，保证输入框左边对齐 -->
        <div class="term-module">
          <div class="term-entry">
            <el-form-item label="术语名" prop="name">
              <el-input v-model="formModel.name" placeholder="请输入术语名" clearable></el-input>
            </el-form-item>

            <el-form-item label="所属类别" prop="category">
              <el-select
                v-model="formModel.category"
                :loading="categoryLoading"
                placeholder="请选择该术语所属的大类（附件所属类别与其一致）"
                style="width: 100%"
              >
                <el-option
                  v-for="item in categoryOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>
        </div>

        <!-- 模块一：术语出处（可新增多条 MLA，附件在模块上、可传多个） -->
        <div class="term-module">
          <div class="term-module__head">
            <div class="term-module__title-wrap">
              <span class="term-module__title">术语出处</span>
              <MlaSampleTooltip variant="cn" />
            </div>
            <el-button type="primary" plain size="small" @click="addSource">+ 新增出处</el-button>
          </div>

          <el-form-item
            v-for="(mla, index) in formModel.sources"
            :key="`source-${index}`"
            :label="`出处 ${index + 1}`"
            :prop="`sources.${index}`"
            :rules="requiredRule('术语出处不能为空')"
          >
            <div class="mla-row">
              <el-input
                v-model="formModel.sources[index]"
                type="textarea"
                :rows="2"
                placeholder="请输入术语出处，按照MLA格式"
              ></el-input>
              <div class="mla-row__ops">
                <el-button link size="small" :disabled="index === 0" @click="moveSource(index, -1)">
                  上移
                </el-button>
                <el-button
                  link
                  size="small"
                  :disabled="index === formModel.sources.length - 1"
                  @click="moveSource(index, 1)"
                >
                  下移
                </el-button>
                <el-button
                  link
                  size="small"
                  type="danger"
                  :disabled="formModel.sources.length === 1"
                  @click="removeSource(index)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="术语出处附件（选填）">
            <el-upload
              v-model:file-list="formModel.sourceAttachments"
              :auto-upload="false"
              :show-file-list="true"
              multiple
              accept=".pdf"
            >
              <el-button type="primary">上传附件（选填，可多选）</el-button>
            </el-upload>
          </el-form-item>
        </div>

        <!-- 模块二：术语定义（中文）：每个定义可写多条 MLA 出处，附件可多个 -->
        <div class="term-module">
          <div class="term-module__head">
            <div class="term-module__title-wrap">
              <span class="term-module__title">术语定义（中文）</span>
              <MlaSampleTooltip variant="cn" />
            </div>
            <el-button
              type="primary"
              plain
              size="small"
              @click="addDefinition('definitions_cn')"
            >
              + 新增定义
            </el-button>
          </div>

          <div
            v-for="(entry, index) in formModel.definitions_cn"
            :key="entry._uid"
            class="term-entry"
          >
            <div class="term-entry__head">
              <span class="term-entry__no">定义 {{ index + 1 }}</span>
              <div class="term-entry__ops">
                <el-button
                  size="small"
                  :disabled="index === 0"
                  @click="moveDefinition('definitions_cn', index, -1)"
                >
                  上移
                </el-button>
                <el-button
                  size="small"
                  :disabled="index === formModel.definitions_cn.length - 1"
                  @click="moveDefinition('definitions_cn', index, 1)"
                >
                  下移
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="formModel.definitions_cn.length === 1"
                  @click="removeDefinition('definitions_cn', index)"
                >
                  删除
                </el-button>
              </div>
            </div>

            <el-form-item
              label="术语定义（中文）"
              :prop="`definitions_cn.${index}.text`"
              :rules="requiredRule('术语定义（中文）不能为空')"
            >
              <el-input
                v-model="entry.text"
                type="textarea"
                :rows="2"
                placeholder="请输入术语定义（中文）"
              ></el-input>
            </el-form-item>

            <!-- 该定义的多条 MLA 出处：每条一个输入框 -->
            <el-form-item
              v-for="(mla, mlaIndex) in entry.sources"
              :key="`cn-mla-${index}-${mlaIndex}`"
              :label="`定义出处 ${mlaIndex + 1}`"
            >
              <div class="mla-row">
                <el-input
                  v-model="entry.sources[mlaIndex]"
                  type="textarea"
                  :rows="2"
                  placeholder="请输入术语定义（中文）出处，按照MLA格式"
                ></el-input>
                <div class="mla-row__ops">
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === 0"
                    @click="moveDefinitionMla('definitions_cn', index, mlaIndex, -1)"
                  >
                    上移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === entry.sources.length - 1"
                    @click="moveDefinitionMla('definitions_cn', index, mlaIndex, 1)"
                  >
                    下移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    type="danger"
                    :disabled="entry.sources.length === 1"
                    @click="removeDefinitionMla('definitions_cn', index, mlaIndex)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </el-form-item>

            <!-- 出处输入框后面的新增按钮：给当前定义再加一条 MLA -->
            <div class="mla-add-row">
              <el-button
                type="primary"
                plain
                size="small"
                @click="addDefinitionMla('definitions_cn', index)"
              >
                + 添加出处
              </el-button>
            </div>

            <el-form-item label="术语定义（中文）附件（选填）">
              <el-upload
                v-model:file-list="entry.attachments"
                :auto-upload="false"
                :show-file-list="true"
                multiple
                accept=".pdf"
              >
                <el-button type="primary">上传附件（选填，可多选）</el-button>
              </el-upload>
            </el-form-item>
          </div>
        </div>

        <!-- 模块三：术语定义（英文）：每个定义可写多条 MLA 出处，附件可多个 -->
        <div class="term-module">
          <div class="term-module__head">
            <div class="term-module__title-wrap">
              <span class="term-module__title">术语定义（英文）</span>
              <MlaSampleTooltip variant="en" />
            </div>
            <el-button
              type="primary"
              plain
              size="small"
              @click="addDefinition('definitions_en')"
            >
              + 新增定义
            </el-button>
          </div>

          <div
            v-for="(entry, index) in formModel.definitions_en"
            :key="entry._uid"
            class="term-entry"
          >
            <div class="term-entry__head">
              <span class="term-entry__no">定义 {{ index + 1 }}</span>
              <div class="term-entry__ops">
                <el-button
                  size="small"
                  :disabled="index === 0"
                  @click="moveDefinition('definitions_en', index, -1)"
                >
                  上移
                </el-button>
                <el-button
                  size="small"
                  :disabled="index === formModel.definitions_en.length - 1"
                  @click="moveDefinition('definitions_en', index, 1)"
                >
                  下移
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="formModel.definitions_en.length === 1"
                  @click="removeDefinition('definitions_en', index)"
                >
                  删除
                </el-button>
              </div>
            </div>

            <el-form-item
              label="术语定义（英文）"
              :prop="`definitions_en.${index}.text`"
              :rules="requiredRule('术语定义（英文）不能为空')"
            >
              <el-input
                v-model="entry.text"
                type="textarea"
                :rows="2"
                placeholder="请输入术语定义（英文）"
              ></el-input>
            </el-form-item>

            <!-- 该定义的多条 MLA 出处：每条一个输入框 -->
            <el-form-item
              v-for="(mla, mlaIndex) in entry.sources"
              :key="`en-mla-${index}-${mlaIndex}`"
              :label="`定义出处 ${mlaIndex + 1}`"
            >
              <div class="mla-row">
                <el-input
                  v-model="entry.sources[mlaIndex]"
                  type="textarea"
                  :rows="2"
                  placeholder="请输入术语定义（英文）出处，按照MLA格式"
                ></el-input>
                <div class="mla-row__ops">
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === 0"
                    @click="moveDefinitionMla('definitions_en', index, mlaIndex, -1)"
                  >
                    上移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    :disabled="mlaIndex === entry.sources.length - 1"
                    @click="moveDefinitionMla('definitions_en', index, mlaIndex, 1)"
                  >
                    下移
                  </el-button>
                  <el-button
                    link
                    size="small"
                    type="danger"
                    :disabled="entry.sources.length === 1"
                    @click="removeDefinitionMla('definitions_en', index, mlaIndex)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </el-form-item>

            <!-- 出处输入框后面的新增按钮：给当前定义再加一条 MLA -->
            <div class="mla-add-row">
              <el-button
                type="primary"
                plain
                size="small"
                @click="addDefinitionMla('definitions_en', index)"
              >
                + 添加出处
              </el-button>
            </div>

            <el-form-item label="术语定义（英文）附件（选填）">
              <el-upload
                v-model:file-list="entry.attachments"
                :auto-upload="false"
                :show-file-list="true"
                multiple
                accept=".pdf"
              >
                <el-button type="primary">上传附件（选填，可多选）</el-button>
              </el-upload>
            </el-form-item>
          </div>
        </div>

        <el-form-item>
          <el-button type="primary" :loading="submitLoading" @click="onSubmit">提交</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>

        <div class="form-tip">
          {{ formTipText }}
        </div>
      </el-form>
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.form-container {
  display: flex;
  justify-content: center; /* 水平居中 */
  padding-bottom: 30px; /* 底部留些空白，提示不贴边 */
}

/* 表单区宽度（内容居中，左右留白） */
.form-wrapper {
  width: 70%;
}

/* 顶部「术语上传」标题栏保留（PageContainer 自带卡片头） */

/* 后端接口未就绪的提示条 */
.api-hint {
  margin-bottom: 18px;
}

/* 提交按钮下方的一行说明 */
.form-tip {
  margin-top: -8px;
  font-size: 13px;
  line-height: 1.7;
  color: #909399;
}

/* 附件文件名过长时用省略号，避免撑破表单宽度 */
:deep(.el-upload-list__item-name) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 模块标题行：模块名 + MLA 样例问号图标（图标放在模块名右边） */
.term-module__title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 模块标题里的问号图标与标题同一行，去掉为文本域设计的上边距 */
.term-module__title-wrap :deep(.mla-question) {
  margin-top: 0;
}

/* 模块（术语出处 / 中文定义 / 英文定义）：每个模块可新增多条 */
.term-module {
  margin-bottom: 8px;
  padding: 12px 14px 2px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fafcff;
}

.term-module__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.term-module__title {
  padding-left: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #005767;
  border-left: 3px solid var(--el-color-primary, #005767);
}

/* 模块内的一条（定义）：多条时带序号与上移/下移/删除 */
.term-entry {
  padding: 10px 12px 2px;
  margin-bottom: 12px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  background: #fff;
}

.term-entry__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.term-entry__no {
  padding: 2px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  background: #eef1f6;
  border-radius: 10px;
}

.term-entry__ops {
  display: flex;
  gap: 6px;
}

/* MLA 输入框 + 右侧的上移/下移/删除 */
.mla-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.mla-row__ops {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  padding-top: 4px;
}

/* 定义里「出处输入框」后面的新增按钮 */
.mla-add-row {
  display: flex;
  justify-content: flex-end;
  margin: -8px 0 14px;
}

/* 表单标签与模块正文文字更清晰一些 */
:deep(.el-form-item__label) {
  font-weight: 600;
  color: #303133;
}
</style>
