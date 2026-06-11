<template>
  <div class="dashboard">
    <div class="stats-row mb-4">
      <div class="stat-card" @click="setFilter('status', '')">
        <div class="stat-value text-primary-color">{{ stats?.total || 0 }}</div>
        <div class="stat-label">全部入会单</div>
      </div>
      <div class="stat-card" @click="setFilter('status', 'pending')">
        <div class="stat-value" style="color: #1890ff">{{ stats?.pending || 0 }}</div>
        <div class="stat-label">待核验</div>
      </div>
      <div class="stat-card" @click="setFilter('status', 'failed')">
        <div class="stat-value" style="color: #ff4d4f">{{ stats?.failed || 0 }}</div>
        <div class="stat-label">核验失败</div>
      </div>
      <div class="stat-card" @click="setFilter('status', 'completed')">
        <div class="stat-value" style="color: #52c41a">{{ stats?.completed || 0 }}</div>
        <div class="stat-label">核验完成</div>
      </div>
      <div class="stat-card stat-normal" @click="setFilter('expiry_status', 'normal')">
        <div class="stat-value">{{ stats?.normal || 0 }}</div>
        <div class="stat-label">正常</div>
      </div>
      <div class="stat-card stat-approaching" @click="setFilter('expiry_status', 'approaching')">
        <div class="stat-value">{{ stats?.approaching || 0 }}</div>
        <div class="stat-label">临期</div>
      </div>
      <div class="stat-card stat-overdue" @click="setFilter('expiry_status', 'overdue')">
        <div class="stat-value">{{ stats?.overdue || 0 }}</div>
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
              <button class="btn btn-sm btn-primary" @click="checkExceptions">
                🔄 刷新队列
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
                v-for="tab in viewTabs"
                :key="tab.value"
                class="tab-btn tab-btn-sm"
                :class="{ active: viewMode === tab.value }"
                @click="viewMode = tab.value"
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
                <div>队列异常：{{ EXCEPTION_LABELS[alert.exception_type as ExceptionTypeEnum] || alert.exception_type }}</div>
                <div class="text-sm text-secondary">{{ alert.member_name }}（#{{ alert.enrollment_id }}）：{{ alert.description }}</div>
              </div>
            </div>
          </div>

          <div v-if="viewMode === 'list'" class="table-container">
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
                  <th>证据</th>
                  <th>处理时限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in enrollments"
                  :key="item.id"
                  class="table-row-clickable"
                  :class="{ 'row-selected': selectedIds.includes(item.id) }"
                  @click="selectAndShowDetail(item)"
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
                  <td>
                    <div class="evidence-mini">
                      <span
                        v-for="(label, key) in EVIDENCE_LABELS"
                        :key="key"
                        class="evidence-dot"
                        :class="{ active: item.evidence_summary[key as string] }"
                        :title="label"
                      >
                        {{ item.evidence_summary[key as string] ? '✓' : '○' }}
                      </span>
                    </div>
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
                  <td colspan="13" class="text-center text-tertiary py-8">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="squad-view">
            <div class="squad-col squad-col-normal">
              <div class="squad-header">
                <span class="squad-title">🟢 正常</span>
                <span class="squad-count">{{ normalSquad.length }} 条</span>
              </div>
              <div class="squad-list">
                <div
                  v-for="item in normalSquad"
                  :key="item.id"
                  class="squad-card"
                  :class="{ selected: selectedIds.includes(item.id) }"
                  @click="selectAndShowDetail(item)"
                >
                  <div class="squad-card-header">
                    <span class="squad-name">{{ item.member_name }}</span>
                    <span class="tag tag-pending">{{ STATUS_LABELS[item.status] }}</span>
                  </div>
                  <div class="squad-card-body">
                    <div class="text-sm text-secondary">#{{ item.id }} · {{ item.membership_type }}</div>
                    <div class="evidence-mini mt-2">
                      <span
                        v-for="(label, key) in EVIDENCE_LABELS"
                        :key="key"
                        class="evidence-dot"
                        :class="{ active: item.evidence_summary[key as string] }"
                        :title="label"
                      >
                        {{ item.evidence_summary[key as string] ? '✓' : '○' }}
                      </span>
                    </div>
                    <div class="text-xs text-tertiary mt-2">{{ formatDate(item.due_at) }}</div>
                  </div>
                  <div v-if="item.has_exception" class="squad-card-badge">
                    <span class="tag tag-overdue tag-sm">有异常</span>
                  </div>
                </div>
                <div v-if="normalSquad.length === 0" class="squad-empty">暂无数据</div>
              </div>
            </div>

            <div class="squad-col squad-col-approaching">
              <div class="squad-header">
                <span class="squad-title">🟡 临期</span>
                <span class="squad-count">{{ approachingSquad.length }} 条</span>
              </div>
              <div class="squad-list">
                <div
                  v-for="item in approachingSquad"
                  :key="item.id"
                  class="squad-card"
                  :class="{ selected: selectedIds.includes(item.id) }"
                  @click="selectAndShowDetail(item)"
                >
                  <div class="squad-card-header">
                    <span class="squad-name">{{ item.member_name }}</span>
                    <span class="tag tag-approaching">{{ EXPIRY_LABELS.approaching }}</span>
                  </div>
                  <div class="squad-card-body">
                    <div class="text-sm text-secondary">#{{ item.id }} · {{ item.membership_type }}</div>
                    <div class="evidence-mini mt-2">
                      <span
                        v-for="(label, key) in EVIDENCE_LABELS"
                        :key="key"
                        class="evidence-dot"
                        :class="{ active: item.evidence_summary[key as string] }"
                        :title="label"
                      >
                        {{ item.evidence_summary[key as string] ? '✓' : '○' }}
                      </span>
                    </div>
                    <div class="text-xs text-approaching mt-2 font-medium">{{ formatDate(item.due_at) }}</div>
                  </div>
                  <div v-if="item.has_exception" class="squad-card-badge">
                    <span class="tag tag-overdue tag-sm">有异常</span>
                  </div>
                </div>
                <div v-if="approachingSquad.length === 0" class="squad-empty">暂无数据</div>
              </div>
            </div>

            <div class="squad-col squad-col-overdue">
              <div class="squad-header">
                <span class="squad-title">🔴 逾期</span>
                <span class="squad-count">{{ overdueSquad.length }} 条</span>
              </div>
              <div class="squad-list">
                <div
                  v-for="item in overdueSquad"
                  :key="item.id"
                  class="squad-card"
                  :class="{ selected: selectedIds.includes(item.id) }"
                  @click="selectAndShowDetail(item)"
                >
                  <div class="squad-card-header">
                    <span class="squad-name">{{ item.member_name }}</span>
                    <span class="tag tag-overdue">{{ EXPIRY_LABELS.overdue }}</span>
                  </div>
                  <div class="squad-card-body">
                    <div class="text-sm text-secondary">#{{ item.id }} · {{ item.membership_type }}</div>
                    <div class="evidence-mini mt-2">
                      <span
                        v-for="(label, key) in EVIDENCE_LABELS"
                        :key="key"
                        class="evidence-dot"
                        :class="{ active: item.evidence_summary[key as string] }"
                        :title="label"
                      >
                        {{ item.evidence_summary[key as string] ? '✓' : '○' }}
                      </span>
                    </div>
                    <div class="text-xs text-overdue mt-2 font-medium">{{ formatDate(item.due_at) }}</div>
                  </div>
                  <div v-if="item.has_exception" class="squad-card-badge">
                    <span class="tag tag-overdue tag-sm">有异常</span>
                  </div>
                </div>
                <div v-if="overdueSquad.length === 0" class="squad-empty">暂无数据</div>
              </div>
            </div>
          </div>

          <div v-if="viewMode === 'list'" class="pagination">
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
            <span v-if="selectedEnrollment" class="text-sm text-secondary">
              #{{ selectedEnrollment.id }} {{ selectedEnrollment.member_name }}
            </span>
          </div>
          <div class="card-body">
            <div v-if="selectedEnrollment" class="evidence-summary">
              <div v-for="(label, key) in EVIDENCE_LABELS" :key="key" class="evidence-item">
                <span class="evidence-icon" :class="{ valid: selectedEnrollment.evidence_summary[key as string] }">
                  {{ selectedEnrollment.evidence_summary[key as string] ? '✓' : '○' }}
                </span>
                <span class="evidence-label">{{ label }}</span>
                <span
                  class="evidence-status text-sm"
                  :class="selectedEnrollment.evidence_summary[key as string] ? 'text-success' : 'text-tertiary'"
                >
                  {{ selectedEnrollment.evidence_summary[key as string] ? '已上传' : '未上传' }}
                </span>
              </div>
            </div>
            <div v-else class="evidence-empty">
              <div class="text-tertiary text-center py-4">
                点击左侧单据查看证据摘要
              </div>
              <div class="evidence-summary mt-4">
                <div v-for="(label, key) in EVIDENCE_LABELS" :key="key" class="evidence-item">
                  <span class="evidence-icon">○</span>
                  <span class="evidence-label">{{ label }}</span>
                  <span class="evidence-status text-sm text-tertiary">待查看</span>
                </div>
              </div>
            </div>
            <div v-if="selectedEnrollment" class="evidence-quick mt-4">
              <button class="btn btn-primary btn-sm w-full" @click="goToDetail(selectedEnrollment.id)">
                进入详情办理 →
              </button>
            </div>
          </div>
        </div>

        <div v-if="selectedEnrollment" class="card mb-4">
          <div class="card-header">
            <span>单据概况</span>
          </div>
          <div class="card-body">
            <div class="info-row">
              <span class="info-label">状态</span>
              <span class="tag" :class="'tag-' + selectedEnrollment.status">
                {{ STATUS_LABELS[selectedEnrollment.status] }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">版本</span>
              <span class="text-secondary">v{{ selectedEnrollment.version }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">会籍</span>
              <span>{{ selectedEnrollment.membership_type }} / {{ selectedEnrollment.card_level || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">金额</span>
              <span class="font-medium">¥{{ selectedEnrollment.amount }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">销售/私教</span>
              <span class="text-sm">{{ selectedEnrollment.salesperson || '-' }} / {{ selectedEnrollment.private_trainer || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">处理时限</span>
              <span
                class="text-sm"
                :class="{
                  'text-overdue': selectedEnrollment.expiry_status === 'overdue',
                  'text-approaching': selectedEnrollment.expiry_status === 'approaching',
                }"
              >
                {{ formatDate(selectedEnrollment.due_at) }}
              </span>
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
                :disabled="selectedIds.length === 0"
                @click="showBatchModal = true"
              >
                批量审核{{ selectedIds.length > 0 ? ` (${selectedIds.length})` : '' }}
              </button>
              <button
                v-if="canBatchReview"
                class="btn w-full mb-2"
                :disabled="selectedIds.length === 0"
                @click="showBatchModal = true"
              >
                批量复核{{ selectedIds.length > 0 ? ` (${selectedIds.length})` : '' }}
              </button>
            </div>
            <div class="mt-4 text-xs text-tertiary">
              <div>当前角色：{{ ROLE_LABELS[auth.userRole.value as RoleEnum] || '未登录' }}</div>
              <div class="mt-1">我的待办：{{ stats?.my_todo || 0 }} 条</div>
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
  ROLE_LABELS,
  type Enrollment,
  type EnrollmentListResponse,
  type StatsResponse,
  type StatusEnum,
  type ExpiryStatusEnum,
  type ExceptionTypeEnum,
  type RoleEnum,
} from '~/types'
import CreateEnrollmentModal from '~/components/CreateEnrollmentModal.vue'
import BatchProcessModal from '~/components/BatchProcessModal.vue'

const auth = useAuth()
const api = useEnrollmentApi()

const listData = ref<EnrollmentListResponse | null>(null)
const stats = ref<StatsResponse | null>(null)
const enrollments = computed(() => listData.value?.items || [])

const exceptionAlerts = ref<any[]>([])

const viewMode = ref<'list' | 'squad'>('squad')

const filters = ref({
  status: '' as StatusEnum | '',
  expiry_status: '' as ExpiryStatusEnum | '',
  store: '',
  keyword: '',
  my_todo: false,
  page: 1,
  page_size: 50,
})

const selectedIds = ref<number[]>([])
const selectedEnrollment = ref<Enrollment | null>(null)

const showCreateModal = ref(false)
const showBatchModal = ref(false)

const normalSquad = computed(() =>
  enrollments.value.filter((e) => e.expiry_status === 'normal')
)
const approachingSquad = computed(() =>
  enrollments.value.filter((e) => e.expiry_status === 'approaching')
)
const overdueSquad = computed(() =>
  enrollments.value.filter((e) => e.expiry_status === 'overdue')
)

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待核验', value: 'pending' },
  { label: '核验失败', value: 'failed' },
  { label: '核验完成', value: 'completed' },
]

const viewTabs = [
  { label: '分队视图', value: 'squad' },
  { label: '列表视图', value: 'list' },
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
    if (selectedIds.value.length > 0 && selectedEnrollment.value) {
      const found = listData.value.items.find((e) => e.id === selectedEnrollment.value?.id)
      if (found) {
        selectedEnrollment.value = found
      }
    }
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

const selectAndShowDetail = (item: Enrollment) => {
  selectedEnrollment.value = item
  const idx = selectedIds.value.indexOf(item.id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(item.id)
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
    return `${dateStrFormatted}（已逾期${Math.abs(diffDays)}天）`
  } else if (diffDays <= 1) {
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    return `${dateStrFormatted}（还剩${diffHours}小时）`
  }
  return `${dateStrFormatted}（还剩${diffDays}天）`
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

.stat-card {
  cursor: pointer;
  transition: all 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-normal .stat-value {
  color: #52c41a;
}

.stat-approaching .stat-value {
  color: #faad14;
}

.stat-overdue .stat-value {
  color: #ff4d4f;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 320px;
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

.row-selected {
  background-color: #e6f7ff !important;
}

.evidence-mini {
  display: flex;
  gap: 4px;
}

.evidence-dot {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border-radius: 50%;
  background: #f0f0f0;
  color: #bfbfbf;
}

.evidence-dot.active {
  background: #f6ffed;
  color: #52c41a;
}

.squad-view {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px;
  min-height: 400px;
}

.squad-col {
  background: #fafafa;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.squad-col-normal {
  border: 1px solid #b7eb8f;
}

.squad-col-approaching {
  border: 1px solid #ffe58f;
}

.squad-col-overdue {
  border: 1px solid #ffa39e;
}

.squad-header {
  padding: 12px 16px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e8e8e8;
}

.squad-title {
  font-size: 14px;
}

.squad-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: #fff;
  padding: 2px 8px;
  border-radius: 10px;
}

.squad-list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.squad-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.squad-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color);
}

.squad-card.selected {
  border-color: var(--primary-color);
  background: #e6f7ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
}

.squad-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.squad-name {
  font-weight: 600;
  font-size: 14px;
}

.squad-card-body {
  font-size: 13px;
}

.squad-card-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}

.squad-empty {
  text-align: center;
  padding: 32px 0;
  color: #bfbfbf;
  font-size: 13px;
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
  gap: 8px;
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
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #bfbfbf;
  font-weight: bold;
  border-radius: 50%;
  background: #f5f5f5;
}

.evidence-icon.valid {
  color: #fff;
  background: #52c41a;
}

.evidence-label {
  flex: 1;
  font-size: 13px;
}

.evidence-empty {
  padding: 8px 0;
}

.evidence-quick {
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed #f5f5f5;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: var(--text-secondary);
}

.quick-actions {
  display: flex;
  flex-direction: column;
}

.w-full {
  width: 100%;
}

.text-center {
  text-align: center;
}

.py-4 {
  padding: 16px 0;
}

.py-8 {
  padding: 32px 0;
}

.text-primary-color {
  color: var(--primary-color);
}

.text-success {
  color: #52c41a;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-tertiary {
  color: #bfbfbf;
}

.text-overdue {
  color: #ff4d4f;
}

.text-approaching {
  color: #faad14;
}

.text-sm {
  font-size: 12px;
}

.text-xs {
  font-size: 11px;
}

.font-medium {
  font-weight: 500;
}

.exception-alerts {
  padding: 12px 20px;
}

.mt-2 {
  margin-top: 8px;
}

.mt-4 {
  margin-top: 16px;
}

.mb-4 {
  margin-bottom: 16px;
}

.tag-sm {
  font-size: 10px;
  padding: 1px 6px;
}
</style>
