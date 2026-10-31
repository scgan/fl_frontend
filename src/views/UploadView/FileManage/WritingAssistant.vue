<!-- 辅助创作工作台：知识库及 AI 入口选文交接，复用 Research 会话和阶段产物。 -->
<template>
  <div class="assistant-page">
    <!-- 顶部连接配置 -->
    <div class="config-bar">
      <span v-if="selectionScope" class="config-label">{{ selectedCorpusIds.length ? `已选 ${selectedCorpusIds.length} 篇文献` : '全库文献' }}</span>
      <span v-else class="config-label">知识库</span>
      <el-select
        v-if="!selectionScope"
        v-model="knowledgeBaseId"
        filterable
        allow-create
        default-first-option
        :reserve-keyword="false"
        :loading="kbLoading"
        placeholder="选择知识库（也可直接输入 ID）"
        style="width: 260px"
        @change="onKnowledgeBaseChange"
        @visible-change="onKnowledgeBaseToggle"
      >
        <el-option
          v-for="item in knowledgeBases"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        >
          <span class="kb-option-name">{{ item.name }}</span>
          <span class="kb-option-count">{{ item.corpus_count }} 篇</span>
        </el-option>
      </el-select>
      <span class="config-label">运行模式</span>
      <el-select v-model="mode" style="width: 110px">
        <el-option label="FAST" value="FAST" />
        <el-option label="DEEP" value="DEEP" />
      </el-select>
      <el-button size="small" @click="guideVisible = true">使用指南</el-button>
      <el-button size="small" @click="showConversations">历史对话</el-button>
      <el-button size="small" @click="newConversation">新建对话</el-button>
      <el-button size="small" @click="showArtifacts">产物历史</el-button>
      <span class="config-tip">
        {{ knowledgeBaseTip }}
      </span>
    </div>

    <div class="main">
      <!-- 左侧编辑器 -->
      <section v-show="!editorCollapsed" class="editor-pane">
        <div class="editor-toolbar">
          <button class="fake-btn" title="撤销" @mousedown.prevent @click="execCmd('undo')">↶</button>
          <button class="fake-btn" title="重做" @mousedown.prevent @click="execCmd('redo')">↷</button>
          <button class="fake-btn" title="清空全部内容" @mousedown.prevent @click="clearEditor">🗑</button>
          <select v-model="blockFormat" class="fmt-select" title="段落样式" @change="onBlockFormat">
            <option value="p">正文</option>
            <option value="h1">标题 1</option>
            <option value="h2">标题 2</option>
            <option value="h3">标题 3</option>
          </select>
          <select v-model="fontFamily" class="fmt-select" @mousedown.stop @change="onFontFamily">
            <option v-for="f in FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
          </select>
          <select v-model="fontSize" class="fmt-select" @mousedown.stop @change="onFontSize">
            <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s }}px</option>
          </select>
          <select v-model="lineHeight" class="fmt-select" title="行距" @change="onLineHeight">
            <option v-for="lh in LINE_HEIGHTS" :key="lh" :value="lh">{{ lh }} 倍</option>
          </select>
          <input
            type="color"
            class="color-input"
            title="字体颜色"
            value="#000000"
            @mousedown.stop
            @input="onForeColor($event)"
          />
          <input
            type="color"
            class="color-input"
            title="背景高亮"
            value="#fef08a"
            @mousedown.stop
            @input="onHilite($event)"
          />
          <button class="fake-btn" title="加粗" @mousedown.prevent @click="execCmd('bold')"><b>B</b></button>
          <button class="fake-btn" title="斜体" @mousedown.prevent @click="execCmd('italic')"><i>I</i></button>
          <button class="fake-btn" title="下划线" @mousedown.prevent @click="execCmd('underline')"><u>U</u></button>
          <button class="fake-btn" title="删除线" @mousedown.prevent @click="execCmd('strikeThrough')"><s>S</s></button>
          <button class="fake-btn" title="上标" @mousedown.prevent @click="execCmd('superscript')">x¹</button>
          <button class="fake-btn" title="下标" @mousedown.prevent @click="execCmd('subscript')">x₁</button>
          <button class="fake-btn" title="无序列表" @mousedown.prevent @click="execCmd('insertUnorderedList')">• ≡</button>
          <button class="fake-btn" title="有序列表" @mousedown.prevent @click="execCmd('insertOrderedList')">1. ≡</button>
          <button class="fake-btn" title="左对齐" @mousedown.prevent @click="execCmd('justifyLeft')">⇤</button>
          <button class="fake-btn" title="居中" @mousedown.prevent @click="execCmd('justifyCenter')">≡</button>
          <button class="fake-btn" title="右对齐" @mousedown.prevent @click="execCmd('justifyRight')">⇥</button>
          <button class="fake-btn" title="清除格式" @mousedown.prevent @click="execCmd('removeFormat')">⌫格式</button>
          <button class="fake-btn" title="当前段落上移" @mousedown.prevent @click="moveBlock(-1)">↑段</button>
          <button class="fake-btn" title="当前段落下移" @mousedown.prevent @click="moveBlock(1)">↓段</button>
          <el-dropdown trigger="click" :disabled="!hasSelection" @command="onAiCommand">
            <span
              class="fake-btn ai-btn"
              :class="{ 'is-disabled': !hasSelection }"
              :title="hasSelection ? '对选中文字执行 AI 创作' : '先选中一段文字'"
              @mousedown.prevent
            >
              ✦ AI 创作
              <span v-if="hasSelection" class="ai-btn-count">{{ selectionWords }} 字</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="act in polishActions"
                  :key="act.code"
                  :command="`polish:${act.code}`"
                  :disabled="running"
                >
                  {{ act.icon }} {{ act.label }}
                </el-dropdown-item>
                <el-dropdown-item divided command="theory:explain" :disabled="running">
                  ? 概念解释
                </el-dropdown-item>
                <el-dropdown-item command="theory:recommend" :disabled="running">
                  ❖ 文献推荐
                </el-dropdown-item>
                <el-dropdown-item divided command="revise" :disabled="running">
                  ⇄ 学术修改
                </el-dropdown-item>
                <el-dropdown-item divided command="copy">⧉ 复制选中文字</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-popover v-model:visible="findVisible" trigger="click" placement="bottom-start" :width="320">
            <template #reference>
              <span class="fake-btn" title="查找替换">查找</span>
            </template>
            <div class="mini-form">
              <el-input
                v-model="findText"
                size="small"
                placeholder="查找内容"
                clearable
                @input="refreshMatchCount"
              />
              <el-input v-model="replaceText" size="small" placeholder="替换为（可留空）" clearable />
              <div class="mini-row">
                <el-button size="small" @click="jumpToNextMatch(1)">下一个</el-button>
                <el-button size="small" @click="jumpToNextMatch(-1)">上一个</el-button>
                <el-button size="small" @click="replaceCurrentMatch">替换</el-button>
                <el-button size="small" type="primary" @click="replaceAllMatches">全部替换</el-button>
              </div>
              <div class="mini-tip">
                共 {{ matchCount }} 处匹配<span v-if="matchIndex"> · 当前第 {{ matchIndex }} 处</span>
              </div>
            </div>
          </el-popover>
          <el-popover v-model:visible="versionVisible" trigger="click" placement="bottom-start" :width="330">
            <template #reference>
              <span class="fake-btn" title="历史版本">版本</span>
            </template>
            <div class="mini-form">
              <div class="mini-row spread">
                <span class="mini-tip">自动备份：每 30 秒 / AI 写入前</span>
                <el-button size="small" link type="primary" @click="snapshotVersion('手动备份')">
                  立即备份
                </el-button>
              </div>
              <div v-if="!versions.length" class="mini-tip">还没有历史版本</div>
              <div v-for="item in versions.slice(0, 10)" :key="item.id" class="version-row">
                <span class="version-meta">
                  {{ versionTime(item.at) }} · {{ item.label }} · {{ item.words }} 字
                </span>
                <span class="version-actions">
                  <el-button size="small" link type="primary" @click="restoreVersion(item)">恢复</el-button>
                  <el-button size="small" link type="danger" @click="removeVersion(item.id)">删除</el-button>
                </span>
              </div>
            </div>
          </el-popover>
          <button
            class="fake-btn"
            :class="{ active: outlineVisible }"
            title="显示/隐藏大纲"
            @mousedown.prevent
            @click="outlineVisible = !outlineVisible"
          >☰大纲</button>
          <button
            class="fake-btn"
            title="把当前编辑器里的内容导出为 Word"
            @mousedown.prevent
            @click="onExportEditor"
          >⬇ 导出Word</button>
          <span class="save-tip">字数：{{ wordCount }}</span>
          <span class="save-tip">{{ editorTip }}</span>
        </div>
        <div ref="editorWrapRef" class="editor-wrap" @scroll="hideFloatingBar" @click="onCitationClick">
          <EditorContent :editor="editor" class="editor" />
          <!-- 划词浮动工具条：选中文字松手后出现，与顶部「AI 创作」并存 -->
          <div
            v-show="floatingBar.visible"
            ref="selToolbarRef"
            class="sel-toolbar"
            :style="{ top: floatingBar.top + 'px', left: floatingBar.left + 'px' }"
            @mousedown.prevent
          >
            <button
              v-for="act in polishActions"
              :key="act.code"
              type="button"
              :disabled="running"
              @mousedown.prevent
              @click="runBarAction(() => runPolish(act))"
            >
              <span class="ico">{{ act.icon }}</span>{{ act.label }}
            </button>
            <span class="sep"></span>
            <button
              type="button"
              :disabled="running"
              @mousedown.prevent
              @click="runBarAction(() => runTheory('explain'))"
            >
              <span class="ico">?</span>概念解释
            </button>
            <button
              type="button"
              :disabled="running"
              @mousedown.prevent
              @click="runBarAction(() => runTheory('recommend'))"
            >
              <span class="ico">❖</span>文献推荐
            </button>
            <span class="sep"></span>
            <button
              type="button"
              :disabled="running"
              @mousedown.prevent
              @click="runBarAction(onReviseClick)"
            >
              <span class="ico">⇄</span>学术修改
            </button>
            <button type="button" @mousedown.prevent @click="runBarAction(copySelection)">
              <span class="ico">⧉</span>复制
            </button>
          </div>
          <!-- 大纲导航（点击标题跳转） -->
          <div v-if="outlineVisible" class="outline-pane">
            <div class="outline-head">
              大纲 <span class="outline-count">{{ outlineItems.length }}</span>
            </div>
            <div v-if="!outlineItems.length" class="outline-empty">
              用工具栏的「正文 / 标题 1-3」设置标题后，这里会自动生成大纲
            </div>
            <div
              v-for="(item, index) in outlineItems"
              :key="`${item.pos}-${index}`"
              class="outline-item"
              :class="`lv${item.level}`"
              @click="jumpToHeading(item)"
            >
              {{ item.text }}
            </div>
          </div>
          <div class="word-count">
            字数：{{ wordCount }}
            <span v-if="hasSelection"> · 已选 {{ selectionWords }} 字</span>
          </div>
        </div>
      </section>

      <!-- 右侧助手面板 -->
      <!-- 折叠把手：位于两栏之间，点击切换；纯图形，无文字 -->
      <div
        class="pane-splitter"
        :class="{ 'is-collapsed': editorCollapsed }"
        :title="editorCollapsed ? '展开编辑区' : '折叠编辑区'"
        role="button"
        :aria-label="editorCollapsed ? '展开编辑区' : '折叠编辑区'"
        @click="toggleEditorPane()"
      >
        <span class="splitter-handle">
          <svg
            class="splitter-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="11 6 5 12 11 18" />
            <polyline points="19 6 13 12 19 18" />
          </svg>
        </span>
      </div>

      <aside class="chat-pane">
        <div class="quick-tags">
          <el-tag
            v-for="tag in quickTags"
            :key="tag"
            class="quick-tag"
            @click="onQuickTag(tag)"
          >
            {{ tag }}
          </el-tag>
        </div>
        <div ref="chatRef" class="chat">
          <div v-if="messages.length === 0" class="chat-empty">
            在下方输入框提问（基于知识库证据作答），或先选中左侧文字再用上方「AI 创作」。<br />
            续写、润色等操作直接改写选区；概念解释、文献推荐基于知识库证据。
          </div>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="msg"
            :class="msg.role"
            :data-run-id="msg.runId || ''"
          >
            <div v-if="msg.role === 'user'" class="msg-bubble">{{ msg.content }}</div>
            <div v-else class="msg-card">
              <div class="msg-body" v-html="msg.html"></div>
              <div v-if="msg.meta" class="msg-meta">{{ msg.meta }}</div>
              <div v-if="msg.ops && msg.ops.length" class="msg-ops">
                <el-button
                  v-for="(op, opIndex) in msg.ops"
                  :key="op.code || op.label"
                  size="small"
                  :type="opIndex === 0 ? 'primary' : ''"
                  :plain="opIndex === 0"
                  @click="runMessageOp(op, msg)"
                >
                  {{ op.label }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
        <div class="input-bar">
          <div class="input-modes">
            <el-checkbox v-model="deepThink" size="small">深度思考</el-checkbox>
            <span class="input-tip">Quill · AI 辅助生成，请遵守所在机构学术规范</span>
          </div>
          <div class="input-row">
            <el-input
              ref="composerRef"
              v-model="draftInput"
              type="textarea"
              :rows="4"
              :placeholder="selectionScope ? '输入问题，基于当前文献范围作答；Enter 发送，Shift+Enter 换行' : '输入问题，基于知识库证据作答；Enter 发送，Shift+Enter 换行'"
            />
            <!-- 发送/停止二合一：空闲时发送，生成中变红即停止，不再单独占一个按钮 -->
            <el-button
              :type="running ? 'danger' : 'primary'"
              class="send-btn"
              :title="running ? '停止生成' : '发送'"
              @click="onSendOrStop"
            >
              {{ running ? '■' : '➤' }}
            </el-button>
          </div>
        </div>
      </aside>
    </div>

    <!-- 产物历史弹窗 -->
    <el-dialog v-model="artifactDialogVisible" title="产物历史" width="720px">
      <el-table :data="artifactRows" size="small" max-height="420">
        <el-table-column prop="stage" label="阶段" width="90" />
        <el-table-column prop="version" label="版本" width="70" />
        <el-table-column prop="section_ref" label="章节" width="80" />
        <el-table-column prop="created_at" label="生成时间" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain @click="downloadArtifact(row)">
              导出 Word
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

  <!-- 使用指南弹窗 -->
  <el-dialog v-model="guideVisible" title="辅助创作使用指南" width="720px" top="4vh">
    <div class="guide">
      <h3>一、用前准备（决定效果上限）</h3>
      <ul>
        <li><b>知识库是根基</b>：所有证据来自上方所选知识库，文献需「审核通过 + 已向量化」才能被引用。文献越多、越贴合主题，质量越高。</li>
        <li><b>运行模式</b>：日常润改用 FAST；大纲、起草、选题推荐用 DEEP（证据更全）。</li>
        <li><b>深度思考</b>：大纲、整篇起草等复杂任务勾选，润色改写不必。</li>
      </ul>
      <h3>二、写论文的推荐流程</h3>
      <ol>
        <li><b>流程</b>：选题推荐 → 文章大纲 → 起草 → 写入正文 → 导出。除正文编辑外，所有生成都在<b>右侧对话</b>里完成（点快捷标签或直接输入）。</li>
        <li><b>选题推荐</b>：输入具体研究方向，得到带引用的候选研究问题。</li>
        <li><b>文章大纲</b>：用同一主题生成大纲，自动衔接上一步的选题产物，输出每节写作要点与建议参考文献。</li>
        <li><b>整篇连播起草</b>：在大纲卡片上点击，自动逐节起草全文（每节独立带引用）。生成期间可以切到别的页面，回来后会自动接着显示进度与结果；也可以点「■ 停止」中断。</li>
        <li><b>导出</b>：左侧工具栏「⬇ 导出Word」导出你当前写的这一稿（标题层级、加粗、上标都会保留）；产物历史里可单独导出各阶段产物。</li>
        <li><b>写作辅助</b>：「☰大纲」按标题生成目录并可点击跳转；「查找」支持查找替换；「版本」每 30 秒、AI 写入前与清空前自动备份，可一键恢复；点击答案或正文里的 [n] 打开原文后，「生成参考文献」只在文末补条目（正文里已有 [n] 时用这个），需要新加引用标记再点「同时在光标处插入引用标记」；想专注看对话时，点两栏中间的分隔把手即可收起编辑区，右侧对话占满宽度（再点一次展开）。</li>
      </ol>
      <h3>三、随时可用的助手</h3>
      <ul>
        <li><b>自由问答 / 研究设计 / 文献评价</b>：下方输入框直接提问或点快捷标签，基于知识库证据作答。</li>
        <li><b>AI 创作（顶部菜单）</b>：先在左侧选中文字（工具栏会显示「已选 N 字」），再点上方 <b>✦ AI 创作</b> 选续写/扩写/缩写/改写/润色/中英互译/概念解释/文献推荐/学术修改/复制；结果可「替换选区」直接回写编辑器。</li>
        <li><b>文献推荐</b>：选中概念（如「形成性评价」），推荐相关理论依据与文献，写综述神器。</li>
      </ul>
      <h3>四、好习惯</h3>
      <ul>
        <li>答案中的 <b>[n] 引用可以点击</b>，查看原文摘录与 PDF；写进论文前务必人工核对。</li>
        <li>AI 输出当草稿不当成品：替换进编辑器后用格式工具条自行打磨，内容自己负责。</li>
        <li>编辑器自动保存，刷新不丢；历史对话在抽屉里随时找回；左侧内容与各阶段产物都能导出 Word。</li>
        <li>想重新开始用「新建对话」，旧会话都在「历史对话」里丢不了。</li>
      </ul>
    </div>
  </el-dialog>

  <!-- 历史对话抽屉 -->
  <el-drawer v-model="convDrawerVisible" title="历史对话" size="400px">    <div class="conv-list">
      <div
        v-for="row in conversationRows"
        :key="row.id"
        class="conv-item"
        :class="{ active: row.id === conversationId }"
        @click="openConversation(row)"
      >
        <div class="conv-title">{{ row.title || '未命名会话' }}</div>
        <div class="conv-time">{{ String(row.updated_at || '').replace('T', ' ').slice(0, 16) }}</div>
        <div v-if="row.id === conversationId" class="conv-current">当前</div>
      </div>
      <div v-if="!conversationRows.length" class="conv-empty">暂无历史对话</div>
    </div>
  </el-drawer>

  <!-- 引用原文弹窗 -->
  <el-dialog v-model="citeDialog.visible" title="引用原文" width="640px">      <template v-if="citeDialog.item">
        <div class="cite-header">
          <div class="cite-badge" :class="citeDialog.item.source_unavailable ? 'bad' : 'ok'">
            {{ citeDialog.item.source_unavailable ? '来源已失效' : '来源可用' }}
          </div>
          <div class="cite-title">
            {{ citeDialog.item.title_cn || citeDialog.item.title_en || '未知文献' }}
          </div>
        </div>
        <div class="cite-meta">
          <span v-if="citeDialog.item.author" class="cite-chip">
            <span class="chip-label">作者</span>{{ citeDialog.item.author }}
          </span>
          <span v-if="citeDialog.item.source" class="cite-chip">
            <span class="chip-label">来源</span>{{ citeDialog.item.source }}
          </span>
          <span v-if="citeDialog.item.publish_time" class="cite-chip">
            <span class="chip-label">年份</span>{{ citeDialog.item.publish_time }}
          </span>
          <span v-if="citeDialog.item.page_start" class="cite-chip">
            <span class="chip-label">页码</span>第 {{ citeDialog.item.page_start
            }}{{ citeDialog.item.page_end ? '-' + citeDialog.item.page_end : '' }} 页
          </span>
        </div>
        <div class="cite-quote-label">原文摘录</div>
        <div class="cite-quote">
          <p
            v-for="(para, paraIndex) in citeExcerpt.paragraphs"
            :key="paraIndex"
            class="cite-para"
          >
            <span
              v-for="(sentence, sentenceIndex) in para.sentences"
              :key="sentenceIndex"
              :class="{ 'cite-hit': sentence.hit }"
            >{{ sentence.text }}</span>
          </p>
        </div>
        <div v-if="citeExcerpt.hitCount" class="cite-hit-tip">
          已高亮 {{ citeExcerpt.hitCount }} 句与你正文最贴近的原文，请核对引述是否准确
        </div>
        <div v-else-if="citeDialog.contextText" class="cite-hit-tip muted">
          未能在摘录中定位到对应原句（可能被改写幅度较大），请人工核对
        </div>
        <div class="cite-actions">
          <el-button
            v-if="!citeDialog.item.source_unavailable && citeDialog.item.file_url"
            type="primary"
            plain
            size="small"
            @click="openCitePdf"
          >
            查看原文 PDF
          </el-button>
          <span v-else class="cite-warn">原文附件已失效，仅展示摘录。</span>
          <el-button
            type="primary"
            size="small"
            :disabled="!citeDialog.runId"
            @click="generateReferenceOnly(citeDialog.runId, citeDialog.index)"
          >
            生成参考文献
          </el-button>
          <el-button
            size="small"
            :disabled="!citeDialog.runId"
            @click="insertCitation(citeDialog.runId, citeDialog.index)"
          >
            同时在光标处插入引用标记
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { http as researchHttp } from '@/research/api/http'
import { ElMessage, ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import { blocksFromJson, buildReference, editorExportTitle, highlightExcerpt, plainTextFromHtml, pushVersion, sanitizeDraftHtml, splitExcerptParagraphs, textToNodes } from '@/utils/quillEditor'
import { fetchForeignKnowledgeBases } from '@/research/api/foreign-resources'
import {
  createQuillRunService,
  getQuillRunService,
  getQuillRunReasoningService,
  getQuillRunEvidenceService,
  getQuillConversationService,
  getQuillConversationListService,
  getQuillArtifactsService,
  cancelQuillRunService,
  exportQuillDocxService,
} from '@/api/quill'

// ---------- 知网工具条的七个纯创作操作 ----------
const polishActions = [
  { code: 'CONTINUE', label: '续写', icon: '✎' },
  { code: 'EXPAND', label: '扩写', icon: '⇲' },
  { code: 'SHORTEN', label: '缩写', icon: '⇱' },
  { code: 'REWRITE', label: '改写', icon: '↻' },
  { code: 'POLISH', label: '润色', icon: '✓' },
  { code: 'ZH2EN', label: '中译英', icon: '中⇄英' },
  { code: 'EN2ZH', label: '英译中', icon: 'EN⇄中' },
]
const ACTION_LABELS = Object.fromEntries(
  polishActions.map((item) => [item.code, item.label]),
)

// 快捷入口：全部对应真实功能
// 研究设计/文献评价 = 启明问答的结构化提问（基于知识库证据 + [n] 引用）
const quickTags = ['写作询问', '选题推荐', '研究设计', '文献评价', '文章大纲']

const GUIDED_PROMPTS = {
  研究设计: (topic) =>
    `请围绕研究主题「${topic}」给出研究设计方案，包括：研究问题与假设、研究对象与数据来源、研究方法与实施步骤、创新点与可行性。基于知识库文献给出依据，并用 [n] 标注引用。`,
  文献评价: (topic) =>
    `请基于知识库文献，对与「${topic}」相关的研究进行文献评价：逐篇评述其研究方法、主要贡献与局限性，并给出总体评价，用 [n] 标注引用。`,
}

// 会话内最近一次 RQ 产物，供「文章大纲」阶段衔接引用
const lastRqArtifactId = ref(null)

// 产物历史弹窗
const artifactDialogVisible = ref(false)
const artifactRows = ref([])

// 历史对话抽屉
const convDrawerVisible = ref(false)
const conversationRows = ref([])

// 引用原文弹窗
const citeDialog = ref({ visible: false, item: null, contextText: '' })

// 原文摘录排版：按段落/句末断段，并把与「引用语境」最贴近的句子标记出来高亮
const citeExcerpt = computed(() =>
  highlightExcerpt(
    citeDialog.value.item?.content_snapshot || '',
    citeDialog.value.contextText || '',
  ),
)

// 使用指南：首次进入自动弹出，之后从按钮打开
const guideVisible = ref(false)

// ---------- 状态 ----------
const editorWrapRef = ref(null) // .editor-wrap：划词工具条的定位基准
const chatRef = ref(null)
const route = useRoute()
// AI 交接与知识库互斥；空列表明确表示全库，不隐式套用上次知识库。
const selectionScope = ref(false)
const handoffReady = ref(!route.query.source_run)
const selectedCorpusIds = ref([])
const knowledgeBaseId = ref(Number(localStorage.getItem('quillKbId')) || null)
const mode = ref('FAST')
const deepThink = ref(false)
const draftInput = ref('')
const running = ref(false)
const composerRef = ref(null)
const editorTip = ref('选中文字后用上方「AI 创作」')

// ---------- 知识库选择 ----------
const knowledgeBases = ref([])
const kbLoading = ref(false)
const kbLoadFailed = ref(false)

/**
 * 拉取知识库列表。
 * @param {{silent?: boolean}} [options] silent=true 时失败不弹提示（点开下拉框自动刷新时用）
 */
const loadKnowledgeBases = async (options = {}) => {
  const silent = options.silent === true
  kbLoading.value = true
  kbLoadFailed.value = false
  try {
    const resp = await fetchForeignKnowledgeBases(1, 100)
    knowledgeBases.value = resp.items || []
    // 上次选的库已不存在（或首次进入）时，自动落到第一个可用库
    const hit = knowledgeBases.value.some((item) => item.id === knowledgeBaseId.value)
    if (!hit && knowledgeBases.value.length) {
      knowledgeBaseId.value = knowledgeBases.value[0].id
    }
  } catch {
    // 列表接口依赖研究模块令牌，失败时保留「手输 ID」这条退路
    kbLoadFailed.value = true
    if (!silent) ElMessage.warning('知识库列表加载失败，可直接在下拉框里输入知识库 ID')
  } finally {
    kbLoading.value = false
  }
}

// 每次点开下拉框都重拉一次（接口自带 5 秒缓存，连续点开不会真的重复请求）
const onKnowledgeBaseToggle = (visible) => {
  if (visible) loadKnowledgeBases({ silent: true })
}

const currentKnowledgeBase = computed(
  () => knowledgeBases.value.find((item) => item.id === knowledgeBaseId.value) || null,
)

const knowledgeBaseTip = computed(() => {
  if (selectionScope.value) {
    return '基于 AI 入口交接的文献范围生成，可继续提问或选择写作阶段'
  }
  const base = currentKnowledgeBase.value
  if (base) {
    return `已选「${base.name}」共 ${base.corpus_count} 篇文献；仅「审核通过 + 已向量化」的文献可被引用`
  }
  if (knowledgeBaseId.value) {
    return `已指定知识库 ID ${knowledgeBaseId.value}（不在当前列表中，请确认是否正确）`
  }
  if (kbLoadFailed.value) {
    return '知识库列表加载失败：请直接输入知识库 ID，或重新点开下拉框重试'
  }
  return '请先选择知识库：理论依据 / 文献推荐 / 概念解释都基于其中的真实文献'
})

const onKnowledgeBaseChange = (value) => {
  // allow-create 会把手输内容变成字符串，这里统一收敛成数字 ID
  const num = Number(value)
  if (Number.isFinite(num) && num > 0 && num !== value) {
    knowledgeBaseId.value = num
  }
  const base = currentKnowledgeBase.value
  if (base) ElMessage.success(`已切换到「${base.name}」`)
}

// 左侧编辑区折叠：把宽度让给右侧对话（状态记住，刷新后保持）
const EDITOR_COLLAPSED_KEY = 'quillEditorCollapsed'
const editorCollapsed = ref(localStorage.getItem(EDITOR_COLLAPSED_KEY) === '1')

const toggleEditorPane = (collapsed) => {
  editorCollapsed.value =
    typeof collapsed === 'boolean' ? collapsed : !editorCollapsed.value
  try {
    localStorage.setItem(EDITOR_COLLAPSED_KEY, editorCollapsed.value ? '1' : '0')
  } catch {
    // 配额或隐私模式写入失败时忽略，不影响折叠本身
  }
  if (!editorCollapsed.value) {
    // 重新显示后让 ProseMirror 重新测量（折叠期间容器宽度为 0）
    nextTick(() => {
      const instance = editor.value
      if (!instance) return
      instance.view.requestMeasure?.()
      updateWordCount()
      refreshOutline()
    })
  }
}

// ---------- 编辑器（Tiptap / ProseMirror） ----------
const EDITOR_DRAFT_KEY = 'quillEditorDraft'
const FONT_FAMILIES = ['微软雅黑', '宋体', '黑体', '楷体', '仿宋', 'Times New Roman', 'Arial']
const FONT_SIZES = [12, 14, 16, 18, 20, 24]
const LINE_HEIGHTS = ['1.5', '1.75', '1.9', '2.25', '2.6']
const fontFamily = ref('微软雅黑')
const fontSize = ref(16)
const blockFormat = ref('p')
const lineHeight = ref('1.9')
let saveTimer = null

// 字体/字号挂在 textStyle 上，行距挂在段落节点上——导出 Word 时能还原真实值，
// 不再像 execCommand 的 fontSize 档位那样丢失精度
const Typography = Extension.create({
  name: 'typography',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => (element.style.fontFamily || '').replace(/["']/g, '') || null,
            renderHTML: (attributes) =>
              attributes.fontFamily ? { style: `font-family:${attributes.fontFamily}` } : {},
          },
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size:${attributes.fontSize}` } : {},
          },
        },
      },
      {
        types: ['paragraph', 'heading', 'listItem'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height:${attributes.lineHeight}` } : {},
          },
        },
      },
    ]
  },
})

