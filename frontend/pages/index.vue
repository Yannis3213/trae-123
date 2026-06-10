<template>
  <div>
    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 20px;">
      <div class="stat-card" @click="switchTab('pending_correction')" style="cursor: pointer;">
        <div class="stat-number" :class="{ 'text-danger': pendingOverdue > 0 }">
          {{ stats?.pending_correction_count || 0 }}
          <span v-if="pendingOverdue > 0" style="font-size: 14px; color: #dc2626;">({{ pendingOverdue }}逾期)</span>
        </div>
        <div class="stat-label">待补正</div>
      </div>
      <div class="stat-card" @click="switchTab('under_review')" style="cursor: pointer;">
        <div class="stat-number" :class="{ 'text-danger': reviewOverdue > 0 }">
          {{ stats?.under_review_count || 0 }}
          <span v-if="reviewOverdue > 0" style="font-size: 14px; color: #dc2626;">({{ reviewOverdue }}逾期)</span>
        </div>
        <div class="stat-label">复核中</div>
      </div>
      <div class="stat-card" style="cursor: pointer;">
        <div class="stat-number" style="color: #16a34a;">{{ stats?.completed_count || 0 }}</div>
        <div class="stat-label">已办结</div>
      </div>
      <div class="stat-card" @click="setWarningFilter('warning')" style="cursor: pointer;">
        <div class="stat-number" style="color: #d97706;">{{ warningCount }}</div>
        <div class="stat-label">临期工单</div>
      </div>
      <div class="stat-card" @click="setWarningFilter('overdue')" style="cursor: pointer;">
        <div class="stat-number" style="color: #dc2626;">{{ overdueCount }}</div>
        <div class="stat-label">逾期工单</div>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb-4">
        <div class="tabs" style="margin-bottom: 0; border: none;">
          <div
            v-for="tab in tabs"
            :key="tab.value"
            class="tab"
            :class="{ active: activeTab === tab.value }"
            @click="switchTab(tab.value)"
          >
            {{ tab.label }}
            <span v-if="getTabCount(tab.value) > 0" class="badge" :class="getTabBadgeClass(tab.value)" style="margin-left: 6px;">
              {{ getTabCount(tab.value) }}
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            v-if="showBatchSubmit"
            class="btn btn-primary"
            @click="showBatchModal = true"
            :disabled="selectedIds.length === 0"
          >
            批量提交复核 ({{ selectedIds.length }})
          </button>
          <button
            v-if="showBatchReview"
            class="btn btn-success"
            @click="showBatchReviewModal = true"
            :disabled="selectedIds.length === 0"
          >
            批量复核 ({{ selectedIds.length }})
          </button>
          <button
            v-if="showBatchConfirm"
            class="btn btn-success"
            @click="showBatchConfirmModal = true"
            :disabled="selectedIds.length === 0"
          >
            批量确认办结 ({{ selectedIds.length }})
          </button>
        </div>
      </div>

      <div class="flex gap-4 mb-4" style="flex-wrap: wrap;">
        <div>
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索工单号、标题、产品名..."
            class="form-input"
            style="width: 280px;"
            @keyup.enter="loadWorkorders"
          />
        </div>
        <div>
          <select v-model="warningFilter" class="form-select" style="width: 140px;">
            <option value="">全部预警</option>
            <option value="normal">正常</option>
            <option value="warning">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div>
          <select v-model="nodeFilter" class="form-select" style="width: 160px;">
            <option value="">全部节点</option>
            <option value="生产排程">生产排程</option>
            <option value="领料确认">领料确认</option>
            <option value="完工报工">完工报工</option>
            <option value="复核确认">复核确认</option>
          </select>
        </div>
        <div>
          <button class="btn btn-outline btn-sm" @click="loadWorkorders">搜索</button>
        </div>
        <div style="margin-left: auto;">
          <label class="text-sm text-muted">
            <input type="checkbox" v-model="onlyMine" class="checkbox" @change="loadWorkorders" />
            只看我的
          </label>
        </div>
      </div>

      <div v-if="activeWarningFilter" class="alert" :class="activeWarningFilter === 'overdue' ? 'alert-error' : 'alert-warning'">
        当前筛选：{{ activeWarningFilter === 'overdue' ? '逾期' : '临期' }}工单
        <button class="btn btn-outline btn-sm" style="margin-left: 12px; padding: 2px 8px;" @click="clearWarningFilter">
          清除筛选
        </button>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <table v-if="filteredWorkorders.length > 0">
        <thead>
          <tr>
            <th style="width: 40px;">
              <input
                type="checkbox"
                class="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                :disabled="!canBatchSelect"
              />
            </th>
            <th>工单编号</th>
            <th>标题</th>
            <th>产品</th>
            <th>数量</th>
            <th>状态</th>
            <th>当前节点</th>
            <th>计划员</th>
            <th>截止日期</th>
            <th>预警</th>
            <th>当前处理人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="wo in filteredWorkorders" :key="wo.id" :class="{ 'row-overdue': wo.warning_level === 'overdue' }">
            <td>
              <input
                type="checkbox"
                class="checkbox"
                :checked="selectedIds.includes(wo.id)"
                @change="toggleSelect(wo.id)"
                :disabled="!canSelectWorkorder(wo)"
              />
            </td>
            <td style="font-weight: 600; color: #2563eb;">{{ wo.code }}</td>
            <td>{{ wo.title }}</td>
            <td>{{ wo.product_name }}</td>
            <td>{{ wo.quantity }} {{ wo.unit }}</td>
            <td>
              <span class="badge" :class="getBadgeClass(wo.status)">{{ wo.status_name }}</span>
            </td>
            <td>
              <span class="text-sm" :class="{ 'text-danger': wo.warning_level === 'overdue' }">
                {{ wo.current_node }}
              </span>
            </td>
            <td class="text-sm text-muted">{{ wo.planner }}</td>
            <td class="text-sm" :class="{ 'text-danger': wo.warning_level === 'overdue' }">
              {{ formatDate(wo.deadline) }}
            </td>
            <td>
              <span class="badge" :class="getWarningClass(wo.warning_level)">
                {{ getWarningLabel(wo.warning_level) }}
              </span>
            </td>
            <td class="text-sm text-muted">{{ wo.current_handler || '-' }}</td>
            <td>
              <button class="btn btn-outline btn-sm" @click="viewDetail(wo.id)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="workorders.length > 0 && filteredWorkorders.length === 0 && !loading" class="text-center" style="padding: 40px 0; color: #9ca3af;">
        当前筛选条件下无工单
      </div>

      <div v-if="workorders.length === 0 && !loading" class="text-center" style="padding: 40px 0; color: #9ca3af;">
        暂无工单数据
      </div>

      <div v-if="loading" class="text-center" style="padding: 20px 0;">加载中...</div>

      <div class="flex-between mt-4">
        <div class="text-sm text-muted">
          共 {{ total }} 条
          <span v-if="filteredWorkorders.length !== total" style="margin-left: 12px;">
            当前显示 {{ filteredWorkorders.length }} 条
          </span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" :disabled="page <= 1" @click="changePage(-1)">上一页</button>
          <span class="text-sm" style="line-height: 32px;">第 {{ page }} 页</span>
          <button class="btn btn-outline btn-sm" :disabled="page * pageSize >= total" @click="changePage(1)">下一页</button>
        </div>
      </div>
    </div>

    <div v-if="showBatchModal" class="modal-overlay" @click.self="showBatchModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>批量提交复核</h3>
          <button class="btn btn-outline btn-sm" @click="showBatchModal = false">×</button>
        </div>
        <div class="modal-body">
          <p>确认将选中的 <strong>{{ selectedIds.length }}</strong> 条工单提交复核？</p>
          <div v-if="batchOverdueCount > 0" class="alert alert-warning mt-4">
            其中 {{ batchOverdueCount }} 条已逾期，提交时会被拦截
          </div>
          <div v-if="batchResult" class="mt-4">
            <div v-if="batchResult.success_count > 0" class="alert alert-success">
              成功 {{ batchResult.success_count }} 条
            </div>
            <div v-if="batchResult.fail_count > 0" class="alert alert-error">
              失败 {{ batchResult.fail_count }} 条
            </div>
            <div style="max-height: 300px; overflow-y: auto; margin-top: 12px;">
              <div v-for="r in batchResult.results" :key="r.id" class="text-sm" style="padding: 6px 0; border-bottom: 1px solid #f3f4f6;">
                <span class="text-success" v-if="r.success">✓</span>
                <span class="text-danger" v-else>✗</span>
                {{ r.code || r.id }} -
                <span v-if="r.success">{{ r.message }}</span>
                <span v-else class="text-danger">{{ r.error }}</span>
                <span v-if="!r.success && r.missing?.length > 0" class="text-danger" style="margin-left: 8px;">
                  （缺少：{{ r.missing.join('、') }}）
                </span>
                <span v-if="!r.success && r.error_code" class="text-muted" style="margin-left: 8px; font-size: 11px;">
                  [{{ r.error_code }}]
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showBatchModal = false">取消</button>
          <button class="btn btn-primary" @click="batchSubmit" :disabled="batchLoading">
            {{ batchLoading ? '提交中...' : '确认提交' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBatchReviewModal" class="modal-overlay" @click.self="showBatchReviewModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>批量复核</h3>
          <button class="btn btn-outline btn-sm" @click="showBatchReviewModal = false">×</button>
        </div>
        <div class="modal-body">
          <p>选中 <strong>{{ selectedIds.length }}</strong> 条工单</p>
          <div v-if="batchOverdueCount > 0" class="alert alert-warning mt-4">
            其中 {{ batchOverdueCount }} 条已逾期
          </div>
          <div class="form-group mt-4">
            <label class="form-label">操作</label>
            <select v-model="batchAction" class="form-select">
              <option value="approve">复核通过</option>
              <option value="reject">退回补正</option>
            </select>
          </div>
          <div v-if="batchAction === 'reject'" class="form-group">
            <label class="form-label">退回原因</label>
            <textarea v-model="batchRejectReason" class="form-textarea" placeholder="请填写退回原因"></textarea>
          </div>
          <div v-if="batchResult" class="mt-4">
            <div v-if="batchResult.success_count > 0" class="alert alert-success">
              成功 {{ batchResult.success_count }} 条
            </div>
            <div v-if="batchResult.fail_count > 0" class="alert alert-error">
              失败 {{ batchResult.fail_count }} 条
            </div>
            <div style="max-height: 250px; overflow-y: auto; margin-top: 12px;">
              <div v-for="r in batchResult.results" :key="r.id" class="text-sm" style="padding: 6px 0; border-bottom: 1px solid #f3f4f6;">
                <span class="text-success" v-if="r.success">✓</span>
                <span class="text-danger" v-else>✗</span>
                {{ r.code || r.id }} -
                <span v-if="r.success">{{ r.message }}</span>
                <span v-else class="text-danger">{{ r.error }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showBatchReviewModal = false">取消</button>
          <button class="btn btn-primary" @click="batchReview" :disabled="batchLoading">
            {{ batchLoading ? '处理中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBatchConfirmModal" class="modal-overlay" @click.self="showBatchConfirmModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>批量确认办结</h3>
          <button class="btn btn-outline btn-sm" @click="showBatchConfirmModal = false">×</button>
        </div>
        <div class="modal-body">
          <p>确认将选中的 <strong>{{ selectedIds.length }}</strong> 条工单确认办结？</p>
          <div v-if="batchOverdueCount > 0" class="alert alert-warning mt-4">
            其中 {{ batchOverdueCount }} 条已逾期
          </div>
          <div v-if="batchResult" class="mt-4">
            <div v-if="batchResult.success_count > 0" class="alert alert-success">
              成功 {{ batchResult.success_count }} 条
            </div>
            <div v-if="batchResult.fail_count > 0" class="alert alert-error">
              失败 {{ batchResult.fail_count }} 条
            </div>
            <div style="max-height: 300px; overflow-y: auto; margin-top: 12px;">
              <div v-for="r in batchResult.results" :key="r.id" class="text-sm" style="padding: 6px 0; border-bottom: 1px solid #f3f4f6;">
                <span class="text-success" v-if="r.success">✓</span>
                <span class="text-danger" v-else>✗</span>
                {{ r.code || r.id }} -
                <span v-if="r.success">{{ r.message }}</span>
                <span v-else class="text-danger">{{ r.error }}</span>
                <span v-if="!r.success && r.missing?.length > 0" class="text-danger" style="margin-left: 8px;">
                  （缺少：{{ r.missing.join('、') }}）
                </span>
                <span v-if="!r.success && r.error_code" class="text-muted" style="margin-left: 8px; font-size: 11px;">
                  [{{ r.error_code }}]
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showBatchConfirmModal = false">取消</button>
          <button class="btn btn-success" @click="batchConfirm" :disabled="batchLoading">
            {{ batchLoading ? '确认中...' : '确认办结' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useAuth } from '~/composables/useAuth'

const { get, post } = useApi()
const { baseRole, currentUserName, isInitialized } = useAuth()
const router = useRouter()

const tabs = [
  { value: 'pending_correction', label: '待补正' },
  { value: 'under_review', label: '复核中' },
  { value: 'completed', label: '办结' }
]

const activeTab = ref('pending_correction')
const workorders = ref<any[]>([])
const stats = ref<any>({})
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const keyword = ref('')
const warningFilter = ref('')
const nodeFilter = ref('')
const onlyMine = ref(false)
const loading = ref(false)
const error = ref('')
const selectedIds = ref<string[]>([])
const overdueCount = ref(0)
const warningCount = ref(0)
const pendingOverdue = ref(0)
const reviewOverdue = ref(0)

const showBatchModal = ref(false)
const showBatchReviewModal = ref(false)
const showBatchConfirmModal = ref(false)
const batchLoading = ref(false)
const batchResult = ref<any>(null)
const batchAction = ref('approve')
const batchRejectReason = ref('')

const filteredWorkorders = computed(() => {
  let result = workorders.value

  if (warningFilter.value) {
    result = result.filter(wo => wo.warning_level === warningFilter.value)
  }

  if (nodeFilter.value) {
    result = result.filter(wo => wo.current_node === nodeFilter.value)
  }

  return result
})

const activeWarningFilter = computed(() => warningFilter.value)

const showBatchSubmit = computed(() => {
  return activeTab.value === 'pending_correction' && baseRole.value === 'planner'
})

const showBatchReview = computed(() => {
  return activeTab.value === 'under_review' && baseRole.value === 'workshop_director'
})

const showBatchConfirm = computed(() => {
  return activeTab.value === 'under_review' && baseRole.value === 'factory_manager'
})

const canBatchSelect = computed(() => {
  return showBatchSubmit.value || showBatchReview.value || showBatchConfirm.value
})

const isAllSelected = computed(() => {
  if (filteredWorkorders.value.length === 0) return false
  const selectable = filteredWorkorders.value.filter(wo => canSelectWorkorder(wo))
  return selectable.length > 0 && selectable.every(wo => selectedIds.value.includes(wo.id))
})

const batchOverdueCount = computed(() => {
  return selectedIds.value.filter(id => {
    const wo = workorders.value.find(w => w.id === id)
    return wo?.warning_level === 'overdue'
  }).length
})

function getTabCount(tabValue: string) {
  if (tabValue === 'pending_correction') return stats.value?.pending_correction_count || 0
  if (tabValue === 'under_review') return stats.value?.under_review_count || 0
  if (tabValue === 'completed') return stats.value?.completed_count || 0
  return 0
}

function getTabBadgeClass(tabValue: string) {
  if (tabValue === 'pending_correction' && pendingOverdue.value > 0) return 'badge-overdue'
  if (tabValue === 'under_review' && reviewOverdue.value > 0) return 'badge-overdue'
  return 'badge-normal'
}

function canSelectWorkorder(wo: any) {
  if (wo.status !== activeTab.value) return false
  if (activeTab.value === 'pending_correction' && baseRole.value === 'planner') {
    return wo.current_handler_role === 'planner' && wo.planner === currentUserName.value
  }
  if (activeTab.value === 'under_review' && baseRole.value === 'workshop_director') {
    return wo.current_handler_role === 'workshop_director' && wo.workshop_director === currentUserName.value
  }
  if (activeTab.value === 'under_review' && baseRole.value === 'factory_manager') {
    return wo.current_handler_role === 'factory_manager' && wo.factory_manager === currentUserName.value
  }
  return false
}

function toggleSelect(id: string) {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    const selectableIds = filteredWorkorders.value.filter(wo => canSelectWorkorder(wo)).map(wo => wo.id)
    selectedIds.value = selectedIds.value.filter(id => !selectableIds.includes(id))
  } else {
    for (const wo of filteredWorkorders.value) {
      if (canSelectWorkorder(wo) && !selectedIds.value.includes(wo.id)) {
        selectedIds.value.push(wo.id)
      }
    }
  }
}

function getBadgeClass(status: string) {
  return {
    'badge-pending': status === 'pending_correction',
    'badge-review': status === 'under_review',
    'badge-completed': status === 'completed'
  }
}

function getWarningClass(level: string) {
  return {
    'badge-normal': level === 'normal',
    'badge-warning': level === 'warning',
    'badge-overdue': level === 'overdue'
  }
}

function getWarningLabel(level: string) {
  const labels: Record<string, string> = {
    normal: '正常',
    warning: '临期',
    overdue: '逾期'
  }
  return labels[level] || level
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').substring(0, 16)
}

function setWarningFilter(level: string) {
  warningFilter.value = level
  loadWorkorders()
}

function clearWarningFilter() {
  warningFilter.value = ''
  loadWorkorders()
}

function switchTab(tab: string) {
  activeTab.value = tab
  page.value = 1
  selectedIds.value = []
  warningFilter.value = ''
  nodeFilter.value = ''
  loadWorkorders()
}

function changePage(delta: number) {
  page.value += delta
  loadWorkorders()
}

async function loadWorkorders() {
  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams()
    params.append('status', activeTab.value)
    params.append('page', page.value.toString())
    params.append('pageSize', pageSize.value.toString())
    if (keyword.value) params.append('keyword', keyword.value)
    if (onlyMine.value) params.append('handler', 'mine')

    const res = await get<any>(`/workorders?${params.toString()}`)
    if (res.success && res.data) {
      workorders.value = res.data.list || []
      total.value = res.data.total || 0
      stats.value = res.data.stats || {}

      pendingOverdue.value = workorders.value.filter(
        w => w.status === 'pending_correction' && w.warning_level === 'overdue'
      ).length
      reviewOverdue.value = workorders.value.filter(
        w => w.status === 'under_review' && w.warning_level === 'overdue'
      ).length
    } else {
      error.value = res.error || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadWarningCounts() {
  const [warningRes, overdueRes] = await Promise.all([
    get<any>('/warnings?level=warning&pageSize=1'),
    get<any>('/warnings?level=overdue&pageSize=1')
  ])

  if (warningRes.success && warningRes.data) {
    warningCount.value = warningRes.data.total || 0
  }
  if (overdueRes.success && overdueRes.data) {
    overdueCount.value = overdueRes.data.total || 0
  }
}

function viewDetail(id: string) {
  router.push(`/workorder/${id}`)
}

async function batchSubmit() {
  batchLoading.value = true
  batchResult.value = null

  const items = selectedIds.value.map(id => {
    const wo = workorders.value.find(w => w.id === id)
    return { id, version: wo?.version || 1 }
  })

  const res = await post('/batch/submit', { items })
  if (res.success && res.data) {
    batchResult.value = res.data
    if (res.data.fail_count === 0) {
      setTimeout(() => {
        showBatchModal.value = false
        selectedIds.value = []
        loadWorkorders()
        loadWarningCounts()
      }, 1500)
    }
  }
  batchLoading.value = false
}

async function batchReview() {
  if (batchAction.value === 'reject' && !batchRejectReason.value.trim()) {
    alert('请填写退回原因')
    return
  }

  batchLoading.value = true
  batchResult.value = null

  const items = selectedIds.value.map(id => {
    const wo = workorders.value.find(w => w.id === id)
    return {
      id,
      version: wo?.version || 1,
      reject_reason: batchAction.value === 'reject' ? batchRejectReason.value : undefined
    }
  })

  const res = await post('/batch/review', { items, action: batchAction.value, remark: batchRejectReason.value })
  if (res.success && res.data) {
    batchResult.value = res.data
    if (res.data.fail_count === 0) {
      setTimeout(() => {
        showBatchReviewModal.value = false
        selectedIds.value = []
        loadWorkorders()
      }, 1500)
    }
  }
  batchLoading.value = false
}

async function batchConfirm() {
  batchLoading.value = true
  batchResult.value = null

  const items = selectedIds.value.map(id => {
    const wo = workorders.value.find(w => w.id === id)
    return { id, version: wo?.version || 1 }
  })

  const res = await post('/batch/confirm', { items })
  if (res.success && res.data) {
    batchResult.value = res.data
    if (res.data.fail_count === 0) {
      setTimeout(() => {
        showBatchConfirmModal.value = false
        selectedIds.value = []
        loadWorkorders()
      }, 1500)
    }
  }
  batchLoading.value = false
}

watch([baseRole, isInitialized], () => {
  if (isInitialized.value) {
    selectedIds.value = []
    loadWorkorders()
    loadWarningCounts()
  }
})

onMounted(() => {
  loadWorkorders()
  loadWarningCounts()
})
</script>

<style scoped>
.row-overdue {
  background-color: #fef2f2;
}
</style>
