<template>
  <div class="workload-stats-container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>工作量统计</span>
        </div>
      </template>

      <el-tabs v-model="isRecovery" @tab-change="fetchStats">
        <el-tab-pane label="历史数据审核" :name="1" />
        <el-tab-pane label="语料审核" :name="0" />
      </el-tabs>

      <div v-if="loading" class="loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      </div>

      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="error"
      />

      <el-table v-else :data="reviewerStats" border style="width: 100%">
        <el-table-column prop="reviewer_name" label="审核人" min-width="160" />
        <el-table-column prop="approved_count" label="通过数" min-width="120" />
        <el-table-column prop="rejected_count" label="驳回数" min-width="120" />
        <el-table-column label="合计" min-width="120">
          <template #default="{ row }">
            {{ (row.approved_count || 0) + (row.rejected_count || 0) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { getExamineRecoveryStatsService } from '@/api/admin';

const loading = ref(true);
const error = ref('');
const reviewerStats = ref([]);
const isRecovery = ref(1);

const fetchStats = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await getExamineRecoveryStatsService({
      is_recovery: Number(isRecovery.value),
    });

    if (response.data && response.data.code === 200) {
      reviewerStats.value = response.data.data || [];
    } else {
      error.value = response.data?.message || response.data?.error || '获取统计数据失败';
      reviewerStats.value = [];
    }
  } catch (err) {
    console.error('获取统计数据失败:', err);
    error.value = '网络请求失败，请稍后重试';
    reviewerStats.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(fetchStats);
</script>

<style scoped>
.workload-stats-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.error {
  margin-bottom: 20px;
}
</style>