// 旧草稿是 execCommand 生成的脏 HTML：只保留白名单标签与字体/字号/颜色三项样式。
// 具体清洗逻辑在 @/utils/quillEditor，便于脱离页面单独验证。
const rawDraftHtml = localStorage.getItem(EDITOR_DRAFT_KEY)
const initialDraftHtml = sanitizeDraftHtml(rawDraftHtml)
// 迁移前留存一份原始草稿（只在第一次迁移时写），万一清洗效果不理想可人工找回
try {
  if (rawDraftHtml && !localStorage.getItem(`${EDITOR_DRAFT_KEY}.legacyBackup`)) {
    localStorage.setItem(`${EDITOR_DRAFT_KEY}.legacyBackup`, rawDraftHtml)
  }
} catch {
  // 配额不足时忽略，不影响打开编辑器
}

// 编辑器回调经中转，避免 useEditor 初始化阶段引用尚未定义的处理函数
const editorHooks = { update: null, selection: null }

// 已选内容的高亮装饰：点顶部菜单会让编辑器失焦，浏览器就不再绘制原生选区，
// 这里用 ProseMirror 装饰把「记住的选区」继续画出来，用户点菜单时仍能看到框住的内容。
const savedSelectionKey = new PluginKey('savedSelectionHighlight')
const savedSelectionPlugin = new Plugin({
  key: savedSelectionKey,
  state: {
    init: () => DecorationSet.empty,
    apply(tr, previous, _oldState, newState) {
      const meta = tr.getMeta(savedSelectionKey)
      if (meta && typeof meta.from === 'number' && meta.to > meta.from) {
        return DecorationSet.create(newState.doc, [
          Decoration.inline(meta.from, meta.to, { class: 'pm-saved-selection' }),
        ])
      }
      if (meta === 'clear') return DecorationSet.empty
      // 文档变动时映射旧装饰，避免位置漂移
      return previous.map(tr.mapping, tr.doc)
    },
  },
  props: {
    decorations(state) {
      return savedSelectionKey.getState(state)
    },
  },
})

