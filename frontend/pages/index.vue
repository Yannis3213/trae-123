<template>
  <div class="dashboard">
    <div class="stats-row mb-4">
      <div class="stat-card">
        <div class="stat-value text-primary-color">{{ stats?.total || 0 }}</div>
        <div class="stat-label">全部入会单</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #1890ff">{{ stats?.pending || 0 }}</div>
        <div class="stat-label">待核验</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #ff4d4f">{{ stats?.failed || 0 }}</div>
        <div class="stat-label">核验失败</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #52c41a">{{ stats?.completed || 0 }}</div>
        <div class="stat-label">核验完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #52c41a">{{ stats?.normal || 0 }}</div>
        <div class="stat-label">正常</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #faad14">{{ stats?.approaching || 0 }}</div>
        <div class="stat-label">临期</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #ff4d4f">{{ stats?.overdue || 0 }}</div>
        <div class="stat-label">逾期</div>
      </div>
    </div>

    <div class="main-content">
      <div class="queue-section">
        <div class="card">
          <div class="card-header">
            <span>会员入会单队列</span>
            <div class="header-actions">
              <button
                v-if="canCreate"
                class="btn btn-primary btn-sm"
                @click="showCreateModal = true"
              >
                + 新增入会单
              </button>
              <button
                v-if="canBatch && selectedIds.length > 0"
                class="btn btn-sm"
                @click="showBatchModal = true"
              >
                批量处理 ({{ selectedIds.length }})
              </button>
              <button class="btn btn-sm" @click="checkExceptions">
                刷新队列
              </button>
            </div>
          </div>

          <div class="filter-bar">
            <div class="filter-tabs">
              <button
                v-for="tab in statusTabs"
                :key="tab.value"
                class="tab-btn"
                :class="{ active: filters.status === tab.value }"
                @click="setFilter('status', tab.value)"
              >
                {{ tab.label }}
              </button>
            </div>
            <div class="filter-tabs mt-2">
              <button
                v-for="tab in expiryTabs"
                :key="tab.value"
                class="tab-btn tab-btn-sm"
                :class="{ active: filters.expiry_status === tab.value }"
                @click="setFilter('expiry_status', tab.value)"
              >
                {{ tab.label }}
              </button>
            </div>
            <div class="filter-actions mt-2">
              <input
                v-model="filters.keyword"
                class="form-input filter-input"
                placeholder="搜索会员姓名/电话/合同号"
                @input="debouncedLoad"
              />
              <select v-model="filters.my_todo" class="form-input filter-select" @change="loadList">
                <option :value="false">全部</option>
                <option :value="true">我的待办</option>
              </select>
            </div>
          </div>

          <div v-if="exceptionAlerts.length > 0" class="exception-alerts p-4">
            <div v-for="(alert, idx) in exceptionAlerts" :key="idx" class="alert alert-error">
              <span>⚠️</span>
              <div>
                <div>队列异常检测：{{ EXCEPTION_LABELS[alert.exception_type] }}</div>
                <div class="text-sm text-secondary">入会单 #{{ alert.enrollment_id }}：{{ alert.description }}</div>
              </div>
            </div>
          </div>

          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 40px">
                    <input
                      type="checkbox"
                      class="checkbox"
                      :checked="isAllSelected"
                      @change="toggleSelectAll"
                    />
                  </th>
                  <th>ID</th>
                  <th>会员姓名</th>
                  <th>电话</th>
                  <th>会籍类型</th>
                  <th>金额</th>
                  <th>门店</th>
                  <th>状态</th>
                  <th>到期状态</th>
                  <th>异常</th>
                  <th>处理时限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in enrollments"
                  :key="item.id"
                  class="table-row-clickable"
                  @click="goToDetail(item.id)"
                >
                  <td @click.stop>
                    <input
                      type="checkbox"
                      class="checkbox"
                      :checked="selectedIds.includes(item.id)"
                      @change="toggleSelect(item.id)"
                    />
                  </td>
                  <td>#{{ item.id }}</td>
                  <td>{{ item.member_name }}</td>
                  <td>{{ item.member_phone }}</td>
                  <td>{{ item.membership_type }}</td>
                  <td>¥{{ item.amount }}</td>
                  <td>{{ item.store }}</td>
                  <td>
                    <span class="tag" :class="'tag-' + item.status">
                      {{ STATUS_LABELS[item.status] }}
                    </span>
                  </td>
                  <td>
                    <span
                      v-if="item.expiry_status"
                      class="tag"
                      :class="'tag-' + item.expiry_status"
                    >
                      {{ EXPIRY_LABELS[item.expiry_status] }}
                    </span>
                  </td>
                  <td>
                    <span v-if="item.has_exception" class="tag tag-overdue">有异常</span>
                    <span v-else class="text-tertiary">-</span>
                  </td>
                  <td class="text-sm text-secondary">
                    {{ formatDate(item.due_at) }}
                  </td>
                  <td>
                    <button class="btn btn-sm" @click.stop="goToDetail(item.id)">
                      详情
                    </button>
                  </td>
                </tr>
                <tr v-if="enrollments.length === 0">
                  <td colspan="12" class="text-center text-tertiary py-8">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pagination">
            <span class="text-sm text-secondary">共 {{ listData?.total || 0 }} 条</span>
            <div class="page-btns">
              <button
                class="btn btn-sm"
                :disabled="filters.page <= 1"
                @click="changePage(-1)"
              >
                上一页
              </button>
              <span class="page-info">{{ filters.page }} / {{ totalPages }}</span>
              <button
                class="btn btn-sm"
                :disabled="filters.page >= totalPages"
                @click="changePage(1)"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="sidebar">
        <div class="card mb-4">
          <div class="card-header">
            <span>证据摘要</span>
          </div>
          <div class="card-body">
            <div class="evidence-summary">
              <div v-for="(label, key) in EVIDENCE_LABELS" :key="key" class="evidence-item">
                <span class="evidence-icon">{{ evidenceSummary[key as string] ? '✓' : '○' }}</span>
                <span class="evidence-label">{{ label }}</span>
                <span
                  class="evidence-status text-sm"
                  :class="evidenceSummary[key as string] ? 'text-success' : 'text-tertiary'"
                >
                  {{ evidenceSummary[key as string] ? '已上传' : '未上传' }}
                </span>
              </div>
            </div>
            <div class="evidence-stats mt-4 text-sm text-secondary">
              点击列表中的入会单查看详情证据
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span>快捷操作</span>
          </div>
          <div class="card-body">
            <div class="quick-actions">
              <button
                v-if="canCreate"
                class="btn btn-primary w-full mb-2"
                @click="showCreateModal = true"
              >
                新增入会单
              </button>
              <button
                v-if="canBatchAudit"
                class="btn w-full mb-2"
                @click="showBatchModal = true"
              >
                批量审核
              </button>
              <button
                v-if="canBatchReview"
                class="btn w-full mb-2"
                @click="showBatchModal = true"
              >
                批量复核
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CreateEnrollmentModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onCreated"
    />

    <BatchProcessModal
      v-if="showBatchModal"
      :selected-ids="selectedIds"
      :role="auth.userRole.value || ''"
      @close="showBatchModal = false"
      @done="onBatchDone"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useEnrollmentApi } from '~/composables/useEnrollmentApi'
