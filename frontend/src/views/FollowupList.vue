<template>
  <div class="followup-list">
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6" v-for="(stat, key) in stats.byStatus" :key="key">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stat.count }}</div>
            <div class="stat-label">{{ stat.name }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card warning">
          <div class="stat-content">
            <div class="stat-number">{{ stats.warning }}</div>
            <div class="stat-label">临期预警</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card danger">
          <div class="stat-content">
            <div class="stat-number">{{ stats.overdue }}</div>
            <div class="stat-label">已逾期</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="business-tabs">
      <el-tab-pane label="慢病档案" name="chronic">
        <ChronicRecordModule />
      </el-tab-pane>
      <el-tab-pane label="用药提醒" name="medication">
        <MedicationModule />
      </el-tab-pane>
      <el-tab-pane label="慢病随访单登记" name="registration">
        <FollowupRegistrationModule />
      </el-tab-pane>
    </el-tabs>

    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">慢病随访单列表</span>
          <div class="header-actions">
            <el-button v-if="canBatchProcess" type="primary" :disabled="selectedRows.length === 0" @click="handleBatchProcess">
              批量处理
            </el-button>
            <el-button v-if="canBatchComplete" type="success" :disabled="selectedRows.length === 0" @click="handleBatchComplete">
              批量完成
            </el-button>
            <el-button v-if="canBatchReturn" type="warning" :disabled="selectedRows.length === 0" @click="handleBatchReturn">
              批量退回
            </el-button>
            <el-button v-if="userStore.isTriageNurse" type="primary" @click="router.push('/followup/create')">
              <el-icon><Plus /></el-icon>新建随访单
            </el-button>
          </div>
        </div>
      </template>

      <div class="filter-bar">
        <el-form :inline="true" :model="filterForm">
          <el-form-item label="状态">
            <el-select v-model="filterForm.status" placeholder="全部状态" clearable @change="fetchList">
              <el-option v-for="(name, key) in STATUS_NAMES" :key="key" :label="name" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="关键词">
            <el-input v-model="filterForm.keyword" placeholder="姓名/身份证号" clearable @keyup.enter="fetchList" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchList">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table
        :data="list"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        border
        stripe
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="id" label="单据号" width="80" />
        <el-table-column prop="patient_name" label="患者姓名" width="100" />
        <el-table-column prop="chronic_type" label="慢病类型" width="120" />
        <el-table-column label="到期预警" width="100">
          <template #default="{ row }">
            <el-tag :type="OVERDUE_COLORS[row.overdueLevel]" effect="light">
              {{ OVERDUE_NAMES[row.overdueLevel] }}
              <span v-if="row.overdueDays !== undefined">({{ row.overdueDays > 0 ? row.overdueDays + '天' : Math.abs(row.overdueDays) + '天前' }})</span>
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="due_date" label="到期日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.due_date) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="STATUS_COLORS[row.status]" effect="dark">
              {{ row.statusName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="current_handler_name" label="当前处理人" width="100" />
        <el-table-column label="版本" width="70">
          <template #default="{ row }">
            <el-tag type="info" size="small">v{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="创建人" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">查看</el-button>
            <el-button 
              v-if="canEditRow(row)" 
              type="primary" 
              link 
              @click="handleEdit(row)"
            >编辑</el-button>
            <el-button 
              v-if="canSubmitRow(row)" 
              type="success" 
              link 
              @click="handleSubmitRow(row)"
            >提交</el-button>
            <el-button 
              v-if="canResubmitRow(row)" 
              type="success" 
              link 
              @click="handleResubmitRow(row)"
            >重新提交</el-button>
            <el-button 
              v-if="canProcessRow(row)" 
              type="primary" 
              link 
              @click="handleProcessRow(row)"
            >处理</el-button>
            <el-button 
              v-if="canReviewRow(row)" 
              type="primary" 
              link 
              @click="handleReviewRow(row)"
            >审核</el-button>
            <el-button 
              v-if="canCompleteRow(row)" 
              type="success" 
              link 
              @click="handleCompleteRow(row)"
            >完成</el-button>
            <el-button 
              v-if="canReturnRow(row)" 
              type="warning" 
              link 
              @click="handleReturnRow(row)"
            >退回</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-dialog v-model="batchDialog.visible" :title="batchDialog.title" width="500px">
      <el-form :model="batchDialog.form" label-width="100px">
        <el-form-item label="处理意见" v-if="batchDialog.type !== 'return'">
          <el-input v-model="batchDialog.form.opinion" type="textarea" :rows="3" placeholder="请输入处理意见" />
        </el-form-item>
        <el-form-item label="诊断结果" v-if="batchDialog.type === 'process'">
          <el-input v-model="batchDialog.form.diagnosis" type="textarea" :rows="2" placeholder="请输入诊断结果" />
        </el-form-item>
        <el-form-item label="治疗方案" v-if="batchDialog.type === 'process'">
          <el-input v-model="batchDialog.form.treatment_plan" type="textarea" :rows="2" placeholder="请输入治疗方案" />
        </el-form-item>
        <el-form-item label="退回原因" v-if="batchDialog.type === 'return'">
          <el-input v-model="batchDialog.form.reason" type="textarea" :rows="3" placeholder="请输入退回原因" />
        </el-form-item>
        <el-form-item label="备注" v-if="batchDialog.type === 'return'">
          <el-input v-model="batchDialog.form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <div class="dialog-info">
        <el-alert :title="`已选择 ${selectedRows.length} 条记录，逾期记录将被自动拦截`" type="warning" :closable="false" show-icon />
      </div>
      <template #footer>
        <el-button @click="batchDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="confirmBatch">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { useUserStore } from '../stores/user'
import { getFollowupListApi, getFollowupStatsApi, submitFollowupApi, resubmitFollowupApi, processFollowupApi, reviewFollowupApi, returnFollowupApi, completeFollowupApi } from '../api/followup'
import { batchProcessApi, batchCompleteApi, batchReturnApi } from '../api/batch'
import { STATUS_NAMES, STATUS_COLORS, OVERDUE_COLORS, OVERDUE_NAMES, STATUS } from '../types'
import ChronicRecordModule from '../components/ChronicRecordModule.vue'
import MedicationModule from '../components/MedicationModule.vue'
import FollowupRegistrationModule from '../components/FollowupRegistrationModule.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const batchLoading = ref(false)
const activeTab = ref('registration')
const list = ref([])
const selectedRows = ref([])
const stats = ref({ byStatus: {}, warning: 0, overdue: 0 })

const filterForm = reactive({
  status: '',
  keyword: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const batchDialog = reactive({
  visible: false,
  type: '',
  title: '',
  form: {
    opinion: '',
    diagnosis: '',
    treatment_plan: '',
    reason: '',
    remark: ''
  }
})

const canBatchProcess = computed(() => 
  userStore.isGeneralDoctor && 
  selectedRows.value.some(r => [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED].includes(r.status))
)

const canBatchComplete = computed(() => 
  userStore.isMedicalDirector && 
  selectedRows.value.some(r => r.status === STATUS.DIRECTOR_REVIEW)
)

const canBatchReturn = computed(() => 
  (userStore.isGeneralDoctor || userStore.isMedicalDirector) &&
  selectedRows.value.some(r => [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED, STATUS.DOCTOR_PROCESSING, STATUS.DIRECTOR_REVIEW].includes(r.status))
)

function canEditRow(row) {
  return userStore.isTriageNurse && [STATUS.DRAFT, STATUS.RETURNED].includes(row.status)
}

function canSubmitRow(row) {
  return userStore.isTriageNurse && row.status === STATUS.DRAFT
}

function canResubmitRow(row) {
  return userStore.isTriageNurse && row.status === STATUS.RETURNED
}

function canProcessRow(row) {
  return userStore.isGeneralDoctor && [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED].includes(row.status)
}

function canReviewRow(row) {
  return userStore.isMedicalDirector && row.status === STATUS.DOCTOR_PROCESSING
}

function canCompleteRow(row) {
  return userStore.isMedicalDirector && row.status === STATUS.DIRECTOR_REVIEW
}

function canReturnRow(row) {
  if (userStore.isGeneralDoctor) {
    return [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED].includes(row.status)
  }
  if (userStore.isMedicalDirector) {
    return [STATUS.DOCTOR_PROCESSING, STATUS.DIRECTOR_REVIEW].includes(row.status)
  }
  return false
}

function handleEdit(row) {
  router.push(`/followup/${row.id}?edit=1`)
}

async function handleSubmitRow(row) {
  try {
    await ElMessageBox.confirm('确定提交该随访单吗？', '提示', { type: 'warning' })
    await submitFollowupApi(row.id, { version: row.version })
    ElMessage.success('提交成功')
    fetchList()
    fetchStats()
  } catch (err) {
    if (err.message) ElMessage.error(err.message)
  }
}

async function handleResubmitRow(row) {
  try {
    await ElMessageBox.confirm('确定重新提交该随访单吗？', '提示', { type: 'warning' })
    await resubmitFollowupApi(row.id, { version: row.version })
    ElMessage.success('重新提交成功')
    fetchList()
    fetchStats()
  } catch (err) {
    if (err.message) ElMessage.error(err.message)
  }
}

function handleProcessRow(row) {
  router.push(`/followup/${row.id}?action=process`)
}

function handleReviewRow(row) {
  router.push(`/followup/${row.id}?action=review`)
}

function handleCompleteRow(row) {
  router.push(`/followup/${row.id}?action=complete`)
}

function handleReturnRow(row) {
  router.push(`/followup/${row.id}?action=return`)
}

async function fetchStats() {
  try {
    const res = await getFollowupStatsApi()
    stats.value = res
  } catch (err) {
    console.error(err)
  }
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getFollowupListApi({
      ...filterForm,
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    list.value = res.list
    pagination.total = res.total
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filterForm.status = ''
  filterForm.keyword = ''
  pagination.page = 1
  fetchList()
}

function handlePageChange(page) {
  pagination.page = page
  fetchList()
}

function handleSizeChange(size) {
  pagination.pageSize = size
  pagination.page = 1
  fetchList()
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

function goToDetail(id) {
  router.push(`/followup/${id}`)
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD') : '-'
}

function formatDateTime(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function handleBatchProcess() {
  batchDialog.type = 'process'
  batchDialog.title = '批量处理'
  batchDialog.visible = true
}

function handleBatchComplete() {
  batchDialog.type = 'complete'
  batchDialog.title = '批量完成'
  batchDialog.visible = true
}

function handleBatchReturn() {
  batchDialog.type = 'return'
  batchDialog.title = '批量退回'
  batchDialog.visible = true
}

async function confirmBatch() {
  batchLoading.value = true
  try {
    const items = selectedRows.value.map(r => ({ id: r.id, version: r.version }))
    let apiFn
    let params

    if (batchDialog.type === 'process') {
      apiFn = batchProcessApi
      params = { items, ...batchDialog.form }
    } else if (batchDialog.type === 'complete') {
      apiFn = batchCompleteApi
      params = { items, ...batchDialog.form }
    } else {
      apiFn = batchReturnApi
      params = { items, ...batchDialog.form }
    }

    const res = await apiFn(params)
    
    const successCount = res.results.filter(r => r.success).length
    const failCount = res.results.filter(r => !r.success).length
    
    ElMessage.success(`批量操作完成：成功${successCount}条，失败${failCount}条`)
    
    sessionStorage.setItem('batchResults', JSON.stringify(res.results))
    router.push('/batch-result')
    
    batchDialog.visible = false
    fetchList()
    fetchStats()
  } catch (err) {
    console.error(err)
  } finally {
    batchLoading.value = false
  }
}

onMounted(() => {
  fetchStats()
  fetchList()
})
</script>

<style scoped>
.followup-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  border-radius: 8px;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-card.warning {
  border-left: 4px solid #e6a23c;
}

.stat-card.danger {
  border-left: 4px solid #f56c6c;
}

.stat-content {
  text-align: center;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

.business-tabs {
  background: #fff;
  border-radius: 8px;
  padding: 0 16px;
}

.list-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.dialog-info {
  margin-top: 16px;
}
</style>