const SavedSelectionHighlight = Extension.create({
  name: 'savedSelectionHighlight',
  addProseMirrorPlugins() {
    return [savedSelectionPlugin]
  },
})

// 引用标记：把 [n] 渲染成可点击的上标，点击按 data-run + data-cite 打开原文
const Citation = Mark.create({
  name: 'citation',
  inclusive: false,
  addAttributes() {
    return {
      runId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-run'),
        renderHTML: (attributes) => (attributes.runId ? { 'data-run': attributes.runId } : {}),
      },
      indexes: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-cite'),
        renderHTML: (attributes) =>
          attributes.indexes ? { 'data-cite': attributes.indexes } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'sup[data-cite]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { class: 'cite-mark' }), 0]
  },
})

const editor = useEditor({
  content: initialDraftHtml,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      history: { depth: 200 },
      // 学术写作不需要代码块/代码/分隔线/光标辅助，关掉可减小分包体积
      codeBlock: false,
      code: false,
      horizontalRule: false,
      dropcursor: false,
      gapcursor: false,
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Superscript,
    Subscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    SavedSelectionHighlight,
    Citation,
  ],
  editorProps: {
    // 不要再覆盖 class：一旦覆盖会顶掉 Tiptap 默认的 tiptap/ProseMirror 类，
    // 排版规则和焦点样式都会失效（表现为编辑区出现浏览器默认的黑色焦点框）
    attributes: { spellcheck: 'false' },
    // 粘贴清洗：默认只取纯文本，避免 Word/网页的字体与行距污染整篇；
    // 需要保留原格式时按住 Alt 再粘贴
    handlePaste: (view, event) => {
      if (event.altKey) return false
      const text = event.clipboardData?.getData('text/plain') || ''
      if (!text.trim()) return false
      const paragraphs = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }))
      editor.value?.chain().focus().insertContent(paragraphs).run()
      return true
    },
    // 点击正文里的上标引用 → 打开原文（沿用右侧 [n] 的那套证据弹窗）
    // 注意：这里不在 editorProps.handleClick 里做，改在编辑器外层统一监听，
    // 避免 ProseMirror 的点击处理/焦点逻辑把这个点击吃掉
  },
  onUpdate: () => editorHooks.update?.(),
  onSelectionUpdate: () => editorHooks.selection?.(),
})

const chain = () => editor.value?.chain().focus()

const execCmd = (cmd) => {
  if (!editor.value) return
  const actions = {
    undo: () => editor.value.chain().focus().undo().run(),
    redo: () => editor.value.chain().focus().redo().run(),
    bold: () => editor.value.chain().focus().toggleBold().run(),
    italic: () => editor.value.chain().focus().toggleItalic().run(),
    underline: () => editor.value.chain().focus().toggleUnderline().run(),
    strikeThrough: () => editor.value.chain().focus().toggleStrike().run(),
    superscript: () => editor.value.chain().focus().toggleSuperscript().run(),
    subscript: () => editor.value.chain().focus().toggleSubscript().run(),
    insertUnorderedList: () => editor.value.chain().focus().toggleBulletList().run(),
    insertOrderedList: () => editor.value.chain().focus().toggleOrderedList().run(),
    justifyLeft: () => editor.value.chain().focus().setTextAlign('left').run(),
    justifyCenter: () => editor.value.chain().focus().setTextAlign('center').run(),
    justifyRight: () => editor.value.chain().focus().setTextAlign('right').run(),
    removeFormat: () => editor.value.chain().focus().unsetAllMarks().clearNodes().run(),
  }
  actions[cmd]?.()
}

const onFontFamily = () => chain()?.setMark('textStyle', { fontFamily: fontFamily.value }).run()
const onFontSize = () => chain()?.setMark('textStyle', { fontSize: `${fontSize.value}px` }).run()
const onForeColor = (event) => chain()?.setColor(event.target.value).run()
const onHilite = (event) => chain()?.toggleHighlight({ color: event.target.value }).run()

const onBlockFormat = () => {
  const instance = editor.value
  if (!instance) return
  if (blockFormat.value === 'p') {
    instance.chain().focus().setParagraph().run()
    return
  }
  instance
    .chain()
    .focus()
    .toggleHeading({ level: Number(blockFormat.value.slice(1)) })
    .run()
}

const onLineHeight = () => {
  const instance = editor.value
  if (!instance) return
  instance
    .chain()
    .focus()
    .updateAttributes('paragraph', { lineHeight: lineHeight.value })
    .updateAttributes('heading', { lineHeight: lineHeight.value })
    .run()
}

const clearEditor = () => {
  ElMessageBox.confirm('确定清空编辑器全部内容？', '清空', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      snapshotVersion('清空前')
      editor.value?.chain().clearContent(true).run()
      onEditorInput()
    })
    .catch(() => {})
}

// 字数统计（不含空白）
const wordCount = ref(0)
const updateWordCount = () => {
  wordCount.value = (editor.value?.getText() || '').replace(/\s/g, '').length
}

// 光标处的格式回填到工具栏，避免"选了宋体但光标在标题里"这类错位
const syncToolbarState = () => {
  const instance = editor.value
  if (!instance) return
  const attrs = instance.getAttributes('textStyle') || {}
  if (attrs.fontFamily) fontFamily.value = attrs.fontFamily
  const px = Number(String(attrs.fontSize || '').replace('px', ''))
  if (FONT_SIZES.includes(px)) fontSize.value = px
  const headingLevel = [1, 2, 3].find((level) => instance.isActive('heading', { level }))
  blockFormat.value = headingLevel ? `h${headingLevel}` : 'p'
}

// 编辑内容防抖自动保存到本地；刷新后恢复
const onEditorInput = () => {
  updateWordCount()
  syncToolbarState()
  refreshOutline()
  editorTip.value = '正在保存…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(EDITOR_DRAFT_KEY, editor.value?.getHTML() || '')
      editorTip.value = '自动保存成功'
      maybeAutoSnapshot()
    } catch {
      editorTip.value = '自动保存失败'
    }
  }, 800)
}

/* ---------------- P1：大纲导航 ---------------- */
const outlineItems = ref([])
const outlineVisible = ref(false)

const refreshOutline = () => {
  const instance = editor.value
  if (!instance) return
  const items = []
  instance.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      items.push({
        level: node.attrs.level || 1,
        text: (node.textContent || '').trim() || '（无标题）',
        pos,
      })
      return false
    }
    return true
  })
  outlineItems.value = items
}

const jumpToHeading = (item) => {
  const instance = editor.value
  if (!instance) return
  instance.chain().focus().setTextSelection(item.pos + 1).scrollIntoView().run()
}

/* ---------------- P1：段落上移 / 下移 ---------------- */
const moveBlock = (direction) => {
  const instance = editor.value
  if (!instance) return
  const { state } = instance
  const { $from, empty } = state.selection
  if (!empty) {
    ElMessage.warning('请先把光标放在要移动的段落里（不要选中文字）')
    return
  }
  if ($from.depth < 1) return
  const blockPos = $from.before(1)
  const blockEnd = $from.after(1)
  const node = state.doc.nodeAt(blockPos)
  const index = $from.index(0)
  const sibling = direction < 0 ? state.doc.child(index - 1) : state.doc.child(index + 1)
  if (!node || !sibling) {
    ElMessage.info(direction < 0 ? '已经是第一段' : '已经是最后一段')
    return
  }
  const tr = state.tr
  if (direction < 0) {
    const target = blockPos - sibling.nodeSize
    tr.delete(blockPos, blockEnd)
    tr.insert(target, node)
    tr.setSelection(TextSelection.near(tr.doc.resolve(target + 1)))
  } else {
    const target = blockEnd + sibling.nodeSize
    tr.delete(blockPos, blockEnd)
    tr.insert(target - node.nodeSize, node)
    tr.setSelection(TextSelection.near(tr.doc.resolve(target - node.nodeSize + 1)))
  }
  instance.view.dispatch(tr)
  instance.commands.focus()
}

/* ---------------- P1：历史版本 ---------------- */
const VERSION_KEY = 'quillEditorVersions'
const VERSION_LIMIT = 20
const VERSION_MAX_BYTES = 1.5 * 1024 * 1024
const versions = ref([])
const versionVisible = ref(false)
let lastSnapshotAt = 0

const loadVersions = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(VERSION_KEY) || '[]')
    versions.value = Array.isArray(parsed) ? parsed : []
  } catch {
    versions.value = []
  }
}

const persistVersions = () => {
  const list = versions.value.slice(0, VERSION_LIMIT)
  // 超出配额时逐条丢弃最旧版本，避免整份历史都存不进去
  for (let keep = list.length; keep >= 1; keep -= 1) {
    try {
      localStorage.setItem(VERSION_KEY, JSON.stringify(list.slice(0, keep)))
      versions.value = list.slice(0, keep)
      return
    } catch {
      // 继续尝试更小的历史窗口
    }
  }
}

const snapshotVersion = (label) => {
  const instance = editor.value
  if (!instance) return
  const html = instance.getHTML()
  if (!html || html === '<p></p>') return
  const text = instance.getText() || ''
  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    label: label || '自动备份',
    words: text.replace(/\s/g, '').length,
    html: html.slice(0, VERSION_MAX_BYTES),
  }
  // 去重与限量由 pushVersion 统一处理（已有单测覆盖）
  const next = pushVersion(versions.value, entry, VERSION_LIMIT)
  if (next === versions.value) return
  versions.value = next
  persistVersions()
}

const maybeAutoSnapshot = () => {
  if (Date.now() - lastSnapshotAt < 30000) return
  lastSnapshotAt = Date.now()
  snapshotVersion('自动备份')
}

const restoreVersion = (item) => {
  const instance = editor.value
  if (!instance) return
  snapshotVersion('恢复前快照')
  instance.chain().setContent(item.html, true).run()
  onEditorInput()
  versionVisible.value = false
  ElMessage.success('已恢复到该版本（可再用 Ctrl+Z 撤回）')
}

const removeVersion = (id) => {
  versions.value = versions.value.filter((item) => item.id !== id)
  persistVersions()
}

const versionTime = (at) => {
  const date = new Date(at)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* ---------------- P1：查找替换 ---------------- */
const findVisible = ref(false)
const findText = ref('')
const replaceText = ref('')
const matchCount = ref(0)
const matchIndex = ref(0)

const findMatches = () => {
  const instance = editor.value
  const keyword = findText.value.trim()
  if (!instance || !keyword) return []
  const matches = []
  const needle = keyword.toLowerCase()
  instance.state.doc.descendants((node, pos) => {
    if (!node.isText) return true
    const haystack = (node.text || '').toLowerCase()
    let index = haystack.indexOf(needle)
    while (index !== -1) {
      matches.push({ from: pos + index, to: pos + index + keyword.length })
      index = haystack.indexOf(needle, index + needle.length)
    }
    return true
  })
  return matches
}

const refreshMatchCount = () => {
  const matches = findMatches()
  matchCount.value = matches.length
  if (!matches.length) matchIndex.value = 0
  return matches
}

const jumpToNextMatch = (step = 1) => {
  const instance = editor.value
  const matches = refreshMatchCount()
  if (!instance || !matches.length) {
    if (findText.value.trim()) ElMessage.info('没有找到匹配内容')
    return
  }
  const currentFrom = instance.state.selection.from
  let startIndex = matches.findIndex((item) => item.from >= currentFrom)
  if (startIndex === -1) startIndex = 0
  const targetIndex = (startIndex + (step > 0 ? 0 : -1) + matches.length) % matches.length
  const target = matches[targetIndex]
  matchIndex.value = targetIndex + 1
  instance.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run()
}

const replaceCurrentMatch = () => {
  const instance = editor.value
  if (!instance) return
  const { from, to, empty } = instance.state.selection
  if (empty) {
    jumpToNextMatch(1)
    return
  }
  instance.chain().focus().insertContentAt({ from, to }, replaceText.value).run()
  refreshMatchCount()
  jumpToNextMatch(1)
}

const replaceAllMatches = () => {
  const instance = editor.value
  if (!instance) return
  const matches = refreshMatchCount()
  if (!matches.length) {
    ElMessage.info('没有找到匹配内容')
    return
  }
  const tr = instance.state.tr
  // 从后往前替换，避免位置偏移
  matches
    .slice()
    .reverse()
    .forEach((item) => tr.insertText(replaceText.value, item.from, item.to))
  instance.view.dispatch(tr)
  ElMessage.success(`已替换 ${matches.length} 处`)
  refreshMatchCount()
}

/* ---------------- P1：插入引用 + 参考文献 ---------------- */
const appendReference = (reference) => {
  const instance = editor.value
  if (!instance) return
  const doc = instance.state.doc
  if ((doc.textContent || '').includes(reference)) return
  let headingPos = -1
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && /参考文献/.test(node.textContent || '')) {
      headingPos = pos
      return false
    }
    return true
  })
  const paragraph = { type: 'paragraph', content: [{ type: 'text', text: reference }] }
  if (headingPos === -1) {
    instance
      .chain()
      .focus()
      .insertContentAt(doc.content.size, [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '参考文献' }] },
        paragraph,
      ])
      .run()
    return
  }
  // 已有「参考文献」标题：插到该节最后一个块之后
  let insertPos = doc.content.size
  let offset = 0
  doc.forEach((node) => {
    if (offset > headingPos) insertPos = Math.min(insertPos, offset)
    offset += node.nodeSize
  })
  instance.chain().focus().insertContentAt(insertPos, paragraph).run()
}

// 读取正文里已有的参考文献条目与已占用的编号，用于去重与续号
const readReferenceInfo = () => {
  const instance = editor.value
  const entries = []
  const used = new Set()
  if (!instance) return { entries, used }
  let inRefs = false
  instance.state.doc.forEach((node) => {
    const text = (node.textContent || '').trim()
    if (node.type.name === 'heading' && /参考文献/.test(text)) {
      inRefs = true
      return
    }
    if (inRefs) {
      const match = text.match(/^\[(\d+)\]\s*(.+)$/)
      if (match) entries.push({ index: Number(match[1]), text: match[2] })
      return
    }
    // 正文里的 [n] / [n,m] 也算占用编号，避免新条目撞号
    Array.from(text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)).forEach((hit) => {
      hit[1]
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item))
        .forEach((item) => used.add(item))
    })
  })
  entries.forEach((entry) => used.add(entry.index))
  return { entries, used }
}

const normalizeReferenceText = (text) =>
  String(text || '')
    .replace(/[\s\p{P}]/gu, '')
    .toLowerCase()

// 同一篇文献判重：标题互相包含即可（题名通常足够长）
const isSameReference = (entryText, title) => {
  const left = normalizeReferenceText(entryText)
  const right = normalizeReferenceText(title)
  if (!left || !right || right.length < 6) return false
  return left.includes(right) || right.includes(left)
}

/**
 * 确保文末参考文献里有这一篇，返回最终使用的编号。
 * @returns {{item: object, index: number, existed: boolean} | null}
 */