import {
  STATUS_LABELS,
  EXPIRY_LABELS,
  EXCEPTION_LABELS,
  EVIDENCE_LABELS,
  type Enrollment,
  type EnrollmentListResponse,
  type StatsResponse,
  type StatusEnum,
  type ExpiryStatusEnum,
  type ExceptionTypeEnum,
  type EvidenceTypeEnum,
} from '~/types'
import CreateEnrollmentModal from '~/components/CreateEnrollmentModal.vue'
import BatchProcessModal from '~/components/BatchProcessModal.vue'

const auth = useAuth()
const api = useEnrollmentApi()

const listData = ref<EnrollmentListResponse | null>(null)
const stats = ref<StatsResponse | null>(null)
const enrollments = computed(() => listData.value?.items || [])

const exceptionAlerts = ref<any[]>([])

const filters = ref({
  status: '' as StatusEnum | '',
  expiry_status: '' as ExpiryStatusEnum | '',
  store: '',
  keyword: '',
  my_todo: false,
  page: 1,
  page_size: 20,
})

const selectedIds = ref<number[]>([])

const showCreateModal = ref(false)
const showBatchModal = ref(false)

const evidenceSummary = computed(() => {
  const summary: Record<string, boolean> = {
    membership_form: false,
    contract_confirmation: false,
    card_benefits: false,
  }
  return summary
})

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待核验', value: 'pending' },
  { label: '核验失败', value: 'failed' },
  { label: '核验完成', value: 'completed' },
]

