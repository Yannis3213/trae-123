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

        <el-table-column label="线索单号" width="140">
          <template #default="{ row }">
            <el-link
              v-if="row.clue_id"
              type="primary"
              @click="goToDetail(row.clue_id)"
            >
              {{ row.clue_no || row.current_clue_no || '-' }}
            </el-link>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />

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

        <el-table-column label="状态流转" width="200">
          <template #default="{ row }">
            <template v-if="row.from_status">
              <el-tag size="small" effect="plain">
                {{ STATUS_LABELS[row.from_status] }}
              </el-tag>
              <span style="margin: 0 4px; color: #909399;">→</span>
              <el-tag
                v-if="row.success && row.to_status"
                size="small"
                type="success"
              >
                {{ STATUS_LABELS[row.to_status] }}
              </el-tag>
              <el-tag
                v-else-if="row.to_status"
                size="small"
                type="info"
                effect="plain"
              >
                目标: {{ STATUS_LABELS[row.to_status] }}
              </el-tag>
            </template>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="当前状态" width="110">
          <template #default="{ row }">
            <el-tag
              v-if="row.current_status"
              size="small"
              :style="{
                background: STATUS_COLORS[row.current_status] + '20',
                color: STATUS_COLORS[row.current_status],
                borderColor: STATUS_COLORS[row.current_status]
              }"
            >
              {{ STATUS_LABELS[row.current_status] }}
            </el-tag>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="当前处理人" width="110">
          <template #default="{ row }">
            <span v-if="row.current_handler_name">{{ row.current_handler_name }}</span>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="版本" width="110" align="center">
          <template #default="{ row }">
            <span v-if="row.old_version != null">
              v{{ row.old_version }}
              <span style="color: #909399;">→</span>
              <span v-if="row.success && row.new_version" style="color: #67C23A; font-weight: 600;">
                v{{ row.new_version }}
              </span>
              <span v-else-if="row.current_version != null" style="color: #909399;">
                现v{{ row.current_version }}
              </span>
              <span v-else style="color: #909399;">未变</span>
            </span>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="异常类型" width="110">
          <template #default="{ row }">
            <el-tag
              v-if="row.abnormal_type"
              size="small"
              type="warning"
              effect="plain"
            >
              {{ ABNORMAL_LABELS[row.abnormal_type] }}
            </el-tag>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="error_code" label="错误码" width="160">
          <template #default="{ row }">
            <span v-if="row.error_code" style="color: #F56C6C; font-family: monospace; font-size: 12px;">
              {{ row.error_code }}
            </span>
            <span v-else style="color: #c0c4cc;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="失败原因 / 处理说明" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <el-popover
              v-if="row.error_message"
              placement="top-start"
              :width="300"
              trigger="hover"
            >
              <template #reference>
                <span style="color: #F56C6C; cursor: help;">
                  {{ row.error_message }}
                </span>
              </template>
              <div style="font-size: 13px; line-height: 1.6;">
                <strong>失败原因：</strong>{{ row.error_message }}
                <div v-if="getErrorSuggestion(row.error_code)" style="margin-top: 6px; color: #E6A23C;">
                  <strong>建议操作：</strong>{{ getErrorSuggestion(row.error_code) }}
                </div>
              </div>
            </el-popover>
            <span v-else style="color: #67C23A;">
              处理成功
              <span v-if="row.to_status">，已流转至「{{ STATUS_LABELS[row.to_status] }}」</span>
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="operator_name" label="操作人" width="90" />

        <el-table-column prop="created_at" label="处理时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-btns">
              <el-button
                v-if="row.clue_id"
                type="primary"
                size="small"
                link
                @click="goToDetail(row.clue_id)"
              >
                查看
              </el-button>
              <el-button
                v-if="!row.success && row.clue_id && canRectify(row)"
                type="warning"
                size="small"
                link
                @click="goToDetail(row.clue_id)"
              >
                去补正
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="failCount > 0" class="error-tips-card">
      <el-alert
        title="失败处理说明（按错误码对照处理）"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #default>
          <el-table :data="errorExplanations" size="small" border>
            <el-table-column prop="code" label="错误码" width="170" />
            <el-table-column prop="label" label="含义" width="160" />
            <el-table-column prop="suggestion" label="建议处理方式" />
          </el-table>
          <p style="margin-top: 8px;">
            <strong>注意：</strong>逾期线索单必须进入详情页单独处理，不能批量推进。节点超时落到责任人处理。
            点击"去补正"按钮可直接进入详情页，补正材料后再执行相关动作。
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
import { STATUS_LABELS, STATUS_COLORS, ABNORMAL_LABELS } from '../utils/config';

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const results = ref([]);
const filterType = ref('all');

const batchNo = computed(() => route.params.batchNo);

const errorExplanations = [
  { code: 'NOT_FOUND', label: '线索单不存在', suggestion: '线索单可能已被删除，请核对列表页数据' },
  { code: 'OVERDUE', label: '逾期未处理', suggestion: '点击「去补正」进入详情页，完成节点超时处理（节点超时落到责任人）' },
  { code: 'PERMISSION_DENIED', label: '无权处理/非当前处理人', suggestion: '请确认当前角色和处理人分配，切换到正确账号或等待对应人员处理' },
  { code: 'STATUS_CONFLICT', label: '状态冲突/非法流转', suggestion: '进入详情页查看当前状态，按正确的流转顺序操作' },
  { code: 'VERSION_CONFLICT', label: '版本冲突', suggestion: '刷新页面获取最新版本后重试，避免多人并发修改' },
  { code: 'MISSING_MATERIAL', label: '缺材料/必填附件', suggestion: '进入详情页「附件资料」补充缺失附件后重新操作' },
  { code: 'PROCESS_ERROR', label: '处理过程异常', suggestion: '刷新列表重试，或联系管理员检查日志' },
  { code: 'SYSTEM_ERROR', label: '系统异常', suggestion: '联系管理员检查后端服务' }
];

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
}

function canRectify(row) {
  if (!row || !row.error_code) return false;
  return ['OVERDUE', 'MISSING_MATERIAL', 'STATUS_CONFLICT', 'VERSION_CONFLICT', 'PROCESS_ERROR'].includes(row.error_code);
}

function getErrorSuggestion(errorCode) {
  const item = errorExplanations.find(e => e.code === errorCode);
  return item ? item.suggestion : '';
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

.action-btns {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.error-tips-card {
  border-radius: 8px;
}

.error-tips-card :deep(.el-table) {
  margin: 8px 0;
}
</style>