const ensureReferenceEntry = (runId, index) => {
  const item = (citationCache.get(runId) || {})[index]
  if (!item) return null
  const title = item.title_cn || item.title_en || ''
  const { entries, used } = readReferenceInfo()
  const existing = title ? entries.find((entry) => isSameReference(entry.text, title)) : null
  if (existing) return { item, index: existing.index, existed: true }
  const nextIndex = used.size ? Math.max(...used) + 1 : 1
  appendReference(buildReference(item, nextIndex))
  return { item, index: nextIndex, existed: false }
}

// 只在文末补参考文献，不动正文（正文里已经有 [n] 时用这个）
const generateReferenceOnly = (runId, index) => {
  const result = ensureReferenceEntry(runId, index)
  if (!result) {
    ElMessage.warning('引用信息缺失，请重新点击正文里的 [n]')
    return
  }
  citeDialog.value = { visible: false, item: null, contextText: '' }
  if (result.existed) {
    ElMessage.info(`该文献已在参考文献中（[${result.index}]），无需重复添加`)
    return
  }
  ElMessage.success(`已在文末生成参考文献 [${result.index}]`)
}

// 生成参考文献，并在光标处插入 [n] 标记（正文还没引用时才需要）
const insertCitation = (runId, index) => {
  const instance = editor.value
  if (!instance) return
  const result = ensureReferenceEntry(runId, index)
  if (!result) {
    ElMessage.warning('引用信息缺失，请重新点击正文里的 [n]')
    return
  }
  snapshotVersion('插入引用前')
  instance
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      // 显示的是参考文献编号，来源按证据序号（index）记，点击时才对得上原文
      text: `[${result.index}]`,
      marks: [{ type: 'citation', attrs: { runId, indexes: String(index) } }],
    })
    .run()
  citeDialog.value = { visible: false, item: null, contextText: '' }
  if (result.existed) {
    ElMessage.info(`该文献已在参考文献中（[${result.index}]），已插入引用标记`)
    return
  }
  ElMessage.success(`已插入 [${result.index}]，并在文末生成参考文献`)
}

const messages = ref([])
const conversationId = ref(null)
let selectionRange = null
let pollTimer = null

onMounted(async () => {
  // 1. 草稿在 useEditor 的 content 里已按白名单清洗后载入；初始化编辑器和输入事件。
  if (initialDraftHtml && initialDraftHtml !== '<p></p>') {
    editorTip.value = '已恢复上次编辑内容'
  }
  loadVersions()
  updateWordCount()
  refreshOutline()  // 知识库改为下拉选择：进页面就把可用的库拉回来（接口带缓存，重复进入很快）
  loadKnowledgeBases()
  // 回车发送：直接挂在原生 textarea 上，避免经过组件时被输入法组合事件吞掉
  composerTextarea.value = composerRef.value?.$el?.querySelector('textarea') || null
  composerTextarea.value?.addEventListener('keydown', onComposerKeydown)
  // 划词工具条的取词/收尾判定
  document.addEventListener('mousedown', onDocumentMouseDown)
  document.addEventListener('mouseup', onDocumentMouseUp)
  document.addEventListener('selectionchange', onNativeSelectionChange)
  // 兜底：即使 mouseup 被别的元素吞掉，pointerup 也会在捕获阶段到达
  window.addEventListener('pointerup', onDocumentMouseUp, true)
  window.addEventListener('pointercancel', onDocumentMouseUp, true)
  // 首次使用自动弹出使用指南
  if (!localStorage.getItem('quillGuideSeen')) {
    guideVisible.value = true
    localStorage.setItem('quillGuideSeen', '1')
  }
  // 引用编号点击：从所属消息取 runId，打开原文 PDF 对应页
  if (chatRef.value) {
    chatRef.value.addEventListener('click', (event) => {
      const anchor = event.target.closest('a.cite')
      if (!anchor) return
      event.preventDefault()
      const msgEl = anchor.closest('.msg')
      const runId = msgEl && msgEl.dataset.runId
      if (!runId) {
        ElMessage.info('该结果未关联运行，无法跳转原文')
        return
      }
      openCitation(runId, Number(anchor.dataset.cite), anchor.closest('p, li, td')?.textContent || '')
    })
  }
  // 2. AI 交接优先恢复来源和固定选文，避免混入上次知识库、消息或未完成任务。
  if (route.query.source_run) {
    try {
      const { data } = await researchHttp.get(`/agent-runs/${route.query.source_run}`, { params: { entry_source: 'AI' } })
      const candidates = data.data.result_payload?.payload?.documents || []
      const ids = String(route.query.ids || '').split(',').filter(Boolean).map(Number)
      if (ids.length > 20 || new Set(ids).size !== ids.length || ids.some((id) => !candidates.some((item) => item.corpus_id === id))) throw new Error('交接材料无效，请返回 AI 问答重新选择')
      handoffReady.value = true
      selectionScope.value = true
      selectedCorpusIds.value = ids
      knowledgeBaseId.value = null
      conversationId.value = null
      draftInput.value = data.data.query
      editorTip.value = ids.length ? `已接收 ${ids.length} 篇参考文献` : '已接收写作需求，使用全库检索'
      return
    } catch (err) { ElMessage.error(err.message || '无法恢复写作需求'); return }
  }
  // 3. 普通入口先还原本地消息，再用服务端历史补齐，最后恢复未完成任务。
  const savedConversation = localStorage.getItem('quillConversationId')
  if (savedConversation) {
    conversationId.value = savedConversation
    const stored = loadChat(CHAT_STORE_PREFIX + savedConversation)
    if (stored.length) messages.value = stored
    await restoreHistory(savedConversation)
  } else {
    const stored = loadChat(CHAT_STORE_PREFIX + 'draft')
    if (stored.length) messages.value = stored
  }
  // 恢复上次没发出去的输入内容
  try {
    const savedInput = localStorage.getItem(DRAFT_INPUT_KEY)
    if (savedInput) draftInput.value = savedInput
  } catch {
    // 忽略
  }
  // 切页/刷新回来：上次未完成的生成继续轮询并渲染，避免「回复不见了」
  await resumeActiveRun()
  backfillMessageOps()
})
onBeforeUnmount(() => {
  composerTextarea.value?.removeEventListener('keydown', onComposerKeydown)
  document.removeEventListener('mousedown', onDocumentMouseDown)
  document.removeEventListener('mouseup', onDocumentMouseUp)
  document.removeEventListener('selectionchange', onNativeSelectionChange)
  window.removeEventListener('pointerup', onDocumentMouseUp, true)
  window.removeEventListener('pointercancel', onDocumentMouseUp, true)
  if (pollTimer) clearInterval(pollTimer)
  clearTimeout(chatSaveTimer)
  clearTimeout(saveTimer)
  saveChatNow()
  // 卸载前把编辑器内容落本地，并销毁 ProseMirror 实例避免监听泄漏
  try {
    localStorage.setItem(EDITOR_DRAFT_KEY, editor.value?.getHTML() || '')
  } catch {
    // 忽略
  }
  editor.value?.destroy()
})

// ---------- 选区状态（AI 创作走顶部菜单，不再有浮动工具条） ----------
const hasSelection = ref(false)
const selectionWords = ref(0)

// 记住的选区以装饰形式画出来（失焦也可见）
let lastPaintedSelection = ''
const paintSelection = (range) => {
  const instance = editor.value
  if (!instance) return
  // 输入法拼写过程中派发事务会打断中文输入，直接跳过
  if (instance.view.composing) return
  const key = range ? `${range.from}-${range.to}` : 'clear'
  if (key === lastPaintedSelection) return
  lastPaintedSelection = key
  const tr = instance.state.tr.setMeta(savedSelectionKey, range || 'clear')
  instance.view.dispatch(tr.setMeta('addToHistory', false))
}

/* ---------------- 划词浮动工具条（与顶部「AI 创作」并存） ---------------- */
const floatingBar = ref({ visible: false, top: 0, left: 0 })
const selToolbarRef = ref(null)
// 鼠标拖动取词过程中不弹条，否则会挡住正在框选的内容
let pointerSelecting = false

const hideFloatingBar = () => {
  if (floatingBar.value.visible) floatingBar.value = { ...floatingBar.value, visible: false }
}

// 极端情况下算不出位置也要把条显示出来（宁可位置不完美，也不要"什么都没有"）
const placeFloatingBarFallback = () => {
  const wrapRect = editorWrapRef.value?.getBoundingClientRect()
  const width = selToolbarRef.value?.offsetWidth || 340
  const top = Math.max(8, (wrapRect?.top || 80) + 8)
  const left = Math.max(8, (wrapRect?.right || window.innerWidth) - width - 24)
  floatingBar.value = { visible: true, top, left }
}

// 用原生选区矩形 + fixed 定位：不受 .editor-wrap 的 overflow/滚动影响
const positionFloatingBar = () => {
  const instance = editor.value
  const bar = selToolbarRef.value
  if (!instance || !bar) return
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    hideFloatingBar()
    return
  }
  const range = selection.getRangeAt(0)
  if (!instance.view.dom.contains(range.commonAncestorContainer)) {
    hideFloatingBar()
    return
  }
  const rect = range.getBoundingClientRect()
  if (!rect || (!rect.width && !rect.height)) {
    placeFloatingBarFallback()
    return
  }
  const width = bar.offsetWidth || 340
  const height = bar.offsetHeight || 38
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - width / 2),
    Math.max(8, window.innerWidth - width - 8),
  )
  // 默认贴在选区上方，顶端空间不足时落到选区下方
  let top = rect.top - height - 8
  if (top < 8) top = Math.min(Math.max(8, window.innerHeight - height - 8), rect.bottom + 8)
  floatingBar.value = { visible: true, top, left }
}

const showFloatingBar = async () => {
  if (!selectionRange || pointerSelecting) {
    hideFloatingBar()
    return
  }
  // 先渲染出来才量得到宽高：放到视口外再定位
  if (!floatingBar.value.visible) {
    floatingBar.value = { visible: true, top: -9999, left: -9999 }
  }
  await nextTick()
  positionFloatingBar()
}

// 浏览器原生选区变化（含鼠标松开、双击选词、键盘 Shift+方向）
const onNativeSelectionChange = () => {
  if (pointerSelecting) return
  requestAnimationFrame(() => {
    if (selectionRange) showFloatingBar()
  })
}

// 在编辑区内按下鼠标 → 进入拖动取词状态（松手前不弹条）；点别处 → 收起
const onDocumentMouseDown = (event) => {
  if (event.target?.closest?.('.sel-toolbar')) return
  const editorDom = editor.value?.view.dom
  if (editorDom && editorDom.contains(event.target)) {
    pointerSelecting = true
    hideFloatingBar()
    return
  }
  hideFloatingBar()
}

const onDocumentMouseUp = () => {
  if (!pointerSelecting) return
  pointerSelecting = false
  // 等浏览器把选区落定后再定位
  setTimeout(() => {
    onSelectionChange()
    if (selectionRange) showFloatingBar()
  }, 0)
}

// 工具条上的动作：先收起条再执行，避免遮挡结果
const runBarAction = (action) => {
  hideFloatingBar()
  action()
}

const onSelectionChange = () => {
  const instance = editor.value
  if (!instance) return
  const { from, to, empty } = instance.state.selection
  const text = empty ? '' : instance.state.doc.textBetween(from, to, '\n')
  if (empty || from === to || !text.trim()) {
    // 没有有效选区：清掉目标，顶部「AI 创作」按钮置灰
    selectionRange = null
    hasSelection.value = false
    selectionWords.value = 0
    paintSelection(null)
    hideFloatingBar()
    editorTip.value = '选中文字后用上方「AI 创作」'
    return
  }
  selectionRange = { from, to }
  hasSelection.value = true
  selectionWords.value = text.replace(/\s/g, '').length
  paintSelection({ from, to })
  editorTip.value = '已选内容，可用上方「AI 创作」或浮动工具条'
  if (pointerSelecting) {
    hideFloatingBar()
    return
  }
  showFloatingBar()
}

// 选区与更新回调此时才注册，避免编辑器初始化阶段引用未定义函数
editorHooks.update = onEditorInput
editorHooks.selection = onSelectionChange

// 顶部「AI 创作」菜单的分发
const onAiCommand = (command) => {
  if (!hasSelection.value && command !== 'copy') {
    ElMessage.warning('请先在正文里选中一段文字')
    return
  }
  if (running.value) {
    ElMessage.warning('有任务进行中，请稍候')
    return
  }
  if (command === 'copy') {
    copySelection()
    return
  }
  if (command === 'revise') {
    onReviseClick()
    return
  }
  const [kind, code] = String(command).split(':')
  if (kind === 'theory') {
    runTheory(code)
    return
  }
  const action = polishActions.find((item) => item.code === code)
  if (action) runPolish(action)
  // 菜单点击会让编辑器失焦：把焦点还回去，选区高亮保持可见，
  // 结果回来后可以直接「替换选区」
  editor.value?.view.focus()
}

const selectionText = () => {
  const instance = editor.value
  if (!instance || !selectionRange) return ''
  return instance.state.doc.textBetween(selectionRange.from, selectionRange.to, '\n')
}

const editorContext = () => {
  const instance = editor.value
  if (!instance || !selectionRange) return { before: '', after: '' }
  const total = instance.state.doc.content.size
  return {
    before: instance.state.doc.textBetween(
      Math.max(0, selectionRange.from - 300),
      selectionRange.from,
      '\n',
    ),
    after: instance.state.doc.textBetween(
      selectionRange.to,
      Math.min(total, selectionRange.to + 300),
      '\n',
    ),
  }
}

const copySelection = () => {
  const text = selectionText()
  if (!text) return
  copyText(text, '选区已复制')
}

// HTTP 部署下 navigator.clipboard 不存在，退化为 execCommand
const copyText = async (text, successMessage = '已复制') => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const helper = document.createElement('textarea')
      helper.value = text
      helper.style.position = 'fixed'
      helper.style.opacity = '0'
      document.body.appendChild(helper)
      helper.select()
      document.execCommand('copy')
      helper.remove()
    }
    ElMessage.success(successMessage)
  } catch {
    ElMessage.error('复制失败')
  }
}

const replaceSelection = (newText, runId = null) => {
  const instance = editor.value
  if (!instance || !selectionRange) {
    ElMessage.warning('原选区已失效，结果请从对话中复制')
    return
  }
  // 空行分段、单换行合并成软换行，避免一句话被切成好几段
  const content = textToNodes(newText, { runId })
  // 用编辑器事务替换选区：进入 ProseMirror 的 undo 栈，Ctrl+Z 可整体撤回
  snapshotVersion('AI 替换前')
  instance.chain().focus().insertContentAt(selectionRange, content).run()
  selectionRange = null
  hasSelection.value = false
  selectionWords.value = 0
  paintSelection(null)
  ElMessage.success('已应用到编辑器（Ctrl+Z 可撤回）')
}

/**
 * 把 AI 结果插入正文。
 * @param {string} text 结果文本
 * @param {'insert'|'append'} mode insert=插到原选区末尾（无选区则光标处）；append=追加到文末
 */
const insertTextAtCursor = (text, mode = 'insert', runId = null) => {
  const instance = editor.value
  if (!instance) return
  const nodes = textToNodes(text, { runId })
  if (!nodes.length) {
    ElMessage.warning('没有可插入的内容')
    return
  }
  snapshotVersion('插入正文前')
  if (mode === 'append') {
    instance.chain().focus().insertContentAt(instance.state.doc.content.size, nodes).run()
  } else {
    const pos = selectionRange ? selectionRange.to : instance.state.selection.to
    instance.chain().focus().insertContentAt(pos, nodes).run()
  }
  selectionRange = null
  hasSelection.value = false
  selectionWords.value = 0
  paintSelection(null)
  ElMessage.success(mode === 'append' ? '已追加到正文末尾（Ctrl+Z 可撤回）' : '已插入到正文（Ctrl+Z 可撤回）')
}

