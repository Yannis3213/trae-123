<template>
  <div class="clue-list-container">
    <div class="page-header">
      <h2>招商线索单列表</h2>
      <div class="header-actions">
        <el-button type="primary" :icon="Refresh" @click="loadData">
          刷新列表
        </el-button>
        <el-button 
          type="danger" 
          :icon="Promotion" 
          :disabled="selectedIds.length === 0"
          @click="openBatchDialog"
        >
          批量推进 ({{ selectedIds.length }})
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="3" v-for="stat in displayStats" :key="stat.key">
        <el-card class="stat-card" :body-style="{ padding: '16px' }">
          <div class="stat-content">
            <div class="stat-icon" :style="{ background: stat.color }">
              <el-icon :size="22" color="#fff">
                <component :is="stat.icon" />
              </el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select 
            v-model="filters.status" 
            placeholder="全部状态" 
            clearable
            style="width: 140px"
          >
            <el-option 
              v-for="(label, value) in STATUS_LABELS" 
              :key="value" 
              :label="label" 
              :value="value" 
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="优先级">
          <el-select 
            v-model="filters.priority" 
            placeholder="全部优先级" 
            clearable
            style="width: 120px"
          >
            <el-option 
              v-for="(label, value) in PRIORITY_LABELS" 
              :key="value" 
              :label="label" 
              :value="value" 
            />
          </el-select>
        </el-form-item>

        <el-form-item label="线索类型">
          <el-select 
            v-model="filters.clue_type" 
            placeholder="全部类型" 
            clearable
            style="width: 140px"
          >
            <el-option 
              v-for="(label, value) in CLUE_TYPE_LABELS" 
              :key="value" 
              :label="label" 
              :value="value" 
            />
          </el-select>
        </el-form-item>

        <el-form-item label="到期状态">
          <el-select 
            v-model="filters.expiry_status" 
            placeholder="全部" 
            clearable
            style="width: 120px"
          >
            <el-option label="正常" value="normal" />
            <el-option label="临期(≤3天)" value="urgent" />
            <el-option label="已逾期" value="overdue" />
          </el-select>
        </el-form-item>

        <el-form-item label="关键词">
          <el-input 
            v-model="filters.keyword" 
            placeholder="搜索线索单号/标题/企业" 
            clearable
            style="width: 220px"
            @keyup.enter="loadData"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table 
        ref="tableRef"
        :data="clueList" 
        v-loading="loading"
        @selection-change="handleSelectionChange"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column type="selection" width="50" />
        
        <el-table-column prop="clue_no" label="线索单号" width="140" fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="goToDetail(row.id)">
              {{ row.clue_no }}
            </el-link>
          </template>
        </el-table-column>

        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        
        <el-table-column prop="clue_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ CLUE_TYPE_LABELS[row.clue_type] }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="priority" label="优先级" width="90">
          <template #default="{ row }">
            <el-tag 
              size="small" 
              :type="row.priority === 'high' ? 'danger' : row.priority === 'medium' ? 'warning' : 'success'"
            >
              {{ PRIORITY_LABELS[row.priority] }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag 
              size="small" 
              :style="{ background: STATUS_COLORS[row.status] + '20', color: STATUS_COLORS[row.status], borderColor: STATUS_COLORS[row.status] }"
            >
              {{ STATUS_LABELS[row.status] }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="enterprise_name" label="企业名称" width="180" show-overflow-tooltip />

        <el-table-column prop="responsible_person" label="责任人" width="100" />
        <el-table-column prop="current_handler" label="当前处理人" width="110" />

        <el-table-column prop="deadline" label="截止时间" width="170">
          <template #default="{ row }">
            <span :style="{ color: EXPIRY_COLORS[row.expiry_status] }">
              {{ formatDate(row.deadline) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="到期预警" width="100">
          <template #default="{ row }">
            <el-tag 
              size="small" 
              :type="row.expiry_status === 'overdue' ? 'danger' : row.expiry_status === 'urgent' ? 'warning' : 'success'"
            >
              {{ EXPIRY_LABELS[row.expiry_status] }}
              <span v-if="row.days_left !== null">
                ({{ row.days_left > 0 ? row.days_left + '天' : Math.abs(row.days_left) + '天前' }})
              </span>
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="异常标签" width="160">
          <template #default="{ row }">
            <div class="abnormal-tags">
              <el-tag 
                v-for="tag in row.abnormal_tags" 
                :key="tag" 
                size="small" 
                type="danger" 
                effect="plain"
                class="abnormal-tag"
              >
                {{ ABNORMAL_LABELS[tag] }}
              </el-tag>
              <span v-if="row.abnormal_tags.length === 0" style="color: #c0c4cc;">-</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="版本" width="70" prop="version" align="center" />

        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="goToDetail(row.id)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog 
      v-model="batchDialogVisible" 
      title="批量推进招商线索单"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-alert 
        title="队列刷新前核对规则" 
        type="warning" 
        :closable="false"
        style="margin-bottom: 16px;"
      >
        <p>• 将核对当前角色、当前状态、必填附件</p>
        <p>• 逾期线索单将被拦截，需进入详情页单独处理</p>
        <p>• 每条线索单独立校验，成功/失败逐条返回</p>
      </el-alert>

      <el-form :model="batchForm" label-width="100px">
        <el-form-item label="选择操作">
          <el-radio-group v-model="batchForm.action_type">
            <el-radio 
              v-for="action in availableBatchActions" 
              :key="action.value" 
              :value="action.value"
            >
              {{ action.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item 
          label="退回原因" 
          v-if="batchForm.target_status === STATUS.RETURNED"
          prop="return_reason"
        >
          <el-input 
            v-model="batchForm.return_reason" 
            type="textarea" 
            :rows="3" 
            placeholder="请填写退回原因"
          />
        </el-form-item>

        <el-form-item label="处理备注">
          <el-input 
            v-model="batchForm.remark" 
            type="textarea" 
            :rows="2" 
            placeholder="请填写处理备注（选填）"
          />
        </el-form-item>

        <el-form-item label="选中条数">
          <el-tag>{{ selectedIds.length }} 条</el-tag>
          <span style="margin-left: 12px; color: #909399;">
            将进行：{{ currentActionLabel }}
          </span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          :loading="batchProcessing"
          :disabled="!canSubmitBatch"
          @click="submitBatch"
        >
          确认批量推进
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  Refresh, Search, RefreshLeft, Promotion, 
  Document, Clock, Warning, CircleCheck,
  Files, User, Edit, View
} from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import { getClueList, getClueStats, processBatch } from '../api/clues';
import { useAuthStore } from '../store/auth';
import {
  STATUS, STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS,
  CLUE_TYPE_LABELS,
  ABNORMAL_LABELS,
  EXPIRY_LABELS, EXPIRY_COLORS,
  ROLES
} from '../utils/config';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const clueList = ref([]);
const stats = ref(null);
const selectedIds = ref([]);
const selectedRows = ref([]);
const tableRef = ref(null);

const batchDialogVisible = ref(false);
const batchProcessing = ref(false);
const batchForm = reactive({
  action_type: '',
  target_status: '',
  return_reason: '',
  remark: '',
  action: ''
});

const filters = reactive({
  status: '',
  priority: '',
  clue_type: '',
  expiry_status: '',
  keyword: ''
});

const allStats = computed(() => {
  if (!stats.value) return [];
  return [
    { key: 'total', label: '全部线索', value: stats.value.total, color: '#409EFF', icon: Document },
    { key: 'pending_submit', label: '待提交', value: stats.value.pending_submit || 0, color: '#E6A23C', icon: Edit },
    { key: 'pending_audit', label: '待审核', value: stats.value.pending_audit || 0, color: '#409EFF', icon: View },
    { key: 'returned', label: '已退回', value: stats.value.returned || 0, color: '#F56C6C', icon: Warning },
    { key: 'resubmitted', label: '重新提交', value: stats.value.resubmitted || 0, color: '#E6A23C', icon: Refresh },
    { key: 'pending_review', label: '待复核', value: stats.value.pending_review || 0, color: '#909399', icon: Files },
    { key: 'approved', label: '已通过', value: stats.value.approved || 0, color: '#67C23A', icon: CircleCheck },
    { key: 'overdue', label: '逾期', value: stats.value.overdue || 0, color: '#F56C6C', icon: Clock }
  ];
});

const displayStats = computed(() => {
  if (authStore.isReviewer) {
    return allStats.value.filter(s => 
      ['total', 'pending_review', 'approved', 'rejected', 'archived', 'overdue', 'high_priority'].includes(s.key)
    );
  } else if (authStore.isAuditor) {
    return allStats.value.filter(s => 
      ['total', 'pending_submit', 'pending_audit', 'returned', 'resubmitted', 'overdue', 'high_priority'].includes(s.key)
    );
  } else {
    return allStats.value.filter(s => 
      ['total', 'pending_submit', 'returned', 'resubmitted', 'pending_audit', 'overdue', 'high_priority'].includes(s.key)
    );
  }
});

const availableBatchActions = computed(() => {
  const role = authStore.userRole;
  const actions = [];

  if (role === ROLES.REGISTRAR) {
    actions.push(
      { value: 'submit', label: '提交审核 (待提交 → 待审核)', target_status: STATUS.PENDING_AUDIT, action: '提交审核' },
      { value: 'resubmit', label: '重新提交 (已退回 → 重新提交)', target_status: STATUS.RESUBMITTED, action: '重新提交' }
    );
  } else if (role === ROLES.AUDITOR) {
    actions.push(
      { value: 'audit_pass', label: '审核通过 (待审核 → 待复核)', target_status: STATUS.PENDING_REVIEW, action: '审核通过' },
      { value: 'audit_return', label: '退回补正 (待审核 → 已退回)', target_status: STATUS.RETURNED, action: '退回补正' }
    );
  } else if (role === ROLES.REVIEWER) {
    actions.push(
      { value: 'review_pass', label: '复核通过 (待复核 → 通过)', target_status: STATUS.APPROVED, action: '复核通过' },
      { value: 'review_reject', label: '复核拒绝 (待复核 → 拒绝)', target_status: STATUS.REJECTED, action: '复核拒绝' },
      { value: 'archive', label: '归档 (通过/拒绝 → 已归档)', target_status: STATUS.ARCHIVED, action: '归档' }
    );
  }

  return actions;
});

const currentActionLabel = computed(() => {
  const action = availableBatchActions.value.find(a => a.value === batchForm.action_type);
  return action ? action.label : '';
});

const canSubmitBatch = computed(() => {
  if (!batchForm.action_type) return false;
  if (batchForm.target_status === STATUS.RETURNED && !batchForm.return_reason.trim()) return false;
  return true;
});

function formatDate(date) {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm');
}

async function loadData() {
  loading.value = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      getClueList(filters),
      getClueStats()
    ]);
    clueList.value = listRes.data;
    stats.value = statsRes.data;
  } catch (e) {
    console.error('加载数据失败:', e);
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.status = '';
  filters.priority = '';
  filters.clue_type = '';
  filters.expiry_status = '';
  filters.keyword = '';
  loadData();
}

function handleSelectionChange(rows) {
  selectedRows.value = rows;
  selectedIds.value = rows.map(r => r.id);
}

function goToDetail(id) {
  router.push(`/clues/${id}`);
}

function openBatchDialog() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要处理的线索单');
    return;
  }
  batchForm.action_type = '';
  batchForm.target_status = '';
  batchForm.return_reason = '';
  batchForm.remark = '';
  batchDialogVisible.value = true;
}

async function submitBatch() {
  const actionConfig = availableBatchActions.value.find(a => a.value === batchForm.action_type);
  if (!actionConfig) return;

  if (actionConfig.target_status === STATUS.RETURNED && !batchForm.return_reason.trim()) {
    ElMessage.warning('请填写退回原因');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要对 ${selectedIds.value.length} 条线索单执行"${actionConfig.label}"操作吗？`,
      '确认批量操作',
      { type: 'warning' }
    );
  } catch (e) {
    return;
  }

  batchProcessing.value = true;
  try {
    const items = selectedRows.value.map(row => ({
      clue_id: row.id,
      version: row.version
    }));

    const action = {
      target_status: actionConfig.target_status,
      action: actionConfig.action,
      return_reason: batchForm.return_reason || '',
      remark: batchForm.remark || ''
    };

    const res = await processBatch(items, action);
    
    batchDialogVisible.value = false;
    
    if (res.data.fail_count > 0) {
      ElMessage.warning(`批量处理完成：成功 ${res.data.success_count} 条，失败 ${res.data.fail_count} 条`);
    } else {
      ElMessage.success(`批量处理完成：成功 ${res.data.success_count} 条`);
    }

    router.push(`/batch-results/${res.data.batch_no}`);
    loadData();
  } catch (e) {
    console.error('批量处理失败:', e);
  } finally {
    batchProcessing.value = false;
  }
}

watch(
  () => batchForm.action_type,
  (newVal) => {
    const action = availableBatchActions.value.find(a => a.value === newVal);
    if (action) {
      batchForm.target_status = action.target_status;
      batchForm.action = action.action;
    } else {
      batchForm.target_status = '';
      batchForm.action = '';
    }
  }
);

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.clue-list-container {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  border-radius: 8px;
  overflow: hidden;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.filter-card {
  margin-bottom: 16px;
}

.filter-form {
  margin: 0;
}

.table-card {
  border-radius: 8px;
}

.abnormal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.abnormal-tag {
  margin-right: 4px;
}

:deep(.el-table .warning-row) {
  --el-table-tr-bg-color: #fdf6ec;
}

:deep(.el-table .danger-row) {
  --el-table-tr-bg-color: #fef0f0;
}
</style>