const expiryTabs = [
  { label: '全部到期', value: '' },
  { label: '正常', value: 'normal' },
  { label: '临期', value: 'approaching' },
  { label: '逾期', value: 'overdue' },
]

const canCreate = computed(() => auth.userRole.value === 'registration_clerk')
const canBatchAudit = computed(() => auth.userRole.value === 'audit_supervisor')
const canBatchReview = computed(() => auth.userRole.value === 'review_lead')
const canBatch = computed(() => canBatchAudit.value || canBatchReview.value)

const totalPages = computed(() => {
  if (!listData.value) return 1
  return Math.ceil(listData.value.total / filters.value.page_size)
})

const isAllSelected = computed(() => {
  if (enrollments.value.length === 0) return false
  return enrollments.value.every((e) => selectedIds.value.includes(e.id))
})

let debounceTimer: any = null
const debouncedLoad = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    filters.value.page = 1
    loadList()
  }, 300)
}

const setFilter = (key: string, value: any) => {
  ;(filters.value as any)[key] = value
  filters.value.page = 1
  loadList()
}

const changePage = (delta: number) => {
  filters.value.page += delta
  loadList()
}

const loadList = async () => {
  try {
    const params: any = { ...filters.value }
    if (!params.status) delete params.status
    if (!params.expiry_status) delete params.expiry_status
    if (!params.keyword) delete params.keyword
    if (!params.store) delete params.store
    listData.value = await api.getList(params)
  } catch (e) {
    console.error('加载列表失败', e)
  }
}

const loadStats = async () => {
  try {
    stats.value = await api.getStats()
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

const checkExceptions = async () => {
  try {
    const exceptions = await api.checkExceptions()
    exceptionAlerts.value = exceptions
    await loadList()
    await loadStats()
  } catch (e) {
    console.error('检查异常失败', e)
  }
}

const toggleSelect = (id: number) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = enrollments.value.map((e) => e.id)
  }
}

const goToDetail = (id: number) => {
  navigateTo(`/enrollment/${id}`)
}

const onCreated = () => {
  showCreateModal.value = false
  loadList()
  loadStats()
}

const onBatchDone = () => {
  showBatchModal.value = false
  selectedIds.value = []
  loadList()
  loadStats()
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  const dateStrFormatted = d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (diffMs < 0) {
    return `${dateStrFormatted} (已逾期${Math.abs(diffDays)}天)`
  } else if (diffDays <= 1) {
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    return `${dateStrFormatted} (还剩${diffHours}小时)`
  }
  return `${dateStrFormatted} (还剩${diffDays}天)`
}

watch(
  () => auth.isLoggedIn.value,
  (val) => {
    if (val) {
      loadList()
      loadStats()
    }
  }
)

onMounted(() => {
  if (auth.isLoggedIn.value) {
    loadList()
    loadStats()
  }
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
}

.queue-section {
  min-width: 0;
}

.filter-bar {
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fafafa;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 6px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}

.tab-btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.tab-btn:hover {
  color: var(--primary-color);
}

.tab-btn.active {
  background-color: #e6f7ff;
  color: var(--primary-color);
  border-color: #91d5ff;
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-input {
  flex: 1;
  max-width: 300px;
}

.filter-select {
  width: 150px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.table-container {
  overflow-x: auto;
}

.pagination {
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f0f0f0;
}

.page-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-info {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 60px;
  text-align: center;
}

.evidence-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.evidence-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f0f0;
}

.evidence-item:last-child {
  border-bottom: none;
}

.evidence-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--success-color);
  font-weight: bold;
}

.evidence-label {
  flex: 1;
  font-size: 14px;
}

.evidence-stats {
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.text-center {
  text-align: center;
}

.py-8 {
  padding: 32px 0;
}

.text-primary-color {
  color: var(--primary-color);
}

.exception-alerts {
  padding: 12px 20px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
}

.w-full {
  width: 100%;
}
</style>