// 整篇草稿写入编辑器：已有内容时由用户选择「覆盖全文 / 追加到末尾 / 取消」
const writeWholeDocument = async (input) => {
  const instance = editor.value
  if (!instance) return
  const payload = typeof input === 'string' ? { text: input } : input || {}
  // segments 让每一节绑定自己的 runId，正文里 [n] 点击才能定位到对应证据
  const nodes = Array.isArray(payload.segments) && payload.segments.length
    ? payload.segments.flatMap((segment) => textToNodes(segment.text || '', { runId: segment.runId }))
    : textToNodes(payload.text || '', { runId: payload.runId })
  if (!nodes.length) {
    ElMessage.warning('没有可写入的内容')
    return
  }
  const apply = (mode) => {
    snapshotVersion(mode === 'replace' ? '覆盖写入前' : '追加写入前')
    if (mode === 'replace') {
      instance.chain().focus().setContent({ type: 'doc', content: nodes }).run()
    } else {
      instance.chain().focus().insertContentAt(instance.state.doc.content.size, nodes).run()
    }
    selectionRange = null
    hasSelection.value = false
    selectionWords.value = 0
    paintSelection(null)
    onEditorInput()
    ElMessage.success(mode === 'replace' ? '已覆盖写入编辑器' : '已追加到文末')
  }
  if (!(instance.getText() || '').trim()) {
    apply('replace')
    return
  }
  try {
    await ElMessageBox.confirm(
      '编辑器里已经有内容，这次整篇草稿要怎么写入？',
      '写入编辑器',
      {
        confirmButtonText: '覆盖全文',
        cancelButtonText: '追加到末尾',
        distinguishCancelAndClose: true,
        type: 'warning',
      },
    )
    apply('replace')
  } catch (action) {
    // 点「取消按钮」= 追加；点右上角关闭 = 放弃写入
    if (action === 'cancel') apply('append')
  }
}

// 把大纲产物的 sections 变成标题层级（1 → H1，1.1 → H2，1.1.1 → H3）
const applyOutlineToEditor = (payload) => {
  const instance = editor.value
  const sections = (payload && payload.sections) || []
  if (!instance) return
  if (!sections.length) {
    ElMessage.warning('该大纲没有可用的小节结构')
    return
  }
  const levelOf = (sectionId) => Math.min(String(sectionId || '1').split('.').length, 3)
  const nodes = sections.map((section) => {
    const title = String(section.title || section.name || '').trim()
    const label = String(section.section_id || '').trim()
    const text = `${label} ${title}`.replace(/\s+/g, ' ').trim()
    return {
      type: 'heading',
      attrs: { level: levelOf(section.section_id) },
      content: [{ type: 'text', text: text || '未命名小节' }],
    }
  })
  snapshotVersion('套用大纲前')
  const isEmpty = (instance.state.doc.textContent || '').trim().length === 0
  if (isEmpty) {
    instance.chain().focus().setContent({ type: 'doc', content: nodes }).run()
  } else {
    instance.chain().focus().insertContentAt(instance.state.doc.content.size, nodes).run()
  }
  refreshOutline()
  outlineVisible.value = true
  ElMessage.success(`已套用 ${nodes.length} 个标题，可在「☰大纲」里查看`)
}


// ---------- 消息流 ----------
const scrollChat = () => {
  nextTick(() => {
    if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
  })
}

const addUserMsg = (content) => {
  messages.value.push({ role: 'user', content })
  scrollChat()
}

const addAiMsg = ({ html, meta, ops, runId }) => {
  const item = { role: 'ai', html, meta, ops, runId }
  messages.value.push(item)
  scrollChat()
  // 必须返回数组内的响应式代理而非原始对象：等待面板会在运行期间持续修改
  // pending.html，改原始对象绕过 Vue 响应式追踪，页面不会更新
  return messages.value[messages.value.length - 1]
}

const addPendingMsg = (label) => {
  const item = addAiMsg({ html: `<span class="pending">Quill${label}中，请稍候…</span>` })
  scrollChat()
  return item
}

/* ---------------- 消息内操作按钮：描述符 + 注册表 ---------------- */
// 按钮原来用闭包存 handler，函数无法序列化，切换页面/刷新后按钮就消失了。
// 改为只存 {code, label, payload}（纯 JSON），渲染时按 code 查表执行，
// 这样本地恢复出来的消息，按钮依然可用。
const MESSAGE_OP_HANDLERS = {
  PLAN_FROM_RQ: (payload) => runPlan(payload.topic, payload.artifact_id),
  SECTION_DRAFT: (payload) => promptSectionDraft(payload),
  DRAFT_SEQUENCE: (payload) => runDraftSequence(payload),
  EXPORT_PLAN: (payload) =>
    downloadDocx(
      { artifact_id: payload.artifact_id },
      `quill_plan_${String(payload.artifact_id).slice(0, 8)}.docx`,
    ),
  EXPORT_PAPER: () =>
    downloadDocx(
      { conversation_id: conversationId.value },
      `quill_paper_${String(conversationId.value).slice(0, 8)}.docx`,
    ),
  REPLACE_SELECTION: (payload) => replaceSelection(payload.text || '', payload.runId || null),
  COPY_TEXT: (payload) => copyText(payload.text || ''),
  // 续写/概念解释这类结果更适合"插入到光标处"，而不是覆盖原选区
  INSERT_SELECTION: (payload) =>
    insertTextAtCursor(payload.text || '', 'insert', payload.runId || null),
  // 整篇草稿/全文一键写进编辑器（已有内容时可选覆盖或追加）
  WRITE_EDITOR: (payload) => writeWholeDocument(payload),
  // 把大纲产物套用成标题层级，顺带让大纲面板有内容
  APPLY_OUTLINE: (payload) => applyOutlineToEditor(payload),
  // 停止/失败后的一键续做：带着上一轮任务上下文重新提问
  RESUME_TASK: () => {    if (running.value) {
      ElMessage.warning('有任务进行中，请稍候')
      return
    }
    runFreeQA(expandContinuation('继续刚刚的任务'))
  },
  // 停止后的「结束任务」：后端运行已是 CANCELLED，这里只把这条提示从对话里收起
  DISMISS_MESSAGE: (payload, message) => dismissMessage(message),
}

// 统一的失败/停止消息：停止时附「继续这个任务」与「结束任务」两个出口
const addFailureMsg = (message) => {
  const stopped = String(message || '').startsWith('⏹')
  return addAiMsg({
    html: runFailureHtml(message),
    ops: stopped
      ? [msgOp('RESUME_TASK', '继续这个任务'), msgOp('DISMISS_MESSAGE', '结束任务')]
      : [],
  })
}

// 收起这条提示：任务本身已经在点「停止」时结束（后端 CANCELLED），这里只清理对话里的残留
const dismissMessage = (message) => {
  if (!message) return
  messages.value = messages.value.filter((item) => item !== message)
}

// 历史消息缺少操作按钮时补最小集合（插入到正文 / 复制），让旧记录也能落地
const backfillMessageOps = () => {
  messages.value.forEach((msg) => {
    if (msg.role !== 'ai') return
    if (Array.isArray(msg.ops) && msg.ops.length) return
    if (typeof msg.html !== 'string' || msg.html.includes('class="pending"')) return
    const text = plainTextFromHtml(msg.html)
    // 失败/停止提示不是正文，不能插入
    if (!text || /^[❌⏹]/.test(text)) return
    msg.ops = [
      msgOp('INSERT_SELECTION', '插入到正文', { text, runId: msg.runId || null }),
      msgOp('COPY_TEXT', '复制', { text }),
    ]
  })
}

const msgOp = (code, label, payload = {}) => ({ code, label, payload })

const runMessageOp = (op, message = null) => {
  const handler = MESSAGE_OP_HANDLERS[op?.code]
  if (!handler) {
    ElMessage.warning('该按钮来自旧记录，重新生成后即可使用')
    return
  }
  // 旧消息的操作按钮可能没记 runId：用消息自身的 runId 兜底，
  // 这样插入正文后 [n] 依旧能点开对应原文（整篇写入除外：多节来自不同运行）
  const payload = { ...(op.payload || {}) }
  if (!payload.runId && message?.runId && op.code !== 'WRITE_EDITOR') {
    payload.runId = message.runId
  }
  try {
    handler(payload, message)
  } catch (error) {
    ElMessage.error('操作失败：' + (error?.message || '请稍后重试'))
  }
}

const renderMarkdown = (text, citeLinks = false) => {
  // Agent 输出为受控学术文本，marked 渲染后展示；[n] 可渲染为原文跳转链接
  const html = marked.parse(text || '', { breaks: true })
  if (!citeLinks) return html
  return html.replace(
    /\[(\d+)\]/g,
    (match, num) => `<a class="cite" data-cite="${num}" title="点击查看原文">[${num}]</a>`,
  )
}

// ---------- 可点击引用：按运行缓存证据面板，点击 [n] 打开原文页码 ----------
const citationCache = new Map()

const openCitation = async (runId, index, contextText = '') => {
  try {
    if (!citationCache.has(runId)) {
      // 证据面板接口的 envelope data 直接是数组
      const { data: resp } = await getQuillRunEvidenceService(runId)
      const map = {}
      for (const item of resp.data || []) {
        map[item.evidence_rank] = item
      }
      citationCache.set(runId, map)
    }
    const item = citationCache.get(runId)[index]
    if (!item) {
      ElMessage.warning('该编号在本次运行证据中不存在')
      return
    }
    citeDialog.value = { visible: true, item, runId, index, contextText }
  } catch {
    ElMessage.error('获取原文证据失败：该任务可能已过期，可在右侧对应回答里点击 [n] 重试')
  }
}

