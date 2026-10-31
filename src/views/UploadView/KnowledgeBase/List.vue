<!-- 展示当前用户的私有知识库，并提供创建、编辑和软删除操作。 -->
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Collection, Plus, Right, Document } from '@element-plus/icons-vue'
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  listKnowledgeBases,
  updateKnowledgeBase,
} from '@/api/knowledgeBase'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const dialogVisible = ref(false)
const editingId = ref(null)
const form = reactive({ name: '', description: '' })

/** 读取本人知识库列表。 */
async function load() {
  loading.value = true
  try {
    const response = await listKnowledgeBases({ page_num: page.value, page_size: pageSize.value })
    rows.value = response.data.data
    total.value = response.data.pagination.total
  } finally {
    loading.value = false
  }
}

/** 打开创建或编辑弹窗。 */
function openForm(row = null) {
  editingId.value = row?.id ?? null
  form.name = row?.name ?? ''
  form.description = row?.description ?? ''
  dialogVisible.value = true
}

/** 校验并保存知识库基础信息。 */
async function save() {
  const name = form.name.trim()
  const description = form.description.trim()
  if (!name || name.length > 127 || description.length > 255) {
    ElMessage.warning('名称须为 1–127 个字符，说明最多 255 个字符')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateKnowledgeBase(editingId.value, { name, description })
    } else {
      await createKnowledgeBase({ name, description })
    }
    dialogVisible.value = false
    ElMessage.success('保存成功')
    await load()
  } finally {
    saving.value = false
  }
}

/** 二次确认后软删除知识库。 */
async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除“${row.name}”吗？`, '删除知识库', { type: 'warning' })
  } catch {
    return
  }
  await deleteKnowledgeBase(row.id)
  ElMessage.success('知识库已删除')
  if (rows.value.length === 1 && page.value > 1) page.value -= 1
  await load()
}

/** 以本地时间显示后端的日期字段。 */
function formatDate(value) {
  return value || '—'
}

onMounted(load)
</script>

<template>
  <PageContainer title="知识库" hide-header>
    <!-- 顶部一行：简介靠页面左边，新建按钮靠右 -->
    <section class="library-bar">
      <p class="library-hint">按研究主题整理文献，让资料井然有序。</p>
      <el-button type="primary" :icon="Plus" @click="openForm()">新建知识库</el-button>
    </section>
    <section class="library-intro">
      <span class="library-total">共 <strong>{{ total }}</strong> 个知识库</span>
    </section>
    <div v-loading="loading" class="library-content">
      <div v-if="rows.length" class="library-grid">
        <article v-for="row in rows" :key="row.id" class="library-card">
          <div class="card-heading">
            <span class="library-icon"><el-icon :size="23"><Collection /></el-icon></span>
            <div class="card-title">
              <button class="title-link" :title="row.name" @click="router.push(`/user/knowledge-bases/${row.id}`)">{{ row.name }}</button>
              <span class="private-label">个人知识库</span>
            </div>
          </div>
          <p class="card-description" :title="row.description || ''">{{ row.description || '暂无说明，可在编辑中补充研究主题或资料用途。' }}</p>
          <div class="card-meta">
            <span class="document-count"><el-icon><Document /></el-icon><strong>{{ row.corpus_count }}</strong> 篇文献</span>
            <span class="updated-time" :title="formatDate(row.update_time)">更新于 {{ formatDate(row.update_time) }}</span>
          </div>
          <div class="card-footer">
            <el-button link type="primary" @click="router.push(`/user/knowledge-bases/${row.id}`)">查看文献 <el-icon class="enter-icon"><Right /></el-icon></el-button>
            <div class="card-actions">
              <el-button link @click="openForm(row)">编辑</el-button>
              <span class="action-divider"></span>
              <el-button link class="delete-action" @click="remove(row)">删除</el-button>
            </div>
          </div>
        </article>
      </div>
      <el-empty v-else-if="!loading" description="还没有知识库，创建一个来整理你的文献">
        <el-button type="primary" :icon="Plus" @click="openForm()">创建第一个知识库</el-button>
      </el-empty>
    </div>
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      class="pager"
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50]"
      :total="total"
      @change="load"
    />
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑知识库' : '新建知识库'" width="min(520px, 92vw)">
      <el-form label-position="top" class="library-form">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="例如：跨文化交流研究" maxlength="127" show-word-limit />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" placeholder="简单介绍这个知识库的研究主题或资料用途（选填）" type="textarea" :rows="4" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.pager { justify-content: flex-end; margin-top: 20px; }
.library-intro { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin: 4px 0 24px; }
/* 顶部一行：简介贴页面左边，新建按钮靠右 */
.library-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 2px 0 16px; }
.library-hint { margin: 0; color: #909399; font-size: 13.5px; line-height: 1.6; }
.library-total { flex-shrink: 0; color: #909399; font-size: 13px; }
.library-total strong { color: #606266; font-variant-numeric: tabular-nums; }
.library-content { min-height: 240px; }
.library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr)); gap: 20px; }
.library-card { min-width: 0; padding: 22px 22px 0; border: 1px solid #e8ecf1; border-radius: 12px; background: #fff; transition: border-color .2s, box-shadow .2s; }
.library-card:hover { border-color: #b8d8f8; box-shadow: 0 6px 20px #25385809; }
.card-heading { display: flex; align-items: center; gap: 14px; }
.library-icon { display: grid; place-items: center; width: 46px; height: 46px; flex-shrink: 0; border-radius: 12px; background: #eef4f5; color: #005767; }
.card-title { min-width: 0; }
.title-link { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0; border: 0; background: none; color: #303133; font: inherit; font-size: 17px; font-weight: 600; text-align: left; cursor: pointer; }
.title-link:hover { color: #005767; }
.title-link:focus-visible { outline: 2px solid #005767; outline-offset: 4px; border-radius: 2px; }
.private-label { display: block; margin-top: 5px; color: #909399; font-size: 12px; }
.card-description { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; min-height: 44px; margin: 18px 0; color: #909399; font-size: 13px; line-height: 22px; }
.card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-bottom: 18px; font-size: 12px; }
.document-count { display: flex; align-items: center; gap: 5px; color: #606266; }
.document-count strong { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.updated-time { color: #a0a4ac; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; min-height: 54px; border-top: 1px solid #f0f2f5; }
.enter-icon { margin-left: 6px; }
.card-actions { display: flex; align-items: center; gap: 12px; }
.card-actions :deep(.el-button) { font-size: 13px; color: #909399; margin: 0; }
.card-actions :deep(.el-button:hover) { color: #005767; }
.card-actions :deep(.delete-action:hover) { color: #f56c6c; }
.action-divider { width: 1px; height: 12px; background: #e8ecf1; }
.library-form { padding-top: 8px; }
@media (max-width: 640px) {
  .library-intro { align-items: flex-start; flex-direction: column; gap: 12px; }
  .pager { overflow-x: auto; justify-content: flex-start; }
}
</style>
