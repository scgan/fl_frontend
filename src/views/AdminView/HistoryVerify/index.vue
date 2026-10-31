<template>
  <div class="box">
    <div class="title">&nbsp;</div>
    <div class="handle-box">
      <el-row :gutter="20" style="widows: 100%;">
        <el-col :span="6">
          <el-form-item label="标题：">
            <el-input
              v-model="searchParams.title"
              placeholder="请输入原文/译文标题"
              clearable
              @keyup.enter="handleSearch"
            ></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="语言：">
            <el-select
              v-model="searchParams.language"
              placeholder="请选择语言"
              allow-create
              filterable
              clearable
              @change="handleSearch"
              style="width: 100%"
            >
              <!-- 主流语言 -->
              <el-option label="中文" value="中文"></el-option>
              <el-option label="英文" value="英文"></el-option>

              <!-- 高考热门小语种（依据搜索结果） -->
              <el-option label="日语" value="日语"></el-option>
              <el-option label="德语" value="德语"></el-option>
              <el-option label="法语" value="法语"></el-option>
              <el-option label="西班牙语" value="西班牙语"></el-option>
              <el-option label="俄语" value="俄语"></el-option>

              <!-- 新兴热门小语种（依据搜索结果） -->
              <el-option label="韩语" value="韩语"></el-option>
              <el-option label="意大利语" value="意大利语"></el-option>
              <el-option label="阿拉伯语" value="阿拉伯语"></el-option>
              <el-option label="葡萄牙语" value="葡萄牙语"></el-option>
              <el-option label="泰语" value="泰语"></el-option>

              <!-- 潜力小语种（依据搜索结果） -->
              <el-option label="越南语" value="越南语"></el-option>
              <el-option label="荷兰语" value="荷兰语"></el-option>
              <el-option label="瑞典语" value="瑞典语"></el-option>
              <el-option label="波斯语" value="波斯语"></el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="作者/编者/译者：">
            <el-input
              v-model="searchParams.author"
              placeholder="请输入作者/编者/译者"
              clearable
              @keyup.enter="handleSearch"
            ></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="4">
          <el-form-item>
            <el-button type="primary" @click="handleSearch">搜索</el-button>
            <el-button @click="resetSearch">重置</el-button>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 原有的按钮区域 -->
      <!-- <el-select v-model="selectCategory" class="handle-select mr10">
        <el-option key="1" label="姓名" value="name"></el-option>
				<el-option key="2" label="教职工号" value="username"></el-option>
				<el-option key="3" label="电话" value="phone"></el-option>
      </el-select> -->
      <!-- <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input> -->
      <!-- <el-button @click="serachPeople" type="primary" icon="el-icon-search">搜索</el-button> -->
      <!-- <el-button type="success" @click="reFresh">刷新</el-button> -->
      <!-- <el-button
        @click="dialogVisible = true"
        type="success"
        icon="el-icon-circle-plus-outline"
        >添加管理员</el-button
      > -->
      <!-- <el-button type="warning" @click="isPass" icon="el-icon-circle-check"
        >通过审核</el-button
      > -->
    </div>
    <!-- AI 批量归类入口 -->
    <div class="ai-bar">
      <el-button type="warning" icon="el-icon-magic-stick" @click="openAiClassify"
        >AI 批量归类并审核</el-button
      >
      <span class="ai-hint">按当前筛选条件读取文献，由大模型判定所属数据库并自动审核通过</span>
      <el-tag
        v-if="aiRunning"
        type="success"
        effect="dark"
        class="ai-running-tag"
        :title="aiState.message"
        @click="aiDialogVisible = true"
      >
        <span class="ai-dot"></span>归类进行中 {{ aiState.processed }}/{{ aiState.total }}
      </el-tag>
    </div>
    <!-- 数据展示 -->
    <div class="container">
      <el-table
        v-if="adminList.length > 0"
        :data="adminList"
        @selection-change="handleSelectionChange"
      >
        <!--<el-table-column
          type="selection"
          width="60"
          align="center"
        ></el-table-column>-->
        <el-table-column
          label="原文标题"
          prop="title_cn"
          show-overflow-tooltip
          align="center"
        ></el-table-column>

        <el-table-column label="译文标题" prop="title_en" show-overflow-tooltip> </el-table-column>
        <el-table-column
          label="语料类名"
          show-overflow-tooltip
          prop="category_name"
        ></el-table-column>
        <el-table-column label="语言" show-overflow-tooltip prop="language"></el-table-column>
        <el-table-column label="收集人" show-overflow-tooltip prop="contributor_name"></el-table-column>
        <!-- <el-table-column label="审核状态" width="100" prop="check" align="center">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag :type="scope.row.check == '0' ? 'warning' : 'success'">{{ scope.row.status == "0" ? "未审核" : "已审核" }}</el-tag>
            </span>
          </template>
        </el-table-column> -->
        <el-table-column label="操作" align="center" width="150">
          <template v-slot="scope">
            <el-button
              type="text"
              icon="el-icon-remove"
              @click="handleDetail(scope.$index, scope.row)"
              >审核</el-button
            >
            <el-button
              type="text"
              icon="el-icon-delete"
              class="red"
              @click="deleteRecoveryCorpus(scope.row.corpus_id)"
              >删除</el-button
            >
            <!-- toShow(scope.row) -->
            <!--<el-button
              type="text"
              icon="el-icon-delete"
              class="red"
              @click="handleDelete(scope.$index, scope.row)"
              >删除</el-button
            >-->
          </template>
        </el-table-column>
      </el-table>
    </div>
    <!-- 导航区 -->
    <div class="footer">
      <el-pagination
        @size-change="handleSizeChange"
        background
        layout="total,sizes,prev,pager,next, jumper"
        v-model:current-page="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        @current-change="pageChange"
        @next-click="currentPage"
        @prev-click="currentPage"
        :hide-on-single-page="false"
        :total="total"
      >
      </el-pagination>
    </div>

    <el-dialog
      v-model="aiDialogVisible"
      :title="aiRunning ? 'AI 批量归类进行中' : 'AI 批量归类并审核'"
      width="760px"
      :close-on-click-modal="false"
      :show-close="!aiRunning"
    >
      <!-- 未启动：参数确认 -->
      <el-form v-if="!aiState.task_id" label-width="130px">
        <el-form-item label="处理范围">
          <span class="ai-scope">{{ aiScopeText }}</span>
        </el-form-item>
        <el-form-item label="本次处理条数">
          <el-input-number v-model="aiForm.limit" :min="0" :max="200000" :step="50" />
          <span class="ai-hint inline">0 表示按筛选条件全部处理</span>
        </el-form-item>
        <el-form-item label="只处理未关联库">
          <el-switch v-model="aiForm.only_unassigned" />
          <span class="ai-hint inline">关闭后，已关联数据库的文献也会重新判定并覆盖</span>
        </el-form-item>
        <el-form-item label="自动审核通过">
          <el-switch v-model="aiForm.auto_approve" />
          <span class="ai-hint inline">关闭则只写入所属数据库，仍由你逐条点通过</span>
        </el-form-item>
        <el-form-item label="置信度阈值">
          <el-slider
            v-model="aiForm.min_confidence"
            :min="0"
            :max="1"
            :step="0.05"
            style="width: 260px"
          />
          <span class="ai-hint inline">低于该值只归类不通过；0 表示全部通过</span>
        </el-form-item>
        <el-form-item label="使用模型">
          <el-select v-model="aiForm.model" style="width: 240px">
            <el-option label="qwen3.8-flash（快、成本低）" value="qwen3.8-flash"></el-option>
            <el-option label="qwen-plus（更准、稍慢）" value="qwen-plus"></el-option>
          </el-select>
        </el-form-item>
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="任务在后台运行，可关闭窗口继续处理其他事务；写入时末级库的各级上级会一并关联，审核通过后自动进入索引队列。"
        />
      </el-form>

      <!-- 已启动：进度与明细 -->
      <div v-else>
        <el-progress
          :percentage="aiPercent"
          :status="aiProgressStatus"
          :stroke-width="14"
          :text-inside="true"
        />
        <div class="ai-stats">
          <el-tag type="info">总数 {{ aiState.total }}</el-tag>
          <el-tag>已处理 {{ aiState.processed }}</el-tag>
          <el-tag type="success">已通过 {{ aiState.approved }}</el-tag>
          <el-tag type="info">仅归类 {{ aiState.classified }}</el-tag>
          <el-tag type="warning">待人工 {{ aiState.pending || 0 }}</el-tag>
          <el-tag type="danger">失败 {{ aiState.failed }}</el-tag>
        </div>
        <p class="ai-msg">{{ aiState.message }}<span v-if="aiState.model"> · 模型 {{ aiState.model }}</span></p>
        <el-table :data="aiState.items || []" size="small" height="280" empty-text="暂无已处理记录">
          <el-table-column prop="corpus_id" label="ID" width="80" />
          <el-table-column prop="title" label="文献" show-overflow-tooltip />
          <el-table-column label="判定所属数据库" show-overflow-tooltip>
            <template v-slot="scope">
              {{ (scope.row.databases || []).join('；') || '—' }}
              <span
                v-if="(scope.row.linked_count || 0) > (scope.row.databases || []).length"
                class="ai-linked"
              >
                已同步上级
                {{ scope.row.linked_count - (scope.row.databases || []).length }} 项
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="confidence" label="置信度" width="80" align="center" />
          <el-table-column label="结果" width="96" align="center">
            <template v-slot="scope">
              <el-tag size="small" :type="aiActionType(scope.row.action)">
                {{ aiActionText(scope.row.action) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <div v-if="!aiState.task_id">
          <el-button @click="aiDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="aiStarting" @click="startAiClassify"
            >开始归类</el-button
          >
        </div>
        <div v-else>
          <el-button
            v-if="aiRunning"
            type="danger"
            plain
            :loading="aiStopping"
            @click="stopAiClassify"
            >停止任务</el-button
          >
          <el-button v-else type="warning" plain @click="resetAiTask">重新发起</el-button>
          <el-button type="primary" @click="closeAiDialog">{{
            aiRunning ? '后台运行' : '关闭'
          }}</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer
      title="语料详情"
      :model-value="dialogVisiblePerson"
      @update:model-value="dialogVisiblePerson = $event"
      size="60%"
    >
      <el-form :model="msgDetail" ref="formRef" label-width="100px" :rules="rules">
        <el-form-item label="原文标题">
          <el-input
            v-model="msgDetail.title_cn"
            placeholder="请输入原文标题"
          ></el-input>
        </el-form-item>
        <el-form-item label="译文标题">
          <el-input
            v-model="msgDetail.title_en"
            placeholder="请输入译文标题"
          ></el-input>
        </el-form-item>
        <el-row>
          <el-form-item label="语言">
            <!-- <el-select
          v-model="msgDetail.language"
          placeholder="请选择语言"
          allow-create
          clearable
          :disabled="ban"
        >
          <el-option label="中文" value="zh"></el-option>
          <el-option label="英文" value="en"></el-option>
        </el-select> -->
            <el-select
              v-model="msgDetail.language"
              placeholder="请选择语言"
              allow-create
              filterable
              clearable
              style="width: 200px"
            >
              <!-- 主流语言 -->
              <el-option label="中文" value="中文"></el-option>
              <el-option label="英文" value="英文"></el-option>

              <!-- 高考热门小语种（依据搜索结果） -->
              <el-option label="日语" value="日语"></el-option>
              <el-option label="德语" value="德语"></el-option>
              <el-option label="法语" value="法语"></el-option>
              <el-option label="西班牙语" value="西班牙语"></el-option>
              <el-option label="俄语" value="俄语"></el-option>

              <!-- 新兴热门小语种（依据搜索结果） -->
              <el-option label="韩语" value="韩语"></el-option>
              <el-option label="意大利语" value="意大利语"></el-option>
              <el-option label="阿拉伯语" value="阿拉伯语"></el-option>
              <el-option label="葡萄牙语" value="葡萄牙语"></el-option>
              <el-option label="泰语" value="泰语"></el-option>

              <!-- 潜力小语种（依据搜索结果） -->
              <el-option label="越南语" value="越南语"></el-option>
              <el-option label="荷兰语" value="荷兰语"></el-option>
              <el-option label="瑞典语" value="瑞典语"></el-option>
              <el-option label="波斯语" value="波斯语"></el-option>
            </el-select>
            <!-- <el-input
            v-model="msgDetail.language"
            placeholder="请输入语言"
            :disabled="ban"
            style="width: 200px"
          ></el-input> -->
          </el-form-item>
          <el-form-item label="译者" prop="translator">
            <el-input
              v-model="msgDetail.translator"
              placeholder="请输入译者"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="作者" prop="author">
            <el-input
              v-model="msgDetail.author"
              placeholder="请输入作者"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="编者" prop="editor">
            <el-input
              v-model="msgDetail.editor"
              placeholder="请输入编者"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="ISBN" prop="ISSN">
            <el-input
              v-model="msgDetail.ISSN"
              placeholder="请输入文献编号"
              :disabled="ban"
              style="width: 200px"
            ></el-input>
          </el-form-item>
          <el-form-item label="文献类型" prop="category_id">
            <category-select2 v-model="msgDetail.category_id"></category-select2>
            <!-- <el-select v-model="msgDetail.documentType" placeholder="请选择">
          <el-option label="图书" value="book"></el-option>
          <el-option label="期刊论文" value="journal"></el-option>
          <el-option label="学位论文" value="thesis"></el-option>
        </el-select> -->
          </el-form-item>
          <el-form-item label="出版时间">
            <!-- <el-date-picker
              v-model="msgDetail.publish_time"
              type="year"
              placeholder="请选择年份"
              format="YYYY"
              value-format="YYYY"
              style="width: 200px"
            ></el-date-picker> -->
            <el-input
              v-model="msgDetail.publish_time"
              placeholder="请输入出版年份"
              style="width: 200px"
              :disabled="ban"
            ></el-input>
          </el-form-item>
          <el-form-item label="卷号" prop="volume">
            <el-input
              v-model="msgDetail.volume"
              placeholder="请输入卷号"
              style="width: 200px"
              :disabled="ban"
            ></el-input>
          </el-form-item>
          <el-form-item label="期号" prop="issue">
            <el-input
              v-model="msgDetail.issue"
              placeholder="请输入编者"
              style="width: 200px"
              :disabled="ban"
            ></el-input>
          </el-form-item>
          <!-- <el-form-item label="卷期号/ISBN">
        <el-input v-model="msgDetail.volumeOrIsbn"></el-input>
      </el-form-item> -->
        </el-row>
        <el-form-item label="来源">
          <el-input
            v-model="msgDetail.source"
            placeholder="请输入出版社、期刊名称或url"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <el-form-item label="所属数据库" prop="database_id">
          <database-select v-model="msgDetail.database_id"></database-select>
        </el-form-item>
        <el-form-item label="中文关键词">
          <keyword-select
            v-model="msgDetail.keyword_cn"
            style="padding-right: 10px"
            :language="chinese"
            :disabled="ban"
          ></keyword-select>
        </el-form-item>
        <el-form-item label="英文关键词">
          <keyword-select
            v-model="msgDetail.keyword_en"
            style="padding-right: 10px"
            :language="english"
            :disabled="ban"
          ></keyword-select>
        </el-form-item>
        <el-form-item label="中文摘要">
          <el-input
            type="textarea"
            v-model="msgDetail.abstract_cn"
            placeholder="请输入中文摘要"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <el-form-item label="外文摘要">
          <el-input
            type="textarea"
            v-model="msgDetail.abstract_en"
            placeholder="请输入外文摘要"
            :disabled="ban"
          ></el-input>
        </el-form-item>
        <!-- 如果是翻译文献（译者不为空？）录入原文信息 -->
        <div v-if="msgDetail.translator">
          <el-form-item label="原文文档名">
            <el-input v-model="msgDetail.original_name"></el-input>
          </el-form-item>
          <!-- <el-form-item label="原文标题">
          <el-input v-model="msgDetail.original_title" :disabled="ban"></el-input>
        </el-form-item> -->
          <el-row>
            <el-form-item label="原文语言">
              <!-- <el-select
              v-model="msgDetail.original_language"
              placeholder="请选择语言"
              allow-create
              clearable
              :disabled="ban"
            >
              <el-option label="中文" value="zh"></el-option>
              <el-option label="英文" value="en"></el-option>
              <el-option label="日文" value="ja"></el-option>
            </el-select> -->
              <el-input v-model="msgDetail.original_language"></el-input>
            </el-form-item>
            <el-form-item label="原文出版时间">
              <!-- <el-date-picker
                v-model="msgDetail.original_time"
                type="year"
                placeholder="请选择年份"
                format="YYYY"
                value-format="YYYY"
                style="width: 200px"
              ></el-date-picker> -->
              <el-input
                v-model="msgDetail.original_time"
                placeholder="请输入原文出版年份"
                style="width: 200px"
                :disabled="ban"
              ></el-input>
            </el-form-item>
            <el-form-item label="原文来源">
              <el-input v-model="msgDetail.original_source"></el-input>
            </el-form-item>
          </el-row>
          <!-- <el-form-item label="原文出版社">
          <el-input v-model="msgDetail.publisher"></el-input>
        </el-form-item>
        <el-form-item label="原文期刊名称">
          <el-input v-model="msgDetail.journalName"></el-input>
        </el-form-item>
        <el-form-item label="原文URL">
          <el-input v-model="msgDetail.url"></el-input>
        </el-form-item>
        <el-form-item label="原文字数">
          <el-input-number
            v-model="msgDetail.word_number"
            :min="0"
            label="描述文字"
          ></el-input-number>
        </el-form-item> -->
        </div>

        <el-form-item label="附件">
          <el-link
            class="linkCss"
            v-for="(item, index) in msgDetail.attachment"
            :key="index"
            @click="openFile(item)"
            >{{ getFileName(item) }}</el-link
          >
        </el-form-item>
        <!-- <el-upload
            v-model:file-list="msgDetail.file"
            class="upload-demo"
            :auto-upload="false"
            :show-file-list="true"
            :on-preview="handlePreview"
            multiple
          >
            <el-button type="primary">上传附件</el-button>
          </el-upload> -->
        <!-- <el-form-item>
          <el-button type="success" @click="onSubmit()">提交</el-button>
        </el-form-item> -->
      </el-form>
      <!-- <el-form label-width="80px" :model="msgDetail">
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="作者">
              <span class="text">{{ msgDetail.author }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="中文标题">
              <span class="text">{{ msgDetail.title_cn }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="英文标题">
              <span class="text">{{ msgDetail.title_en }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="编者">
              <span class="text">{{ msgDetail.editor }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="中文摘要">
              <span class="text">{{ msgDetail.abstract_cn }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="英文摘要">
              <span class="text">{{ msgDetail.abstract_en }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="附件">
              <a
                class="linkCss"
                v-for="(item, index) in msgDetail.attachment"
                @click="openFile(item)"
                target="_blank"
                >{{ getFileName(item) }}</a
              >
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="来源">
              <span class="text">{{ msgDetail.original_source }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="出版时间">
              <span class="text">{{ msgDetail.original_time }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
        <el-form-item>
          <el-col :span="8">
            <el-form-item label="类型">
              <span class="text">{{ msgDetail.category_name }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="语言">
              <span class="text">{{ msgDetail.language }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="译者">
              <span class="text">{{ msgDetail.translator }}</span>
            </el-form-item>
          </el-col>
        </el-form-item>
      </el-form> -->
      <div class="buttons">
        <el-button type="primary" role="button" tabindex="0" @click="updateCorpus()"
          >更新</el-button
        >
        <el-button type="success" role="button" tabindex="0" @click="VerifyPer()">通过</el-button>
        <el-button type="danger" role="button" tabindex="0" @click="innerVisible = true"
          >驳回</el-button
        >
      </div>
      <el-dialog v-model="innerVisible" width="500" modal="false" title="驳回理由" append-to-body>
        <el-mention
          v-model="reason"
          type="textarea"
          :options="options"
          style="width: 100%; height: 200px"
          placeholder="请输入驳回理由"
        />
        <div class="tips">
          <el-button
            v-for="(item, index) in predefinedReasons"
            :key="index"
            type="info"
            plain
            size="small"
            @click="reason = item"
          >
            {{ item }}
          </el-button>
        </div>
        <div class="buttons">
          <el-button
            type="success"
            role="button"
            tabindex="0"
            @click="((innerVisible = false), (reason = ''))"
            >取消</el-button
          >
          <el-button type="danger" role="button" tabindex="0" @click="rejectVerifyPer()"
            >驳回</el-button
          >
        </div>
      </el-dialog>
    </el-drawer>
    <file-edit ref="fileEditRef" :title="'查看详情'">
      <template #extra>
        <div class="buttons2">
          <el-button type="success" role="button" tabindex="0" @click="VerifyPer()">通过</el-button>
          <el-button type="danger" role="button" tabindex="0" @click="innerVisible = true"
            >驳回</el-button
          >
        </div>
        <!-- <el-button type="primary" @click="openDialog()">语音输入</el-button> -->
      </template>
    </file-edit>
  </div>
</template>

<script setup>
import FileEdit from '@/views/UploadView/FileManage/components/FileEdit.vue'
import { ref } from 'vue'

const toShow = (row) => {
  // console.log(row)
  row.judgeFlag = false
  fileEditRef.value.open(row)
}

const fileEditRef = ref()
</script>

<script>
import {
  getExamineRecoveryService,
  getExamineRecoveryDecisionService,
  deleteExamineRecoveryService,
  startExamineRecoveryAiClassifyService,
  getExamineRecoveryAiClassifyProgressService,
  stopExamineRecoveryAiClassifyService,
} from '@/api/admin.js'
import { corpusDetailService, getCorpusFileService, corpusUpdateService } from '@/api/collector.js'
import { getUserAvatar } from '@/api/user'
export default {
  name: 'VerifyPeople',
  data() {
    return {
      currentPage: 1,
      total: 100,
      pageSize: 10,
      reason: '',
      predefinedReasons: ['信息不完整', '与要求不符', '请补充材料', '其他'],

      msgHistoryWithPic: [],
      selectCategory: 'name',
      content: '',
      innerVisible: false,
      dialogVisiblePerson: false,
      attachment: [
        'uploaded_files/corpus/collector/2025/02/06/20/23/54/gray_image.png',
        'uploaded_files/corpus/collector/2025/02/06/20/23/54/gray_image.png',
      ],
      msgDetail: {},
      imgUrl: '',
      formModel: {}, //条件选择
      selectedArr: [],
      adminList: [],
      currentPage: 1,
      totalPage: 0,
      filename: '',
      // 添加搜索参数
      searchParams: {
        title: '',      // 标题模糊查询
        language: '',   // 语言筛选
        author: ''      // 作者/编者/译者模糊查询
      },
      // AI 批量归类
      aiDialogVisible: false,
      aiStarting: false,
      aiStopping: false,
      aiTimer: null,
      aiTaskId: '',
      aiMissCount: 0,
      aiState: {},
      aiForm: {
        limit: 100,
        auto_approve: true,
        min_confidence: 0,
        model: 'qwen3.8-flash',
        only_unassigned: true,
      },
    }
  },
  methods: {
    // 将数据库对象数组转换为整数ID数组
    convertDatabaseIds(databaseArray) {
      if (!Array.isArray(databaseArray)) return [];
      return databaseArray.map(item => parseInt(item.database_id));
    },

    async getList(data) {
      const res = await getExamineRecoveryService({ ...data });
      this.total = res.data.data.total || 0;
      this.adminList = res.data.data.data || [];
    },

    // 新增搜索方法
    handleSearch() {
      // 构建搜索条件
      const searchData = {
        page_num: this.currentPage,
        page_size: this.pageSize
      };

      // 添加标题搜索条件（合并原文标题和译文标题）
      if (this.searchParams.title) {
        searchData.title = this.searchParams.title;
      }

      // 添加语言筛选条件
      if (this.searchParams.language) {
        searchData.language = this.searchParams.language;
      }

      // 添加作者/编者/译者模糊查询条件
      if (this.searchParams.author) {
        searchData.author = this.searchParams.author;
      }

      this.getList(searchData);
    },

    // 重置搜索条件
    resetSearch() {
      this.searchParams = {
        title: '',
        language: '',
        author: ''
      };
      this.currentPage = 1;
      this.getList();
    },

    //页大小改变的时候
    handleSizeChange(pageSize) {
      this.pageSize = pageSize;
      this.formModel.page_size = pageSize;
      this.handleSearch(); // 使用新的搜索方法
    },
    //页数改变时候
    pageChange(page) {
      this.currentPage = page;
      this.formModel.page_num = page;
      this.handleSearch(); // 使用新的搜索方法
    },
    //输入框刷新
    reFresh() {
      this.content = '';
      this.getList();
    },
    //条件查询语料
    serachPeople() {
      if (this.selectCategory) {
        this.formModel = {};
        this.formModel[this.selectCategory] = this.content;
      }
      console.log(this.formModel);
      this.getList(this.formModel);
    },
    //获取语料具体信息
    async handleDetail(index, msg) {
      this.dialogVisiblePerson = true;
      this.msgDetail = msg;
      const res = await corpusDetailService({
        corpus_id: msg.corpus_id,
      });
      this.msgDetail = { ...msg, ...res.data.data };
      // this.msgDetail.publish_time += '-01-01';
      // this.msgDetail.original_time += '-01-01';
      // 处理数据库ID数组
      if (this.msgDetail.database && Array.isArray(this.msgDetail.database)) {
        this.msgDetail.database_id = this.convertDatabaseIds(this.msgDetail.database);
      }
      // console.log(res.data.data.files[0].filename)
      this.filename = res.data.data.files[0].filename;
    },
    //通过语料审核
    async VerifyPer() {
      try {
        // 等待删除请求完成
        const response = await getExamineRecoveryDecisionService({
          corpus_id: this.msgDetail.id,
          approve: true  // 使用布尔值true表示通过
        });

        if (response.data && response.data.code === 200) {
          // 关闭弹窗
          this.dialogVisiblePerson = false;
          // 获取最新数据
          await this.getList();
          // 强制刷新数组，确保 Vue 监听到变化
          this.adminList = [...this.adminList];
          ElMessage.success('审核通过');
          console.log('审核通过');
        } else {
          ElMessage.error(response.data?.message || '审核失败');
        }
      } catch (error) {
        console.error('审核失败', error);
        ElMessage.error('审核失败，请重试！');
      }
    },
    //驳回语料审核
    async rejectVerifyPer() {
      try {
        // 等待删除请求完成
        const response = await getExamineRecoveryDecisionService({
          corpus_id: this.msgDetail.id,
          approve: false,  // 使用布尔值false表示驳回
          comment: this.reason
        });

        if (response.data && response.data.code === 200) {
          // 关闭弹窗
          this.innerVisible = false;
          this.dialogVisiblePerson = false;
          // 获取最新数据
          await this.getList();
          // 强制刷新数组，确保 Vue 监听到变化
          this.adminList = [...this.adminList];
          ElMessage.success('驳回成功');
          console.log('数据已更新');
        } else {
          ElMessage.error(response.data?.message || '驳回失败');
        }
      } catch (error) {
        console.error('驳回失败', error);
        ElMessage.error('驳回失败，请重试！');
      }
    },
    //删除恢复语料
    async deleteRecoveryCorpus(corpusId) {
      try {
        await this.$confirm(
          '确定要删除这条恢复语料吗？此操作不可撤销！',
          '删除确认',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning',
          }
        );

        const response = await deleteExamineRecoveryService({
          corpus_id: corpusId
        });

        if (response.data && response.data.code === 200) {
          ElMessage.success('删除成功');
          // 获取最新数据
          await this.getList();
          // 强制刷新数组，确保 Vue 监听到变化
          this.adminList = [...this.adminList];
        } else {
          ElMessage.error(response.data?.message || '删除失败');
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除失败', error);
          ElMessage.error('删除失败，请重试！');
        }
      }
    },
    //更新语料信息
    async updateCorpus() {
      try {
        // 准备更新数据
        const updateData = {
          corpus_id: this.msgDetail.id,
          title_cn: this.msgDetail.title_cn,
          title_en: this.msgDetail.title_en,
          language: this.msgDetail.language,
          translator: this.msgDetail.translator,
          author: this.msgDetail.author,
          editor: this.msgDetail.editor,
          ISSN: this.msgDetail.ISSN,
          category_id: this.msgDetail.category_id,
          publish_time: this.msgDetail.publish_time,
          volume: this.msgDetail.volume,
          issue: this.msgDetail.issue,
          source: this.msgDetail.source,
          database_id: this.msgDetail.database_id,
          keyword_cn: this.msgDetail.keyword_cn,
          keyword_en: this.msgDetail.keyword_en,
          abstract_cn: this.msgDetail.abstract_cn,
          abstract_en: this.msgDetail.abstract_en,
          original_name: this.msgDetail.original_name,
          original_language: this.msgDetail.original_language,
          original_time: this.msgDetail.original_time,
          original_source: this.msgDetail.original_source,
        };

        // 调用更新接口
        const response = await corpusUpdateService(updateData);

        if (response.data && response.data.code === 200) {
          ElMessage.success('更新成功');
          // 关闭弹窗
          // this.dialogVisiblePerson = false;
          // 获取最新数据
          await this.getList();
          // 强制刷新数组，确保 Vue 监听到变化
          this.adminList = [...this.adminList];
        } else {
          ElMessage.error(response.data?.message || '更新失败');
        }
      } catch (error) {
        console.error('更新失败', error);
        ElMessage.error('更新失败，请重试！');
      }
    },
    //文件预览
    async openFile(filePath) {
      try {
        // 立即打开新页面
        // const newWindow = window.open('', '_blank')

        // // 在新页面中显示加载状态
        // newWindow.document.write('Loading...')
        const res = await getCorpusFileService({
          corpus_id: this.msgDetail.id,
          attachment_path: filePath,
        });

        // 处理 Blob 数据
        const blob = new Blob([res.data], { type: res.headers['content-type'] });
        const fileUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = this.filename;
        document.body.appendChild(a);
        a.click();
        // 在新页面中打开文件
        // newWindow.location.href = fileUrl;
        // // 在新窗口打开文件
        // window.open(fileUrl, "_blank");
      } catch (error) {
        console.error('文件预览失败', error);
        // 在新页面中显示错误信息
        // newWindow.document.write('文件加载失败，请重试。')
      }
    },
    //获取文件名字
    getFileName(filePath) {
      const formattedPath = filePath.replace(/\\/g, '/'); // 将反斜杠替换为斜杠
      console.log(formattedPath.split('/').pop());
      return formattedPath.split('/').pop(); // 提取文件名
    },
    //表单多选删除使用
    handleSelectionChange() {},
    // 打开 AI 归类参数弹窗，若已有任务在跑则直接展示进度
    async openAiClassify() {
      const finished = await this.refreshAiTask();
      // 上次任务已结束则回到参数表单，避免误以为任务仍在进行
      if (finished) this.aiState = {};
      this.aiDialogVisible = true;
    },
    // 启动 AI 批量归类任务
    async startAiClassify() {
      this.aiStarting = true;
      try {
        const res = await startExamineRecoveryAiClassifyService({
          ...this.searchParams,
          ...this.aiForm,
        });
        if (res.data && res.data.code === 200) {
          this.aiState = res.data.data || {};
          // 记住任务号，后续轮询直接按它取，避免取到别的任务或读不到
          this.aiTaskId = this.aiState.task_id || '';
          this.aiMissCount = 0;
          ElMessage.success('归类任务已启动，正在后台处理');
          this.startAiPolling();
        } else {
          ElMessage.error(res.data?.error || '启动失败');
        }
      } catch (error) {
        console.error('启动 AI 归类失败', error);
        ElMessage.error(error?.response?.data?.error || '启动失败，请稍后重试');
      } finally {
        this.aiStarting = false;
      }
    },
    // 轮询任务进度
    startAiPolling() {
      this.stopAiPolling();
      this.aiTimer = setInterval(async () => {
        const finished = await this.refreshAiTask();
        if (finished) {
          this.stopAiPolling();
        }
      }, 2000);
    },
    stopAiPolling() {
      if (this.aiTimer) {
        clearInterval(this.aiTimer);
        this.aiTimer = null;
      }
    },
    // 拉取一次进度，返回任务是否已结束
    async refreshAiTask() {
      try {
        const params = this.aiTaskId ? { task_id: this.aiTaskId } : {};
        const res = await getExamineRecoveryAiClassifyProgressService(params);
        const data = res.data && res.data.code === 200 ? res.data.data : null;
        if (!data) {
          // 偶发读不到时不立刻停轮询，避免界面冻在起始状态
          this.aiMissCount += 1;
          return this.aiMissCount >= 3;
        }
        this.aiMissCount = 0;
        if (!this.aiTaskId && data.task_id) this.aiTaskId = data.task_id;
        const wasRunning = this.aiRunning;
        this.aiState = data;
        // 任务结束时刷新列表，并直接提示结果，避免用户只看顶部标签不知道已中止
        if (wasRunning && !this.aiRunning) {
          if (data.status === 'error') {
            ElMessage.error(data.message || '归类任务异常终止');
          } else if (data.status === 'stopped') {
            ElMessage.warning(`归类任务已停止，已处理 ${data.processed} 条`);
          } else if (!data.total) {
            // 没有可选目标时说明是筛选条件导致，而非任务失败
            ElMessage.warning({
              message: '当前筛选下没有可处理的文献（都已关联数据库）。若要重新判定这些文献，请关闭「只处理未关联库」后再发起。',
              duration: 6000,
            });
          } else {
            ElMessage.success(
              `归类完成：通过 ${data.approved || 0} 条，待人工 ${data.pending || 0} 条，失败 ${
                data.failed || 0
              } 条`
            );
          }
          this.getList(this.searchParams);
        }
        return !this.aiRunning;
      } catch (error) {
        console.error('获取归类进度失败', error);
        return true;
      }
    },
    // 停止归类任务
    async stopAiClassify() {
      this.aiStopping = true;
      try {
        const res = await stopExamineRecoveryAiClassifyService({ task_id: this.aiState.task_id });
        if (res.data && res.data.code === 200) {
          ElMessage.success('已发出停止指令，当前批次结束后停止');
          this.aiState = res.data.data || this.aiState;
        } else {
          ElMessage.error(res.data?.error || '停止失败');
        }
      } catch (error) {
        console.error('停止归类失败', error);
        ElMessage.error('停止失败，请稍后重试');
      } finally {
        this.aiStopping = false;
      }
    },
    // 关闭弹窗：运行中则转入后台，结束后复位以便再次发起
    closeAiDialog() {
      this.aiDialogVisible = false;
      if (!this.aiRunning) {
        this.aiState = {};
        this.aiTaskId = '';
        this.aiMissCount = 0;
      }
    },
    // 结束查看上次结果，回到参数表单重新发起
    resetAiTask() {
      this.aiState = {};
      this.aiTaskId = '';
      this.aiMissCount = 0;
    },
    aiActionText(action) {
      const map = {
        approved: '已通过',
        classified: '仅归类',
        low_confidence: '待确认',
        pending: '待人工',
        failed: '失败',
      };
      return map[action] || '—';
    },
    aiActionType(action) {
      const map = {
        approved: 'success',
        classified: 'info',
        low_confidence: 'warning',
        pending: 'warning',
        failed: 'danger',
      };
      return map[action] || 'info';
    },
  },
  computed: {
    // 任务是否仍在执行
    aiRunning() {
      return ['running', 'stopping'].includes(this.aiState.status);
    },
    aiPercent() {
      const total = this.aiState.total || 0;
      if (!total) return 0;
      return Math.min(100, Math.floor(((this.aiState.processed || 0) / total) * 100));
    },
    aiProgressStatus() {
      if (this.aiState.status === 'error') return 'exception';
      return this.aiPercent >= 100 && !this.aiRunning ? 'success' : '';
    },
    aiScopeText() {
      const parts = [];
      if (this.searchParams.title) parts.push(`标题含「${this.searchParams.title}」`);
      if (this.searchParams.language) parts.push(`语言为「${this.searchParams.language}」`);
      if (this.searchParams.author) parts.push(`作者/编者/译者含「${this.searchParams.author}」`);
      return parts.length ? `当前筛选：${parts.join('，')}` : '全部待审核的历史数据文献';
    },
  },
  mounted() {
    // this.getMessageList(1);
    this.handleSearch(); // 使用新的搜索方法初始化数据
    // 进入页面时接续可能仍在运行的后台任务
    this.refreshAiTask().then((finished) => {
      if (finished) {
        this.aiState = {};
      } else {
        this.startAiPolling();
      }
    });
  },
  beforeUnmount() {
    this.stopAiPolling();
  },
}
</script>

<style scoped>
.linkCss {
  cursor: pointer;
  display: block;
  margin-bottom: 9px;
}
.box {
  padding: 10px;
  /* background-color: #D3D3D3; */
  color: white;
  background: linear-gradient(to bottom, #005767, white);
  /* c2e6ec  */
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}
.tips {
  margin-bottom: 50px;
}
.title {
  float: left;
  width: 400px;
  line-height: 50px;
  font-weight: bold;
  margin-left: 10px;
  font-size: 24px;
}
.handle-box {
  margin-bottom: 10px;
  line-height: 50px;
  float: right;
  padding-right: 10px;
}
::v-deep .el-form-item__label {
  color: #000;
}
.red {
  color: #ff0000;
}
.handle-select {
  width: 120px;
}
.handle-input {
  width: 300px;
  display: inline-block;
}
.mr10 {
  margin-right: 10px;
}
.footer {
  text-align: center;
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
.buttons {
  width: 80%;
  margin: auto;
  display: flex;
  justify-content: space-evenly;
}
.buttons2 {
  display: flex;
  justify-content: center; /* 水平居中 */
}
::v-deep .el-textarea__inner {
  min-height: 200px !important;
}
/* AI 批量归类 */
.ai-bar {
  clear: both;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 4px;
}
.ai-hint {
  color: #5b6b70;
  font-size: 12px;
  line-height: 1.6;
}
.ai-hint.inline {
  margin-left: 12px;
}
.ai-running-tag {
  cursor: pointer;
}
.ai-scope {
  color: #303133;
  font-size: 13px;
}
.ai-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 6px;
}
.ai-msg {
  margin: 0 0 10px;
  color: #606266;
  font-size: 12px;
}
.ai-linked {
  margin-left: 6px;
  color: #909399;
  font-size: 12px;
}
.ai-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: #ffffff;
  animation: ai-blink 1s ease-in-out infinite;
}
@keyframes ai-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}
</style>