// 正文里的上标引用点击：在编辑器外层监听，不依赖 ProseMirror 的点击回调
const onCitationClick = (event) => {
  const sup = event.target?.closest?.('sup.cite-mark')
  if (!sup) return
  const runId = sup.getAttribute('data-run')
  const indexes = String(sup.getAttribute('data-cite') || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
  if (!runId || !indexes.length) {
    ElMessage.info('这条引用缺少来源信息（多为旧内容），请在右侧对应回答里点击 [n] 查看原文')
    return
  }
  // 带上引用所在的段落，弹窗里据此高亮摘录中最贴近的原句
  openCitation(runId, indexes[0], sup.closest('p, li, h1, h2, h3')?.textContent || '')
}

const openCitePdf = () => {
  const item = citeDialog.value.item
  if (item && item.file_url) window.open(item.file_url, '_blank')
}

// HTTP 部署（非安全上下文）下没有 crypto.randomUUID，回退到时间戳+随机数
const newRequestId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`
}

// ---------- Quill运行 ----------
// 思考节点友好名（LangGraph 稳定节点名 → 中文）
const THINK_NODE_LABELS = {
  ConceptExtraction: '概念抽取',
  QueryExpansion: '查询扩展',
  LiteratureRetrieval: '文献检索',
  EvidenceDedup: '证据去重',
  MetadataNormalization: '元数据规整',
  TheorySynthesis: '理论综合',
  AnalysisValidation: '分析校验',
  CitationValidator: '引用校验',
}

// 实时预览里的 HTML 转义（回答正文按纯文本打字机展示，避免半截 Markdown 渲染错乱）
const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 深度思考运行中：把轮询拿到的阶段进度与思维链实时渲染进等待消息，
// 让用户看到模型在做什么，而不是干等一个静态"请稍候"。
// RUNNING 步骤渲染为当前思考中节点；live（1 秒轮询的思考流式增量）存在时，
// 该节点下方实时显示思维链，随生成逐段增长。
const updatePendingProgress = (pending, tailHtml, run, elapsed = 0, live = null) => {
  const steps = (run && run.steps) || []
  const done = steps.filter((step) => step.status === 'SUCCESS')
  if (!steps.length) {
    console.warn('[辅助创作] 轮询响应里没有步骤数据', {
      status: run && run.status,
      keys: Object.keys(run || {}),
    })
    return
  }
  let blocks = ''
  try {
    blocks = steps
      .map((step) => {
        const name = THINK_NODE_LABELS[step.node_name] || step.node_name
        if (step.status === 'RUNNING') {
          if (live && live.node === step.node_name && live.thinking) {
            return (
              `<div class="think-running">⏳ ${name} · 深度思考中</div>` +
              `<div class="think-text">${renderMarkdown(live.thinking.slice(-1500))}</div>`
            )
          }
          return `<div class="think-running">⏳ ${name} · 深度思考中</div>`
        }
        if (step.status !== 'SUCCESS') return ''
        const thinking = step.output_summary && step.output_summary.thinking
        if (!thinking) return `<div class="think-node">✓ ${name}</div>`
        return (
          `<div class="think-node">✓ ${name} · 深度思考</div>` +
          `<div class="think-text">${renderMarkdown(thinking)}</div>`
        )
      })
      .join('')
  } catch (e) {
    console.error('[辅助创作] 思维链渲染异常', e)
    blocks = `<div class="think-node">（思维链渲染出错：${e && e.message}）</div>`
  }
  pending.html =
    `<div class="thinking-box">` +
    `<div class="thinking-head">深度思考进行中 · 已等待 ${elapsed} 秒 · 已完成 ${done.length} 个阶段</div>` +
    blocks +
    (live && live.answer
      ? `<div class="think-running">✍ 回答生成中</div>` +
        `<div class="think-text answer-live">${escapeHtml(live.answer.slice(-800))}</div>`
      : '') +
    `</div>` +
    `<span class="pending">${tailHtml}</span>`
  scrollChat()
}

/** 按当前知识库或交接文献范围创建运行，并保存恢复任务所需的标识。 */
const startRun = async (query, options = {}, agentCode = 'QUILL', label = '') => {
  if (!handoffReady.value) throw new Error('写作需求尚未加载，请返回 AI 问答重新选择')
  const payload = {
    request_id: newRequestId(),
    knowledge_base_id: selectionScope.value ? null : knowledgeBaseId.value,
    conversation_id: conversationId.value,
    query: query.slice(0, 3900),
    mode: mode.value,
    thinking: deepThink.value,
    options: selectionScope.value ? { ...options, corpus_ids: selectedCorpusIds.value } : options,
  }
  const { data: resp } = await createQuillRunService(payload, agentCode)
  if (resp.code !== 'OK') throw new Error(resp.message || '创建运行失败')
  conversationId.value = resp.data.conversation_id
  // 会话 ID 持久化：刷新后可从服务端恢复写作历史
  localStorage.setItem('quillConversationId', conversationId.value)
  // 首次生成会新建会话：把此前挂在「未关联会话」下的本地记录迁移过来，避免丢失
  try {
    localStorage.removeItem(CHAT_STORE_PREFIX + 'draft')
  } catch {
    // 忽略
  }
  saveChatNow()
  // 运行 ID 持久化：切页/刷新回来后据此恢复未完成的生成（含「停止生成」入口）
  persistActiveRun({
    runId: resp.data.run_id,
    agentCode,
    label: label || '',
    conversationId: conversationId.value,
    startedAt: Date.now(),
  })
  // 记录本轮真实任务，供下一轮「继续刚刚的任务」补全上下文
  rememberLastTask(label, query)
  return resp.data.run_id
}

/* ---------------- 运行控制：停止生成 / 切页后恢复 ---------------- */
const STOPPED_MESSAGE =
  '⏹ 本次任务已停止，不会再有后续输出。可点「继续这个任务」接着做，或点「结束任务」收起这条提示，也可以直接输入新问题。'
const ACTIVE_RUN_KEY = 'quillActiveRun'
const activeRun = ref(null)

const persistActiveRun = (info) => {
  activeRun.value = info
  try {
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(info))
  } catch {
    // 本地存储不可用时仅保留内存态
  }
}

const clearActiveRun = () => {
  activeRun.value = null
  try {
    localStorage.removeItem(ACTIVE_RUN_KEY)
  } catch {
    // 忽略
  }
}

const readPersistedRun = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_RUN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// 统一渲染失败/停止提示：停止不用 ❌，避免被误解成出错
const runFailureHtml = (message) =>
  String(message || '').startsWith('⏹')
    ? message
    : '❌ ' + (message || '生成失败，请稍后重试')

// 停止当前生成：后端把运行标记为 CANCELLED 并取消协程，轮询读到终态后收尾
const onStopRun = async () => {
  const info = activeRun.value || readPersistedRun()
  if (!info?.runId) {
    ElMessage.warning('当前没有正在生成的任务')
    return
  }
  try {
    await cancelQuillRunService(info.runId)
    ElMessage.info('已发送停止请求，正在收尾…')
  } catch (error) {
    ElMessage.error('停止失败：' + (error?.message || '请稍后重试'))
  }
}

// 发送/停止共用一个按钮：运行中点击即「停止生成」，空闲时点击即发送
const onSendOrStop = () => {
  if (running.value) {
    onStopRun()
    return
  }
  onSend()
}

// 输入框 Enter 发送：
// 中文输入法组字时按 Enter 是"确认候选词"，此时 isComposing 为真、v-model 还没拿到文字，
// 必须放过，否则会变成"按了没反应"（拿到空串直接 return）。Shift/Ctrl+Enter 留给换行或其它。
const composerTextarea = ref(null)
const onComposerKeydown = (event) => {
  if (event.key !== 'Enter') return
  if (event.isComposing || event.keyCode === 229) return
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
  event.preventDefault()
  onSendOrStop()
}

/* ---------------- 左侧创作内容导出 ---------------- */
// 块 + 行内样式的解析在 @/utils/quillEditor（blocksFromJson），这里只负责取文档 JSON
const collectEditorBlocks = () => blocksFromJson(editor.value?.getJSON())

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const onExportEditor = async () => {
  const blocks = collectEditorBlocks()
  if (!blocks.length) {
    ElMessage.warning('编辑器里还没有内容，先写一段再导出')
    return
  }
  const title = editorExportTitle(blocks)
  try {
    const resp = await exportQuillDocxService({ blocks, title })
    saveBlob(resp.data, `${title}.docx`)
    ElMessage.success('已导出 Word 文档')
  } catch {
    // 后端暂不支持编辑器导出时的兜底：HTML 包成 .doc，Word 可直接打开并保留段落
    const escape = (text) =>
      String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const body = blocks
      .map((block) => {
        if (block.type === 'li') return `<p>· ${escape(block.text)}</p>`
        const tag = ['h1', 'h2', 'h3'].includes(block.type) ? block.type : 'p'
        return `<${tag}>${escape(block.text)}</${tag}>`
      })
      .join('')
    const html =
      `<html><head><meta charset="utf-8"><title>${escape(title)}</title></head><body>` +
      `<h1 style="text-align:center">${escape(title)}</h1>${body}</body></html>`
    saveBlob(new Blob([html], { type: 'application/msword;charset=utf-8' }), `${title}.doc`)
    ElMessage.warning('后端导出接口暂不可用，已导出兼容格式（.doc，可用 Word 打开）')
  }
}

const pollRun = (runId, onDone, onProgress, onLive) => {
  let elapsed = 0
  // 实时思维链：1 秒轮询后端内存缓冲（思考流式增量），仅在传入 onLive 时启用
  let liveTimer = null
  if (typeof onLive === 'function') {
    liveTimer = setInterval(async () => {
      try {
        const { data: resp } = await getQuillRunReasoningService(runId)
        if (resp?.data) {
          try {
            onLive(resp.data)
          } catch (e) {
            console.error('[辅助创作] onLive 异常', e)
          }
        }
      } catch (e) {
        // 单次轮询失败容忍
        console.warn('[辅助创作] 思维链轮询请求失败', {
          status: e && e.response && e.response.status,
          message: e && e.message,
        })
      }
    }, 1000)
  }
  const stopTimers = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (liveTimer) {
      clearInterval(liveTimer)
      liveTimer = null
    }
  }
  pollTimer = setInterval(async () => {
    elapsed += 2
    try {
      const { data: resp } = await getQuillRunService(runId)
      const run = resp.data || {}
      if (typeof onProgress === 'function') {
        try {
          onProgress(run, elapsed)
        } catch (e) {
          console.error('[辅助创作] onProgress 异常', e)
        }
      }
      if (run.status === 'SUCCESS') {
        stopTimers()
        clearActiveRun()
        onDone(run)
      } else if (run.status === 'FAILED' || run.status === 'CANCELLED') {
        stopTimers()
        clearActiveRun()
        onDone(
          null,
          run.status === 'CANCELLED'
            ? STOPPED_MESSAGE
            : run.error_message || '运行失败，请查看智能体日志',
        )
      }
    } catch (e) {
      // 单次轮询失败容忍，超时由 elapsed 控制
      console.warn('[辅助创作] 运行状态轮询请求失败', {
        status: e && e.response && e.response.status,
        message: e && e.message,
      })
    }
    if (elapsed >= 300) {
      stopTimers()
      onDone(null, '轮询超时，请稍后在历史记录中查看结果')
    }
  }, 2000)
}

const runQuill = async (label, query, options, onResult) => {
  if (running.value) return
  const selected = query && query.trim()
  if (!selected) {
    ElMessage.warning('请先选中一段文字')
    return
  }
  if (!selectionScope.value && !knowledgeBaseId.value) {
    ElMessage.warning('请先在顶部填写研究知识库 ID')
    return
  }
  running.value = true
  addUserMsg(label + '：' + selected.slice(0, 120) + (selected.length > 120 ? '…' : ''))
  const pending = addPendingMsg(label)
  try {
    const runId = await startRun(selected, options, 'QUILL', label)
    // 进度（2秒）与实时思维链（1秒）共用同一条等待消息，任一回调触发整体重渲染
    let live = null
    let lastRun = null
    let lastElapsed = 0
    const renderPending = () => {
      if (lastRun) {
        updatePendingProgress(pending, `Quill${label}中，请稍候…`, lastRun, lastElapsed, live)
      }
    }
    pollRun(
      runId,
      (run, error) => {
        running.value = false
        messages.value = messages.value.filter((item) => item !== pending)
        if (error) {
          addFailureMsg(error)
          return
        }
        onResult(run)
      },
      (run, elapsed) => {
        lastRun = run
        lastElapsed = elapsed
        renderPending()
      },
      (data) => {
        live = data
        renderPending()
      },
    )
  } catch (error) {
    running.value = false
    messages.value = messages.value.filter((item) => item !== pending)
    const detail =
      error.response?.data?.message || error.message || '网络异常，请稍后重试'
    addFailureMsg(detail)
  }
}

// ---------- 工具条动作 ----------
const runPolish = (act) => {
  const selected = selectionText()
  const ctx = editorContext()
  runQuill(ACTION_LABELS[act.code], selected,
    {
      stage: 'POLISH',
      action: act.code,
      context_before: ctx.before,
      context_after: ctx.after,
    },
    (run) => {
      const result = (run.result_payload && run.result_payload.payload) || {}
      const output = result.output_text || run.final_answer || ''
      addAiMsg({
        html: renderMarkdown(output),
        meta: `Quill · ${ACTION_LABELS[act.code]} · AI 辅助生成，请遵守所在机构学术规范`,
        runId: run.id,
        ops: [
          // 续写本来就该"往下接"，默认把「插入」放前面；其余改写类默认「替换」
          ...(act.code === 'CONTINUE'
            ? [
                msgOp('INSERT_SELECTION', '插入到光标后', { text: output, runId: run.id }),
                msgOp('REPLACE_SELECTION', '替换选区', { text: output, runId: run.id }),
              ]
            : [
                msgOp('REPLACE_SELECTION', '替换选区', { text: output, runId: run.id }),
                msgOp('INSERT_SELECTION', '插入到光标后', { text: output, runId: run.id }),
              ]),
          msgOp('COPY_TEXT', '复制', { text: output }),
        ],
      })
    },
  )
}

const runTheory = (kind) => {
  const selected = selectionText()
  const query =
    kind === 'explain'
      ? selected
      : `推荐与「${selected}」相关的理论依据与文献`
  runQuill(kind === 'explain' ? '概念解释' : '文献推荐', query,
    { stage: 'THEORY' },
    (run) => {
      const level = run.evidence_level || ''
      const output = run.final_answer || ''
      addAiMsg({
        html: renderMarkdown(output, true),
        meta: `Quill · 理论依据与文献推荐 · 证据等级 ${level} · 点击 [n] 可查看原文`,
        runId: run.id,
        ops:
          kind === 'explain'
            ? [
                msgOp('INSERT_SELECTION', '插入到光标后', { text: output, runId: run.id }),
                msgOp('COPY_TEXT', '复制', { text: output }),
              ]
            : [msgOp('COPY_TEXT', '复制', { text: output })],
      })
    },
  )
}

// ---------- 快捷标签与输入 ----------
const onQuickTag = (tag) => {
  if (tag === '写作询问') {
    // 自由问答入口：聚焦底部输入框
    ElMessage.info('请直接输入问题，将基于知识库证据作答')
    const textarea = document.querySelector('.input-row textarea')
    if (textarea) textarea.focus()
    return
  }
  if (tag === '选题推荐' || tag === '文章大纲') {
    ElMessageBox.prompt('请输入研究方向或主题', tag, {
      confirmButtonText: '生成',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '主题不能为空',
    })
      .then(({ value }) => {
        const topic = value.trim()
        if (tag === '选题推荐') runRQ(topic)
        else runPlan(topic)
      })
      .catch(() => {})
    return
  }
  if (GUIDED_PROMPTS[tag]) {
    if (!selectionScope.value && !knowledgeBaseId.value) {
      ElMessage.warning('请先在上方选择知识库')
      return
    }
    if (running.value) {
      ElMessage.warning('有任务进行中，请稍候')
      return
    }
    ElMessageBox.prompt('请输入研究主题', tag, {
      confirmButtonText: '生成',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '主题不能为空',
    })
      .then(({ value }) => {
        const topic = value.trim()
        runFreeQA(GUIDED_PROMPTS[tag](topic))
      })
      .catch(() => {})
  }
}

const runRQ = (topic) => {
  runQuill('选题推荐', topic, { stage: 'RQ' }, (run) => {
    const payload = (run.result_payload && run.result_payload.payload) || {}
    if (payload.artifact_id) lastRqArtifactId.value = payload.artifact_id
    const defaultTopic =
      (payload.research_questions &&
        payload.research_questions[0] &&
        payload.research_questions[0].question) ||
      payload.research_topic ||
      topic
    const ops = payload.artifact_id
      ? [
          msgOp('PLAN_FROM_RQ', '基于这些问题生成大纲', {
            topic: defaultTopic,
            artifact_id: payload.artifact_id,
          }),
        ]
      : []
    addAiMsg({
      html: renderMarkdown(run.final_answer || '', true),
      meta: `Quill · 研究问题生成 · 证据等级 ${run.evidence_level || ''} · 点击 [n] 可查看原文`,
      ops,
      runId: run.id,
    })
  })
}

const runPlan = (topic, artifactId = lastRqArtifactId.value) => {
  const options = { stage: 'PLAN' }
  if (artifactId) options.artifact_id = artifactId
  runQuill('文章大纲', topic, options, (run) => {
    const payload = (run.result_payload && run.result_payload.payload) || {}
    const ops = payload.artifact_id
      ? [
          msgOp('APPLY_OUTLINE', '大纲套用为标题', { sections: payload.sections || [] }),
          msgOp('SECTION_DRAFT', '逐节起草', payload),
          msgOp('DRAFT_SEQUENCE', '整篇连播起草', payload),
          msgOp('EXPORT_PLAN', '导出大纲 Word', { artifact_id: payload.artifact_id }),
        ]
      : []
    addAiMsg({
      html: renderMarkdown(run.final_answer || '', true),
      meta: `Quill · 写作方案 · 证据等级 ${run.evidence_level || ''} · 点击 [n] 可查看原文`,
      ops,
      runId: run.id,
    })
  })
}

const promptSectionDraft = (payload) => {
  ElMessageBox.prompt('输入要起草的章节编号（如 1 或 2.1）', '逐节起草', {
    confirmButtonText: '起草',
    cancelButtonText: '取消',
    inputValue: (payload.sections && payload.sections[0] && payload.sections[0].section_id) || '1',
  })
    .then(({ value }) => {
      const sectionRef = (value || '').trim()
      const hit = (payload.sections || []).some((item) => item.section_id === sectionRef)
      if (!hit) {
        ElMessage.warning('该编号不在当前大纲中')
        return
      }
      runDraft(payload.artifact_id, sectionRef, payload.research_topic || '')
    })
    .catch(() => {})
}

const runDraft = (artifactId, sectionRef, topic) => {
  const options = {
    stage: 'DRAFT',
    artifact_id: artifactId,
    section_ref: sectionRef,
  }
  runQuill(`起草章节 ${sectionRef}`, topic, options, (run) => {
    const payload = (run.result_payload && run.result_payload.payload) || {}
    addAiMsg({
      html: renderMarkdown(run.final_answer || '', true),
      meta: `Quill · 逐节起草 ${payload.section_ref || sectionRef} · 证据等级 ${
        run.evidence_level || ''
      } · 点击 [n] 可查看原文`,
      runId: run.id,
      ops: [
        msgOp('INSERT_SELECTION', '插入到正文', {
          text: payload.draft_text || run.final_answer || '',
          runId: run.id,
        }),
        msgOp('COPY_TEXT', '复制本节', { text: payload.draft_text || run.final_answer || '' }),
      ],
    })
  })
}

const onReviseClick = () => {
  const selected = selectionText()
  if (!selected || !selected.trim()) {
    ElMessage.warning('请先选中要修改的文字')
    return
  }
  ElMessageBox.prompt('输入修改要求（如补充实证支撑、语言更学术化）', '学术修改', {
    confirmButtonText: '修改',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '修改要求不能为空',
  })
    .then(({ value }) => {
      runRevise(selected, value.trim())
    })
    .catch(() => {})
}

const runRevise = (selected, instruction) => {
  runQuill('学术修改', selected, { stage: 'REVISE', revise_instruction: instruction }, (run) => {
    const payload = (run.result_payload && run.result_payload.payload) || {}
    const output = payload.revised_text || run.final_answer || ''
    addAiMsg({
      html: renderMarkdown(output, true),
      meta: `Quill · 学术修改 · 证据等级 ${run.evidence_level || ''} · 点击 [n] 可查看原文`,
      runId: run.id,
      ops: [
        msgOp('REPLACE_SELECTION', '替换选区', { text: output }),
        msgOp('COPY_TEXT', '复制', { text: output }),
      ],
    })
  })
}

const onSend = () => {
  const text = draftInput.value.trim()
  if (!text) return
  if (!selectionScope.value && !knowledgeBaseId.value) {
    ElMessage.warning('请先在上方选择知识库')
    return
  }
  if (running.value) {
    ElMessage.warning('有任务进行中，请稍候')
    return
  }
  draftInput.value = ''
  runFreeQA(expandContinuation(text))
}

/* ---------------- 「继续上一步」类指令：补全成自包含的问题 ---------------- */
// 后端把「本轮 query」当作检索与生成的唯一来源（不从历史反向推断），
// 且证据不足时直接确定性地拒答、不调用模型。所以「继续刚刚的任务」
// 这类指代指令必须在前端与上一轮需求合并后再发出去。
const LAST_TASK_KEY = 'quillLastTask'
const CONTINUATION_PATTERN =
  /^\s*(继续|接着|然后|往下|再继续|继续刚|继续上|继续之前|延续|继续完成|continue)/i

const readLastTask = () => {
  try {
    const raw = localStorage.getItem(LAST_TASK_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// 记录本次真实任务，供后续「继续」使用；本身是「继续」指令时不覆盖原任务
const rememberLastTask = (label, query) => {
  const text = String(query || '').trim()
  if (!text || CONTINUATION_PATTERN.test(text)) return
  try {
    localStorage.setItem(
      LAST_TASK_KEY,
      JSON.stringify({ label: label || '', query: text.slice(0, 600) }),
    )
  } catch {
    // 忽略
  }
}

const lastUserTaskText = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const item = messages.value[index]
    if (item.role !== 'user') continue
    const text = String(item.content || '').trim()
    if (text && !CONTINUATION_PATTERN.test(text)) return text
  }
  return ''
}

const expandContinuation = (text) => {
  if (!CONTINUATION_PATTERN.test(text)) return text
  const saved = readLastTask()
  const context = (saved && saved.query) || lastUserTaskText()
  if (!context) return text
  const stage = saved && saved.label ? `（上一步是「${saved.label}」）` : ''
  ElMessage.info('已把「继续」和上一步的任务合并后发送')
  return (
    `继续完成上一步的任务${stage}。上一步的需求是：${context}\n` +
    '请直接基于知识库证据接着给出结果，不要只回答是否能继续。'
  )
}

// ---------- 自由问答：复用启明问答（QIMING）智能体，基于当前知识库证据作答 ----------
const runFreeQA = (question) => {
  addUserMsg(question)
  running.value = true
  const pending = addAiMsg({
    html: '<span class="pending">正在基于知识库证据检索作答，约需十几秒…</span>',
  })
  ;(async () => {
    try {
      const runId = await startRun(question, {}, 'QIMING', '自由问答')
      let live = null
      let lastRun = null
      let lastElapsed = 0
      const renderPending = () => {
        if (lastRun) {
          updatePendingProgress(
            pending,
            '正在基于知识库证据检索作答，约需十几秒…',
            lastRun,
            lastElapsed,
            live,
          )
        }
      }
      const run = await new Promise((resolve, reject) => {
        pollRun(
          runId,
          (done, err) => (done ? resolve(done) : reject(new Error(err || '问答失败'))),
          (progress, elapsed) => {
            lastRun = progress
            lastElapsed = elapsed
            renderPending()
          },
          (data) => {
            live = data
            renderPending()
          },
        )
      })
      messages.value = messages.value.filter((item) => item !== pending)
      addAiMsg({
        html: renderMarkdown(run.final_answer || '', true),
        meta: '启明问答 · 基于知识库证据 · 点击 [n] 查看原文',
        runId: run.id,
        ops: [
          msgOp('INSERT_SELECTION', '插入到正文', { text: run.final_answer || '', runId: run.id }),
          msgOp('COPY_TEXT', '复制', { text: run.final_answer || '' }),
        ],
      })
    } catch (error) {
      messages.value = messages.value.filter((item) => item !== pending)
      addFailureMsg(error.message || '问答失败，请稍后重试')
    } finally {
      running.value = false
      scrollChat()
    }
  })()
}

// ---------- 会话保存与历史 ----------
// 服务端历史只包含「已发布」的回答；停止、失败、进行中的提示只存在于前端。
// 这里把渲染后的消息按会话存到本地，刷新/切页回来先恢复本地记录，再用服务端历史补齐。
const CHAT_STORE_PREFIX = 'quillChat:'
const DRAFT_INPUT_KEY = 'quillDraftInput'
let chatSaveTimer = null

const chatStoreKey = () => CHAT_STORE_PREFIX + (conversationId.value || 'draft')

// 等待面板、思考中的占位是瞬时状态，不写本地，避免回来看到「卡住的思考中」
const isTransientMessage = (item) =>
  typeof item?.html === 'string' &&
  (item.html.includes('class="pending"') || item.html.includes('class="thinking-box"'))

const serializeMessages = (list) =>
  (list || [])
    .filter((item) => item && !isTransientMessage(item))
    .slice(-80)
    .map((item) => ({
      role: item.role,
      content: item.content || '',
      html: item.html || '',
      meta: item.meta || '',
      runId: item.runId || '',
      // 操作按钮只保留描述符（code/label/payload）；没有 code 的旧闭包按钮无法恢复
      ops: (item.ops || [])
        .filter((op) => op && op.code)
        .map((op) => ({ code: op.code, label: op.label, payload: op.payload || {} })),
    }))

const saveChatNow = () => {
  const key = chatStoreKey()
  const all = serializeMessages(messages.value)
  // localStorage 配额有限：写不进去就逐步减少保留条数（宁可少存，也别整段丢）
  for (const limit of [all.length, 40, 20, 10]) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ savedAt: Date.now(), messages: all.slice(-limit) }),
      )
      return
    } catch {
      // 继续尝试更小的窗口
    }
  }
}

const saveChatDebounced = () => {
  clearTimeout(chatSaveTimer)
  chatSaveTimer = setTimeout(saveChatNow, 400)
}

const loadChat = (key) => {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    const list = Array.isArray(parsed?.messages) ? parsed.messages : []
    return list.filter((item) => item && (item.html || item.content))
  } catch {
    return []
  }
}

// 消息或草稿输入有变化就落本地（节流，避免流式期间频繁写）
watch(messages, saveChatDebounced, { deep: true })
watch(draftInput, (value) => {
  try {
    localStorage.setItem(DRAFT_INPUT_KEY, value || '')
  } catch {
    // 忽略
  }
})

/** 恢复会话文献范围，并与已加载的本地消息去重后补齐服务端历史。 */
const restoreHistory = async (savedConversation) => {
  try {
    const { data: resp } = await getQuillConversationService(savedConversation)
    knowledgeBaseId.value = resp.data.knowledge_base_id || null
    selectionScope.value = !resp.data.knowledge_base_id && !resp.data.database_id
    const list = resp.data?.messages || []
    if (selectionScope.value && list.length) {
      const { data: latest } = await getQuillRunService(list[list.length - 1].run_id)
      selectedCorpusIds.value = latest.data.request_payload?.corpus_ids || []
    }
    // 与本地已恢复的消息去重：优先按 runId，其次按正文
    const exists = (entry) =>
      messages.value.some((msg) =>
        msg.role !== entry.role
          ? false
          : entry.runId
            ? msg.runId === entry.runId
            : (msg.content || '') === (entry.content || ''),
      )
    for (const item of list) {
      if (item.role === 'USER') {
        const entry = { role: 'user', content: item.content }
        if (!exists(entry)) messages.value.push(entry)
      } else {
        const entry = {
          role: 'ai',
          html: renderMarkdown(item.content || '', true),
          meta: item.created_at
            ? `历史记录 · ${String(item.created_at).replace('T', ' ').slice(0, 16)}`
            : '历史记录',
          runId: item.run_id || '',
          // 服务端历史不带操作按钮，这里补最小集合，保证旧记录也能落地到正文
          ops: [
            msgOp('INSERT_SELECTION', '插入到正文', {
              text: item.content || '',
              runId: item.run_id || null,
            }),
            msgOp('COPY_TEXT', '复制', { text: item.content || '' }),
          ],
        }
        if (!exists(entry)) messages.value.push(entry)
      }
    }
    if (list.length) scrollChat()
  } catch (error) {
    // 只有会话确实不存在（404）时才清本地指针；网络/鉴权抖动不要清，
    // 否则一次失败就会让历史「越丢越多」
    if (error?.response?.status === 404) {
      localStorage.removeItem('quillConversationId')
      conversationId.value = null
    }
  }
}

const newConversation = () => {
  saveChatNow() // 切换前先把当前会话落到本地
  conversationId.value = null
  localStorage.removeItem('quillConversationId')
  try {
    localStorage.removeItem(CHAT_STORE_PREFIX + 'draft')
  } catch {
    // 忽略
  }
  messages.value = []
  lastRqArtifactId.value = null
  ElMessage.success('已开启新对话，旧对话可在「历史对话」中找回')
}

/* ---------------- 切页/刷新返回：恢复未完成的生成 ---------------- */
const resumeActiveRun = async () => {
  const saved = readPersistedRun()
  if (!saved?.runId) return
  let run = null
  try {
    const { data: resp } = await getQuillRunService(saved.runId)
    run = resp?.data || null
  } catch {
    // 运行不存在或无权访问：丢弃本地记录，避免反复重试
    clearActiveRun()
    return
  }
  if (!run) {
    clearActiveRun()
    return
  }
  if (run.status === 'SUCCESS') {
    // 历史接口若已带出这条回答就不再重复插入
    const alreadyShown = messages.value.some((item) => item.runId === run.id)
    if (!alreadyShown && run.final_answer) {
      addAiMsg({
        html: renderMarkdown(run.final_answer, true),
        meta: '上次离开页面后已生成完成',
        runId: run.id,
        ops: [
          msgOp('INSERT_SELECTION', '插入到正文', { text: run.final_answer || '', runId: run.id }),
          msgOp('COPY_TEXT', '复制', { text: run.final_answer || '' }),
        ],
      })
    }
    clearActiveRun()
    return
  }
  if (run.status === 'FAILED' || run.status === 'CANCELLED') {
    addFailureMsg(
      run.status === 'CANCELLED'
        ? STOPPED_MESSAGE
        : run.error_message || '上次生成失败',
    )
    clearActiveRun()
    return
  }

  // 仍在排队或运行：重建等待消息并继续轮询，保证切回来能看到结果
  const label = saved.label || '上次生成'
  running.value = true
  const pending = addAiMsg({
    html: `<span class="pending">正在恢复${label}的结果，请稍候…</span>`,
  })
  let live = null
  let lastRun = null
  let lastElapsed = 0
  const renderPending = () => {
    if (lastRun) {
      updatePendingProgress(pending, `Quill${label}中，请稍候…`, lastRun, lastElapsed, live)
    }
  }
  pollRun(
    saved.runId,
    (done, err) => {
      running.value = false
      messages.value = messages.value.filter((item) => item !== pending)
      if (done) {
        addAiMsg({
          html: done.final_answer
            ? renderMarkdown(done.final_answer, true)
            : '<span class="muted">（本次未返回正文）</span>',
          meta: '恢复的生成结果 · 点击 [n] 查看原文',
          runId: done.id,
        })
      } else {
        addFailureMsg(err)
      }
    },
    (progress, elapsed) => {
      lastRun = progress
      lastElapsed = elapsed
      renderPending()
    },
    (data) => {
      live = data
      renderPending()
    },
  )
}

const showConversations = async () => {
  try {
    const { data: resp } = await getQuillConversationListService(1)
    conversationRows.value = resp.data?.items || []
    convDrawerVisible.value = true
  } catch {
    ElMessage.error('读取历史对话失败')
  }
}

const openConversation = (row) => {
  saveChatNow() // 切换前先把当前对话落到本地
  conversationId.value = row.id
  localStorage.setItem('quillConversationId', conversationId.value)
  // 先用本地记录还原（含停止/失败等纯前端提示），再由服务端历史补齐
  messages.value = loadChat(CHAT_STORE_PREFIX + row.id)
  convDrawerVisible.value = false
  restoreHistory(row.id)
}

const showArtifacts = async () => {
  if (!conversationId.value) {
    ElMessage.warning('当前会话还没有产物，请先发起一次生成')
    return
  }
  try {
    // 注意：必须传 ref 的 .value——直接传 conversationId 会把对象拼进 URL，
    // 请求变成 /writing-artifacts/object object} 之类，后端必然 404
    const { data: resp } = await getQuillArtifactsService(conversationId.value)
    artifactRows.value = resp.data?.items || []
    artifactDialogVisible.value = true
  } catch {
    ElMessage.error('读取产物历史失败')
  }
}

const downloadDocx = async (params, filename) => {
  try {
    const resp = await exportQuillDocxService(params)
    const url = URL.createObjectURL(resp.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('导出失败，请稍后重试')
  }
}

const downloadArtifact = (row) => {
  downloadDocx(
    { artifact_id: row.id },
    `quill_${String(row.stage).toLowerCase()}_${String(row.id).slice(0, 8)}.docx`,
  )
}

// ---------- 整篇连播起草：按大纲顺序循环调用 DRAFT ----------
const runDraftSequence = (payload) => {
  const sections = payload.sections || []
  if (!payload.artifact_id || !sections.length) {
    ElMessage.warning('当前大纲没有可起草的章节')
    return
  }
  if (running.value) return
  running.value = true
  const progress = addAiMsg({
    html: `<span class="pending">正在按大纲起草整篇（0/${sections.length} 节），完成后一次性输出完整稿并写入编辑器…</span>`,
  })
  ;(async () => {
    const collected = []
    try {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        const runId = await startRun(
          payload.research_topic || '论文起草',
          {
            stage: 'DRAFT',
            artifact_id: payload.artifact_id,
            section_ref: section.section_id,
          },
          'QUILL',
          `第${i + 1}节起草`,
        )
        let live = null
        let lastRun = null
        let lastElapsed = 0
        const renderPending = () => {
          if (lastRun) {
            updatePendingProgress(progress, '整篇连播起草中，请稍候…', lastRun, lastElapsed, live)
          }
        }
        const run = await new Promise((resolve, reject) => {
          pollRun(
            runId,
            (done, err) => (done ? resolve(done) : reject(new Error(err || '起草失败'))),
            (runProgress, elapsed) => {
              lastRun = runProgress
              lastElapsed = elapsed
              renderPending()
            },
            (data) => {
              live = data
              renderPending()
            },
          )
        })
        const draftPayload = (run.result_payload && run.result_payload.payload) || {}
        collected.push({
          section,
          draft: draftPayload.draft_text || run.final_answer || '',
          // 记住本节对应的运行，写入正文后 [n] 才能点开对应证据
          runId: run.id,
        })
        // 重置进度渲染状态：上一节的运行数据作废，避免实时思维链误用旧运行
        lastRun = null
        progress.html = `<span class="pending">正在起草（${i + 1}/${sections.length} 节：${section.section_id} ${
          section.title || ''
        }）…</span>`
        // 不再逐节插入消息：整篇作为一份完整稿，最后一次性输出
      }
      messages.value = messages.value.filter((item) => item !== progress)
      // 拼装成带标题层级的正文：分节草稿若自身没有标题标记，用大纲的章节号+标题补上，
      // 这样写入编辑器后就有 H1/H2 结构，大纲面板也能直接用
      const segments = collected
        .map((item) => {
          const draft = String(item.draft || '').trim()
          if (!draft) return null
          const label = [item.section?.section_id, item.section?.title].filter(Boolean).join(' ')
          const text =
            /^#{1,6}\s+/m.test(draft) || !label ? draft : `## ${label}\n\n${draft}`
          return { text, runId: item.runId || null }
        })
        .filter(Boolean)
      const structuredText = segments.map((item) => item.text).join('\n\n')
      const wordTotal = structuredText.replace(/\s/g, '').length
      const editorEmpty = (editor.value?.getText() || '').trim().length === 0
      addAiMsg({
        html: `<span class="pending">整篇草稿已生成：${sections.length} 节，约 ${wordTotal} 字。${
          editorEmpty
            ? '已直接写入左侧编辑器（可用 Ctrl+Z 撤回）。'
            : '编辑器里已有内容，可点「写入编辑器」选择覆盖全文或追加到末尾。'
        }</span>`,
        ops: [
          msgOp('WRITE_EDITOR', '写入编辑器', { segments, text: structuredText }),
          msgOp('EXPORT_PAPER', '导出全文 Word'),
          msgOp('COPY_TEXT', '复制全文', { text: structuredText }),
        ],
      })
      // 编辑器为空时直接成稿，省掉「再点一次写入」这一步
      if (editorEmpty) writeWholeDocument({ segments, text: structuredText })
    } catch (error) {
      messages.value = messages.value.filter((item) => item !== progress)
      addFailureMsg(error.message || '连播起草中断')
    } finally {
      running.value = false
      scrollChat()
    }
  })()
}

