<template>
  <div class="batch-results-container">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" text @click="goBack">
          返回列表
        </el-button>
        <h2 class="page-title">批量处理结果</h2>
        <el-tag size="large" type="info">批次号：{{ batchNo }}</el-tag>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="loadData">
          刷新结果
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="summary-row">
      <el-col :span="6">
        <el-card class="summary-card" :body-style="{ padding: '20px' }">
          <div class="summary-content">
            <div class="summary-icon" style="background: #409EFF;">
              <el-icon :size="24" color="#fff"><Tickets /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-value" style="color: #409EFF;">{{ results.length }}</div>
              <div class="summary-label">处理总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card" :body-style="{ padding: '20px' }">
          <div class="summary-content">
            <div class="summary-icon" style="background: #67C23A;">
              <el-icon :size="24" color="#fff"><CircleCheck /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-value" style="color: #67C23A;">{{ successCount }}</div>
              <div class="summary-label">成功</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card" :body-style="{ padding: '20px' }">
          <div class="summary-content">
            <div class="summary-icon" style="background: #F56C6C;">
              <el-icon :size="24" color="#fff"><CircleClose /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-value" style="color: #F56C6C;">{{ failCount }}</div>
              <div class="summary-label">失败</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card" :body-style="{ padding: '20px' }">
          <div class="summary-content">
            <div class="summary-icon" style="background: #E6A23C;">
              <el-icon :size="24" color="#fff"><TrendCharts /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-value" style="color: #E6A23C;">{{ successRate }}%</div>
              <div class="summary-label">成功率</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon><List /></el-icon>
            处理明细
          </span>
          <el-radio-group v-model="filterType" size="small" @change="handleFilterChange">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="success">成功</el-radio-button>
            <el-radio-button value="fail">失败</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-table :data="filteredResults" v-loading="loading" stripe border>
        <el-table-column type="index" label="序号" width="60" align="center" />
        
        <el-table-column prop="clue_no" label="线索单号" width="140">
          <template #default="{ row }">
            <el-link 
              v-if="row.clue_id" 
              type="primary" 
              @click="goToDetail(row.clue_id)"
            >
              {{ row.clue_no }}
            </el-link>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />

        <el-table-column label="处理结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag 
              :type="row.success ? 'success' : 'danger'" 
              size="small"
              effect="light"
            >
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="error_code" label="错误码" width="140">
          <template #default="{ row }">
            <span v-if="row.error_code" style="color: #F56C6C;">
              {{ row.error_code }}
            </span>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="error_message" label="错误原因" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.error_message" style="color: #F56C6C;">
              {{ row.error_message }}
            </span>
            <span v-else style="color: #67C23A;">
              处理成功
            </span>
          </template>
        </el-table-column>

        <el-table-column label="新状态" width="120">
          <template #default="{ row }">
            <template v-if="row.success && row.new_status">
              <el-tag 
                size="small"
                :style="{ 
                  background: STATUS_COLORS[row.new_status] + '20', 
                  color: STATUS_COLORS[row.new_status], 
                  borderColor: STATUS_COLORS[row.new_status] 
                }"
              >
                {{ STATUS_LABELS[row.new_status] }}
              </el-tag>
            </template>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="新版本" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.success && row.new_version">
              v{{ row.new_version }}
            </span>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="operator_name" label="操作人" width="100" />

        <el-table-column prop="created_at" label="处理时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.clue_id" 
              type="primary" 
              size="small" 
              link
              @click="goToDetail(row.clue_id)"
            >
              查看详情
            </el-button>
            <el-button 
              v-if="!row.success && row.clue_id" 
              type="warning" 
              size="small" 
              link
              @click="goToDetail(row.clue_id)"
            >
              去补正
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="failCount > 0" class="error-tips-card">
      <el-alert 
        title="失败处理说明" 
        type="warning" 
        :closable="false"
        show-icon
      >
        <template #default>
          <ul>
            <li>• <strong>NOT_FOUND</strong>：线索单不存在，可能已被删除</li>
            <li>• <strong>OVERDUE</strong>：线索单已逾期，需进入详情页单独处理</li>
            <li>• <strong>VALIDATION_FAILED</strong>：校验失败，请查看具体错误原因</li>
            <li>• <strong>PROCESS_ERROR</strong>：处理过程中出错，请重试</li>
            <li>• <strong>SYSTEM_ERROR</strong>：系统错误，请联系管理员</li>
          </ul>
          <p style="margin-top: 8px;">
            <strong>注意：</strong>逾期线索单必须进入详情页单独处理，不能批量推进。
            点击"去补正"按钮可直接进入详情页处理。
          </p>
        </template>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  ArrowLeft, Refresh, Tickets, CircleCheck, CircleClose,
  TrendCharts, List
} from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import { getBatchResults } from '../api/clues';
import { STATUS_LABELS, STATUS_COLORS } from '../utils/config';

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const results = ref([]);
const filterType = ref('all');

const batchNo = computed(() => route.params.batchNo);

const successCount = computed(() => 
  results.value.filter(r => r.success).length
);

const failCount = computed(() => 
  results.value.filter(r => !r.success).length
);

const successRate = computed(() => {
  if (results.value.length === 0) return 0;
  return ((successCount.value / results.value.length) * 100).toFixed(1);
});

const filteredResults = computed(() => {
  if (filterType.value === 'all') return results.value;
  if (filterType.value === 'success') return results.value.filter(r => r.success);
  if (filterType.value === 'fail') return results.value.filter(r => !r.success);
  return results.value;
});

function formatDate(date) {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

function goBack() {
  router.push('/clues');
}

function goToDetail(clueId) {
  router.push(`/clues/${clueId}`);
}

function handleFilterChange() {
  // 无需额外处理，computed 会自动更新
}

async function loadData() {
  loading.value = true;
  try {
    const res = await getBatchResults(batchNo.value);
    results.value = res.data;
  } catch (e) {
    console.error('加载批量结果失败:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.batch-results-container {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.header-right {
  display: flex;
  gap: 12px;
}

.summary-row {
  margin-bottom: 16px;
}

.summary-card {
  border-radius: 8px;
}

.summary-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.summary-label {
  font-size: 13px;
  color: #909399;
  margin-top: 2px;
}

.table-card {
  border-radius: 8px;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.error-tips-card {
  border-radius: 8px;
}

.error-tips-card ul {
  margin: 8px 0;
  padding-left: 20px;
}

.error-tips-card li {
  padding: 2px 0;
  color: #606266;
  font-size: 13px;
}
</style>
