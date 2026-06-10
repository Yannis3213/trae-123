<template>
  <div>
    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px;">
      <div class="stat-card">
        <div class="stat-number">{{ stats?.pending_correction_count || 0 }}</div>
        <div class="stat-label">待补正</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats?.under_review_count || 0 }}</div>
        <div class="stat-label">复核中</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #16a34a;">{{ stats?.completed_count || 0 }}</div>
        <div class="stat-label">已办结</div>
      </div>
      <div class="stat-card">
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
          </div>
        </div>
        <div class="flex gap-2">
          <button
            v-if="activeTab === 'pending_correction' && currentRole === 'planner'"
            class="btn btn-primary"
            @click="showBatchModal = true"
            :disabled="selectedIds.length === 0"
          >
            批量提交复核 ({{ selectedIds.length }})
          </button>
          <button
            v-if="activeTab === 'under_review' && currentRole === 'workshop_director'"
            class="btn btn-success"
            @click="showBatchReviewModal = true"
            :disabled="selectedIds.length === 0"
          >
            批量复核 ({{ selectedIds.length }})
          </button>
          <button
            v-if="activeTab === 'under_review' && currentRole === 'factory_manager'"
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
          <button class="btn btn-outline btn-sm" @click="loadWorkorders">搜索</button>
        </div>
        <div style="margin-left: auto;">
          <label class="text-sm text-muted">
            <input type="checkbox" v-model="onlyMine" class="checkbox" @change="loadWorkorders" />
            只看我的
          </label>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <table v-if="workorders.length > 0">
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
            <th>截止日期</th>
            <th>预警</th>
            <th>当前处理人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="wo in workorders" :key="wo.id">
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
            <td class="text-sm text-muted">{{ wo.current_node }}</td>
            <td class="text-sm">{{ formatDate(wo.deadline) }}</td>
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

      <div v-if="workorders.length === 0 && !loading" class="text-center" style="padding: 40px 0; color: #9ca3af;">
        暂无工单数据
      </div>

      <div v-if="loading" class="text-center" style="padding: 20px 0;">加载中...</div>

      <div class="flex-between mt-4">
        <div class="text-sm text-muted">
          共 {{ total }} 条
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
const { currentRole, currentUserName } = useAuth()
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
const pageSize = ref(20)
const keyword = ref('')
const warningFilter = ref('')
const onlyMine = ref(false)
const loading = ref(false)
const error = ref('')
const selectedIds = ref<string[]>([])
const overdueCount = ref(0)

const showBatchModal = ref(false)
const showBatchReviewModal = ref(false)
const showBatchConfirmModal = ref(false)
const batchLoading = ref(false)
const batchResult = ref<any>(null)
const batchAction = ref('approve')
const batchRejectReason = ref('')

const canBatchSelect = computed(() => {
  if (activeTab.value === 'pending_correction' && currentRole.value === 'planner') return true
  if (activeTab.value === 'under_review' && currentRole.value === 'workshop_director') return true
  if (activeTab.value === 'under_review' && currentRole.value === 'factory_manager') return true
  return false
})

const isAllSelected = computed(() => {
  if (workorders.value.length === 0) return false
  const selectable = workorders.value.filter(wo => canSelectWorkorder(wo))
  return selectable.length > 0 && selectable.every(wo => selectedIds.value.includes(wo.id))
})

function canSelectWorkorder(wo: any) {
  if (wo.status !== activeTab.value) return false
  if (activeTab.value === 'pending_correction' && currentRole.value === 'planner') {
    return wo.planner === currentUserName.value
  }
  if (activeTab.value === 'under_review' && currentRole.value === 'workshop_director') {
    return wo.workshop_director === currentUserName.value
  }
  if (activeTab.value === 'under_review' && currentRole.value === 'factory_manager') {
    return wo.factory_manager === currentUserName.value
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
    const selectableIds = workorders.value.filter(wo => canSelectWorkorder(wo)).map(wo => wo.id)
    selectedIds.value = selectedIds.value.filter(id => !selectableIds.includes(id))
  } else {
    for (const wo of workorders.value) {
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

function switchTab(tab: string) {
  activeTab.value = tab
  page.value = 1
  selectedIds.value = []
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
    } else {
      error.value = res.error || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadOverdueCount() {
  const res = await get<any>('/warnings?level=overdue&pageSize=1')
  if (res.success && res.data) {
    overdueCount.value = res.data.total || 0
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
        loadOverdueCount()
      }, 1000)
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
      }, 1000)
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
      }, 1000)
    }
  }
  batchLoading.value = false
}

watch(currentRole, () => {
  selectedIds.value = []
  loadWorkorders()
  loadOverdueCount()
})

onMounted(() => {
  loadWorkorders()
  loadOverdueCount()
})
</script>