// 知识库 ID 持久化，避免每次进入页面重复填写
watch(knowledgeBaseId, (value) => {
  if (value) localStorage.setItem('quillKbId', String(value))
})
</script>

<style lang="scss" scoped>
.assistant-page {
  height: calc(100vh - 70px);
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
  overflow: hidden;
}

.config-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e5e9;
  flex: none;
  flex-wrap: wrap;

  /* 知识库下拉项：名称靠左、文献数靠右 */
  .kb-option-name {
    display: inline-block;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }

  .kb-option-count {
    float: right;
    color: #9ca3af;
    font-size: 12px;
  }
  .config-label {
    font-size: 13px;
    color: #6b7280;
  }

  .config-tip {
    margin-left: auto;
    font-size: 12px;
    color: #9ca3af;
  }
}

.main {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* 左侧编辑器 */
.editor-pane {
  flex: 1.35;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: none; /* 分隔线由中间的折叠把手绘制，避免双线 */
  min-width: 0;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 18px;
  border-bottom: 1px solid #e2e5e9;
  color: #555;
  font-size: 14px;
  flex: none;
  align-items: center;

  .fake-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    color: #374151;
    font-size: 13px;
    padding: 3px 7px;
    border-radius: 4px;

    &:hover {
      background: #eef4f5;
      color: #005767;
    }
  }

  .fmt-select {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 12px;
    padding: 3px 4px;
    color: #374151;
    background: #fff;
    max-width: 100px;
  }

  .color-input {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }

  .save-tip {
    margin-left: auto;
    font-size: 12px;
    color: #9ca3af;
  }
}

/* 划词浮动工具条（fixed 定位，字号/排版与旧版一致：图标在上、文字在下） */
.sel-toolbar {
  position: fixed;
  z-index: 3000;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  background: #005767;
  border-radius: 8px;
  padding: 6px 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  max-width: 520px;

  button {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 13px;
    padding: 6px 9px;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    white-space: nowrap;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.18);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .ico {
      font-size: 13px;
      font-style: normal;
    }
  }

  .sep {
    width: 1px;
    background: rgba(255, 255, 255, 0.35);
    margin: 4px;
  }
}

.editor-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;

  .word-count {
    position: absolute;
    right: 12px;
    bottom: 8px;
    font-size: 12px;
    color: #9ca3af;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    padding: 2px 8px;
    pointer-events: none;
  }
}

.editor {
  height: 100%;
  overflow: auto;
  padding: 28px 40px;
  font-size: 16px;
  line-height: 1.9;
  outline: none;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

/* 注意：.ProseMirror 及其内部节点由 Tiptap 运行时创建，不带 scoped 的 data-v 属性，
   因此排版与焦点样式必须写在文件末尾的「非 scoped」样式块里，否则全部不生效。 */

/* 大纲导航面板（浮在编辑区右上角，不占正文宽度） */
.outline-pane {
  position: absolute;
  top: 8px;
  right: 8px;
  bottom: 40px;
  width: 152px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 8px 10px;
  z-index: 6;
  font-size: 12px;

  .outline-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #6b7280;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .outline-count {
    color: #9ca3af;
    font-weight: 400;
  }

  .outline-empty {
    color: #9ca3af;
    line-height: 1.6;
  }

  .outline-item {
    padding: 3px 0;
    cursor: pointer;
    color: #374151;
    line-height: 1.5;
    border-radius: 4px;

    &:hover {
      color: #005767;
      background: #eef4f5;
    }

    &.lv1 {
      font-weight: 600;
    }

    &.lv2 {
      padding-left: 8px;
      color: #4b5563;
    }

    &.lv3 {
      padding-left: 16px;
      color: #6b7280;
    }
  }
}

/* 工具条弹层里的紧凑表单（查找替换 / 历史版本） */
.mini-form {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .mini-row {
    display: flex;
    gap: 6px;

    &.spread {
      justify-content: space-between;
      align-items: center;
    }
  }

  .mini-tip {
    font-size: 12px;
    color: #9ca3af;
  }

  .version-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
    border-top: 1px solid #f3f4f6;
  }

  .version-meta {
    font-size: 12px;
    color: #4b5563;
  }

  .version-actions {
    display: flex;
    flex: none;
  }
}

.fake-btn.active {
  background: #d9ecee;
  color: #005767;
  border-color: #99c1c8;
}

/* 顶部「AI 创作」入口（替代原浮动划词工具条） */
.fake-btn.ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-color: #99c1c8;
  background: #eef4f5;
  color: #005767;
  font-weight: 600;

  &:hover {
    background: #d9ecee;
  }

  &.is-disabled {
    border-color: #e5e7eb;
    background: #f9fafb;
    color: #b0b4ba;
    font-weight: 400;
    cursor: not-allowed;
  }

  .ai-btn-count {
    font-size: 11px;
    font-weight: 400;
    color: #005767;
    background: #d9ecee;
    border-radius: 8px;
    padding: 0 5px;
  }
}

/* 两栏之间的折叠把手：纯图形无文字，点击切换折叠 */
.pane-splitter {
  flex: none;
  width: 18px;
  margin: 0 -9px;
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    transform: translateX(-50%);
    background: #e6e8ec;
    transition: width 0.18s, background 0.18s;
  }

  &:hover::before {
    width: 2px;
    background: #8dbbc3;
  }

  .splitter-handle {
    position: relative;
    width: 22px;
    height: 60px;
    border-radius: 11px;
    background: #fff;
    border: 1px solid #e6e8ec;
    color: #8a9199;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.07);
    transition:
      color 0.18s,
      border-color 0.18s,
      background 0.18s,
      box-shadow 0.18s,
      transform 0.18s;
  }

  &:hover .splitter-handle {
    color: #005767;
    border-color: #8dbbc3;
    background: #f6fdf9;
    box-shadow: 0 3px 12px rgba(21, 128, 61, 0.18);
    transform: scale(1.05);
  }

  &:active .splitter-handle {
    transform: scale(0.97);
  }

  .splitter-icon {
    transition: transform 0.22s ease;
  }

  /* 折叠后箭头翻转指向右侧（提示可展开） */
  &.is-collapsed .splitter-icon {
    transform: rotate(180deg);
  }

  /* 收起后编辑区不占位，把手改作独立窄条并内缩，避免被容器左边界裁掉一半 */
  &.is-collapsed {
    width: 28px;
    margin: 0;
    justify-content: center;

    &::before {
      left: 14px;
    }
  }
}

/* 右侧助手 */
.chat-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 380px;
  background: #fafbfc;
}

.quick-tags {
  display: flex;
  gap: 8px;
  padding: 12px 14px 4px;
  flex-wrap: wrap;
  flex: none;

  .quick-tag {
    cursor: pointer;
    color: #005767;
    background: #fff;
    border-color: #005767;

    &:hover {
      background: #e7f5ec;
    }
  }
}

.chat {
  flex: 1;
  overflow: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .chat-empty {
    margin: auto;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
    line-height: 2;
  }
}

.msg {
  max-width: 92%;

  &.user {
    align-self: flex-end;

    .msg-bubble {
      background: #005767;
      color: #fff;
      padding: 8px 12px;
      border-radius: 10px 10px 2px 10px;
      font-size: 13px;
      line-height: 1.7;
      word-break: break-word;
      white-space: pre-wrap;
    }
  }

  &.ai {
    align-self: flex-start;

    .msg-card {
      background: #fff;
      border: 1px solid #e2e5e9;
      padding: 10px 12px;
      border-radius: 10px 10px 10px 2px;
    }

    .msg-body {
      font-size: 13px;
      line-height: 1.8;
      word-break: break-word;

      :deep(h1),
      :deep(h2),
      :deep(h3),
      :deep(h4) {
        font-size: 14px;
        margin: 8px 0 4px;
        color: #005767;
      }

      :deep(p) {
        margin: 4px 0;
      }

      :deep(ul) {
        padding-left: 18px;
      }

      :deep(code) {
        background: #f3f4f6;
        padding: 1px 4px;
        border-radius: 4px;
      }

      :deep(a.cite) {
        color: #005767;
        cursor: pointer;
        text-decoration: none;
        font-weight: 600;
        font-size: 12px;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.cite-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 12px;
    }

    .cite-badge {
      flex: none;
      margin-top: 2px;
      font-size: 12px;
      line-height: 1;
      padding: 4px 10px;
      border-radius: 999px;

      &.ok {
        background: #d9ecee;
        color: #005767;
      }

      &.bad {
        background: #fef3c7;
        color: #b45309;
      }
    }

    .cite-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.5;
      color: #111827;
    }

    .cite-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .cite-chip {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #f3f4f6;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      color: #374151;
      max-width: 100%;

      .chip-label {
        color: #9ca3af;
        flex: none;

        &::after {
          content: '：';
        }
      }
    }

    .cite-quote-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 6px;

      &::before {
        content: '';
        display: inline-block;
        width: 3px;
        height: 12px;
        background: #005767;
        border-radius: 2px;
      }
    }

    .cite-quote {
      background: #fafbfc;
      border: 1px solid #eceff3;
      border-left: 3px solid #005767;
      border-radius: 8px;
      padding: 14px 18px 6px;
      max-height: 320px;
      overflow: auto;
      overscroll-behavior: contain;
      font-size: 13.5px;
      line-height: 1.95;
      color: #374151;
      word-break: break-word;

      .cite-para {
        margin: 0 0 12px;
        text-indent: 2em;
        text-align: justify;

        &:last-child {
          margin-bottom: 4px;
        }
      }

      .cite-hit {
        background: #fff2b8;
        box-shadow: inset 0 -0.55em 0 #fff2b8;
        border-radius: 2px;
        padding: 0 1px;
      }
    }

    .cite-hit-tip {
      margin: 4px 0 12px;
      font-size: 12px;
      color: #005767;

      &.muted {
        color: #9ca3af;
      }
    }

    .cite-actions {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cite-warn {
      color: #b45309;
      font-size: 12px;
    }

    .conv-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .conv-item {
      position: relative;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;

      &:hover {
        border-color: #005767;
        background: #eef4f5;
      }

      &.active {
        border-color: #005767;
        background: #eef4f5;
      }
    }

    .conv-title {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
      padding-right: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .conv-time {
      font-size: 12px;
      color: #9ca3af;
    }

    .conv-current {
      position: absolute;
      top: 10px;
      right: 12px;
      font-size: 11px;
      color: #005767;
      background: #d9ecee;
      border-radius: 999px;
      padding: 2px 8px;
    }

    .conv-empty {
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
      padding: 40px 0;
    }

    .guide {
      h3 {
        color: #005767;
        font-size: 14px;
        margin: 14px 0 8px;
      }

      ul,
      ol {
        margin: 0 0 8px;
        padding-left: 20px;
      }

      li {
        font-size: 13px;
        line-height: 1.8;
        color: #374151;
        margin-bottom: 4px;
      }

      b {
        color: #111827;
      }
    }

    .msg-meta {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 6px;
    }

    .msg-ops {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }

    .pending {
      color: #9ca3af;
    }

    // 深度思考进度（v-html 注入，需 :deep 命中）
    :deep(.thinking-box) {
      margin-bottom: 8px;
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    }

    :deep(.thinking-head) {
      font-size: 12px;
      font-weight: 600;
      color: #0b6375;
    }

    :deep(.think-node) {
      font-size: 12px;
      color: #6b7280;
      margin-top: 6px;
    }

    :deep(.think-running) {
      font-size: 12px;
      color: #d97706;
      margin-top: 6px;
    }

    :deep(.think-text) {
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.6;
      max-height: 160px;
      overflow-y: auto;
      border-left: 2px solid #e5e7eb;
      padding-left: 8px;
      margin-top: 4px;
      white-space: normal;
      word-break: break-word;
    }

    :deep(.answer-live) {
      white-space: pre-wrap;
      color: #374151;
      max-height: 220px;
    }

.input-bar {
  flex: none;
  border-top: 1px solid #e2e5e9;
  padding: 10px 14px 14px;

  .input-modes {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #6b7280;
    align-items: center;

    .input-tip {
      color: #9ca3af;
    }
  }

  .input-row {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 12px;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    &:focus-within {
      border-color: #005767;
      box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.08);
    }

    /* 输入框本体去掉自带边框，边框由外面这个盒子提供 */
    :deep(.el-textarea) {
      flex: 1;
    }

    :deep(.el-textarea__inner) {
      min-height: 104px;
      padding: 2px 0;
      border: none;
      box-shadow: none;
      background: transparent;
      font-size: 14px;
      line-height: 1.7;
      resize: none;
    }

    .send-btn {
      flex: none;
      width: 40px;
      height: 40px;
      min-height: 40px;
      padding: 0;
      border-radius: 50%;
      font-size: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>

<!-- 非 scoped：Tiptap 运行时创建的 .ProseMirror 及其子节点没有 data-v 属性，
     scoped 选择器匹配不到，因此编辑区排版与焦点样式放在这里。 -->
<style>
.editor [contenteditable='true'],
.editor .ProseMirror {
  outline: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

.editor [contenteditable='true']:focus,
.editor [contenteditable='true']:focus-visible,
.editor .ProseMirror:focus,
.editor .ProseMirror:focus-visible {
  outline: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

.editor .ProseMirror {
  min-height: 100%;
  font-size: 16px;
  line-height: 1.9;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  word-break: break-word;
  white-space: pre-wrap;
}

.editor .ProseMirror > p:first-child {
  margin-top: 0;
}

.editor .ProseMirror p {
  margin: 0 0 0.6em;
  text-indent: 2em;
}

.editor .ProseMirror h1 {
  font-size: 22px;
  font-weight: 600;
  margin: 1em 0 0.5em;
  text-indent: 0;
}

.editor .ProseMirror h2 {
  font-size: 19px;
  font-weight: 600;
  margin: 0.9em 0 0.45em;
  text-indent: 0;
}

.editor .ProseMirror h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 0.8em 0 0.4em;
  text-indent: 0;
}

.editor .ProseMirror ul,
.editor .ProseMirror ol {
  margin: 0 0 0.6em;
  padding-left: 1.8em;
}

.editor .ProseMirror li p {
  text-indent: 0;
  margin: 0.15em 0;
}

.editor .ProseMirror blockquote {
  margin: 0.6em 0;
  padding-left: 12px;
  border-left: 3px solid #d1d5db;
  color: #4b5563;
}

.editor .ProseMirror strong {
  font-weight: 600;
}

/* 记住的选区（点顶部菜单、编辑器失焦时仍保持高亮） */
.editor .pm-saved-selection {
  background: #eef4f5;
  box-shadow: inset 0 -1px 0 #8dbbc3;
}

/* 正文里的可点击引用上标 */
.editor .ProseMirror sup.cite-mark {
  color: #005767;
  font-weight: 600;
  cursor: pointer;
  padding: 0 1px;
  border-radius: 3px;
}

.editor .ProseMirror sup.cite-mark:hover {
  background: #d9ecee;
  text-decoration: underline;
}
</style>
