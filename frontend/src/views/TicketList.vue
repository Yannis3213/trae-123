<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">客服工单列表</h1>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" @click="showCreate = true">+ 新建工单</button>
        <button class="btn btn-secondary" @click="loadData">🔄 刷新</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="card stat-card">
        <div class="stat-label">总工单</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="card stat-card stat-pending">
        <div class="stat-label">待处理</div>
        <div class="stat-value">{{ stats.pending }}</div>
      </div>
      <div class="card stat-card stat-processing">
        <div class="stat-label">处理中</div>
        <div class="stat-value">{{ stats.processing }}</div>
      </div>
      <div class="card stat-card stat-completed">
        <div class="stat-label">已完成</div>
        <div class="stat-value">{{ stats.completed }}</div>
      </div>
      <div class="card stat-card stat-overdue">
        <div class="stat-label">逾期</div>
        <div class="stat-value">{{ stats.overdue }}</div>
      </div>
      <div class="card stat-card stat-exception">
        <div class="stat-label">异常</div>
        <div class="stat-value">{{ stats.exception }}</div>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-item">
        <label>状态：</label>
        <select v-model="filters.status">
          <option value="">全部</option>
          <option value="pending_receipt">待签收</option>
          <option value="exception_returned">异常回传</option>
          <option value="receipt_completed">签收完成</option>
          <option value="call_registered">来电登记</option>
          <option value="dispatched">问题派单</option>
          <option value="callback_closed">回访关闭</option>
          <option value="archived">已归档</option>
        </select>
      </div>
      <div class="filter-item">
        <label>优先级：</label>
        <select v-model="filters.priority">
          <option value="">全部</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
      </div>
      <div class="filter-item">
        <label>到期：</label>
        <select v-model="filters.expiry">
          <option value="">全部</option>
          <option value="normal">正常</option>
          <option value="near_expiry">临期</option>
          <option value="overdue">逾期</option>
        </select>
      </div>
      <div class="filter-item">
        <label>关键字：</label>
        <input v-model="filters.keyword" placeholder="搜索标题/客户/描述" />
      </div>
      <div class="filter-item">
        <label>
          <input type="checkbox" v-model="filters.only_my" style="margin-right:4px;" />
          只看我的
        </label>
      </div>
      <div class="filter-actions">
        <button class="btn btn-secondary btn-sm" @click="resetFilters">重置</button>
        <button class="btn btn-primary btn-sm" @click="applyFilters">查询</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <input type="checkbox" :checked="allSelected" @change="toggleAll" />
          <span class="toolbar-info">
            已选 {{ selectedIds.length }} / {{ tickets.length }} 条 · 共 {{ response.total }} 条
          </span>
          <button class="btn btn-warning btn-sm" :disabled="selectedIds.length === 0" @click="openBatchProcess">
            批量处理 ({{ selectedIds.length }})
          </button>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width:36px;"></th>
            <th>工单标题</th>
            <th>客户</th>
            <th>状态</th>
            <th>优先级</th>
            <th>责任人</th>
            <th>当前处理人</th>
            <th>下一处理人</th>
            <th>截止时间</th>
            <th>到期预警</th>
            <th>异常标签</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in filteredTickets" :key="t.id">
            <td><input type="checkbox" :checked="selectedIds.includes(t.id)" @change="toggleOne(t.id)" /></td>
            <td>
              <button class="link-btn" @click="goDetail(t.id)">{{ t.title }}</button>
            </td>
            <td>
              <div>{{ t.customer_name }}</div>
              <div style="font-size:11px;color:#9ca3af;">{{ t.customer_phone }}</div>
            </td>
            <td><span :class="['status-tag', 'status-' + t.status]">{{ t.status_display }}</span></td>
            <td><span :class="['priority-tag', 'priority-' + t.priority]">{{ t.priority_display }}</span></td>
            <td>{{ t.responsible_name }}</td>
            <td>{{ t.current_handler_name }}</td>
            <td>
              <span v-if="t.next_handler_name" class="info-value" style="color:#2563eb;">{{ t.next_handler_name }}</span>
              <span v-else style="color:#9ca3af;">-</span>
            </td>
            <td>{{ formatDate(t.deadline) }}</td>
            <td><span :class="['expiry-tag', 'expiry-' + t.expiry_status]">{{ t.expiry_display }}</span></td>
            <td>
              <span v-for="tag in t.exception_tags" :key="tag" class="tag-chip">{{ tag }}</span>
              <span v-if="t.exception_tags.length === 0" style="color:#9ca3af;">-</span>
            </td>
            <td>
              <button class="link-btn" @click="goDetail(t.id)">办理</button>
            </td>
          </tr>
          <tr v-if="tickets.length === 0">
            <td colspan="12">
              <div class="empty">暂无工单数据</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button @click="prevPage" :disabled="page <= 1">上一页</button>
        <button @click="nextPage" :disabled="page >= totalPages">下一页</button>
      </div>
    </div>

    <!-- 创建工单 Modal -->
    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">新建客服工单</div>
          <button class="modal-close" @click="showCreate = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>工单标题 *</label>
            <input v-model="createForm.title" placeholder="请输入工单标题" />
          </div>
          <div class="form-group">
            <label>客户姓名 *</label>
            <input v-model="createForm.customer_name" placeholder="请输入客户姓名" />
          </div>
          <div class="form-group">
            <label>客户电话 *</label>
            <input v-model="createForm.customer_phone" placeholder="请输入客户电话" />
          </div>
          <div class="form-group">
            <label>优先级 *</label>
            <select v-model="createForm.priority">
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </div>
          <div class="form-group">
            <label>责任人 *</label>
            <select v-model="createForm.responsible_id">
              <option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.role_display }} - {{ u.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>截止天数（天）</label>
            <input type="number" v-model.number="createForm.deadline_days" min="1" />
          </div>
          <div class="form-group">
            <label>问题描述 *</label>
            <textarea v-model="createForm.description" rows="4" placeholder="请详细描述客户问题"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreate = false">取消</button>
          <button class="btn btn-primary" @click="onCreate" :disabled="creating">{{ creating ? '提交中...' : '创建' }}</button>
        </div>
      </div>
    </div>

    <!-- 批量处理 Modal -->
    <div v-if="showBatch" class="modal-mask" @click.self="closeBatch">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">批量处理工单 ({{ selectedIds.length }} 条)</div>
          <button class="modal-close" @click="closeBatch">×</button>
        </div>
        <div class="modal-body">
          <div v-if="batchResult" class="batch-results">
            <div class="batch-summary">
              <span>总计：{{ batchResult.total }} 条</span>
              <span style="color:#059669;">成功：{{ batchResult.success_count }} 条</span>
              <span style="color:#dc2626;">失败：{{ batchResult.failed_count }} 条</span>
            </div>
            <div v-for="r in batchResult.results" :key="r.ticket_id" :class="['batch-result-item', r.success ? 'success' : 'failed']">
              <div class="batch-item-header">
                <span class="batch-item-id">{{ r.ticket_id }}</span>
                <span :class="['batch-item-status', r.success ? 'ok' : 'err']">{{ r.success ? '✅ 成功' : '❌ 失败' }}</span>
              </div>
              <div class="batch-item-detail">
                <span>{{ r.message }}</span>
                <template v-if="r.success">
                  <span v-if="r.new_status" class="batch-item-meta">状态：{{ r.new_status }}</span>
                  <span v-if="r.new_handler_name" class="batch-item-meta">下一处理人：{{ r.new_handler_name }}</span>
                </template>
                <template v-else>
                  <span v-if="r.failed_reason" class="batch-item-reason">失败原因：{{ r.failed_reason }}</span>
                </template>
              </div>
            </div>
          </div>
          <div v-else>
            <div class="alert alert-info">
              批量操作将逐条校验角色、处理人、状态、版本，冲突或异常将单独拦截，不会整批放行。
            </div>
            <div class="form-group">
              <label>动作：</label>
              <select v-model="batchForm.action">
                <option value="签收">签收登记（按优先级交主管/质检）</option>
                <option value="派单">派单处理（交客服坐席）</option>
                <option value="回访关闭">回访关闭（交复核负责人）</option>
                <option value="签收完成">签收完成（交复核负责人）</option>
                <option value="复核归档">复核归档</option>
                <option value="退回补正">退回补正（交登记员）</option>
              </select>
            </div>
            <div class="form-group">
              <label>目标状态：</label>
              <select v-model="batchForm.target_status">
                <option value="call_registered">来电登记（下一处理人：主管/质检）</option>
                <option value="dispatched">问题派单（下一处理人：客服坐席）</option>
                <option value="receipt_completed">签收完成（下一处理人：复核负责人）</option>
                <option value="callback_closed">回访关闭（下一处理人：复核负责人）</option>
                <option value="exception_returned">异常回传（下一处理人：登记员）</option>
                <option value="archived">已归档</option>
              </select>
            </div>
            <div class="form-group">
              <label>备注：</label>
              <textarea v-model="batchForm.remark" rows="3"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer" v-if="!batchResult">
          <button class="btn btn-secondary" @click="closeBatch">取消</button>
          <button class="btn btn-primary" @click="onBatchProcess" :disabled="batchLoading">{{ batchLoading ? '处理中...' : '执行批量操作' }}</button>
        </div>
        <div class="modal-footer" v-else>
          <button class="btn btn-primary" @click="closeBatch">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/index.js'
import { getCurrentUser } from '../stores/auth.js'

const router = useRouter()

const currentUser = ref(getCurrentUser())
const tickets = ref([])
const response = ref({ items: [], total: 0, page: 1, page_size: 20 })
const stats = ref({ total: 0, pending: 0, processing: 0, completed: 0, overdue: 0, exception: 0 })
const allUsers = ref([])
const error = ref('')
const page = ref(1)
const pageSize = 20
const selectedIds = ref([])

const filters = reactive({
  status: '',
  priority: '',
  expiry: '',
  keyword: '',
  only_my: false,
})
const appliedFilters = ref({ ...filters })

const totalPages = computed(() => Math.max(1, Math.ceil(response.value.total / pageSize)))

const filteredTickets = computed(() => {
  let list = tickets.value
  if (appliedFilters.value.expiry) {
    list = list.filter(t => t.expiry_status === appliedFilters.value.expiry)
  }
  return list
})

const allSelected = computed(() => {
  if (tickets.value.length === 0) return false
  return tickets.value.every(t => selectedIds.value.includes(t.id))
})

const showCreate = ref(false)
const creating = ref(false)
const createForm = reactive({
  title: '',
  description: '',
  customer_name: '',
  customer_phone: '',
  priority: 'medium',
  responsible_id: '',
  deadline_days: 3,
})

const showBatch = ref(false)
const batchLoading = ref(false)
const batchResult = ref(null)
const batchForm = reactive({
  action: '签收',
  target_status: 'call_registered',
  remark: '',
})

onMounted(async () => {
  try {
    allUsers.value = await api.listUsers()
    if (allUsers.value.length > 0 && !createForm.responsible_id) {
      createForm.responsible_id = allUsers.value[0].id
    }
  } catch (e) {
    console.error(e)
  }
  loadData()
})

async function loadData() {
  error.value = ''
  try {
    const [listResp, statResp] = await Promise.all([
      api.listTickets({
        status: appliedFilters.value.status,
        priority: appliedFilters.value.priority,
        keyword: appliedFilters.value.keyword,
        only_my: appliedFilters.value.only_my ? 'true' : '',
        page: page.value,
        page_size: pageSize,
      }),
      api.getTicketStatistics(),
    ])
    response.value = listResp
    tickets.value = listResp.items
    stats.value = statResp
  } catch (e) {
    error.value = e.message
  }
}

function applyFilters() {
  appliedFilters.value = { ...filters }
  page.value = 1
  loadData()
}

function resetFilters() {
  Object.assign(filters, { status: '', priority: '', expiry: '', keyword: '', only_my: false })
  appliedFilters.value = { ...filters }
  page.value = 1
  loadData()
}

function prevPage() {
  if (page.value > 1) {
    page.value--
    loadData()
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++
    loadData()
  }
}

function toggleOne(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function toggleAll(e) {
  if (e.target.checked) {
    selectedIds.value = tickets.value.map(t => t.id)
  } else {
    selectedIds.value = []
  }
}

function goDetail(id) {
  router.push(`/tickets/${id}`)
}

async function onCreate() {
  if (!createForm.title || !createForm.description || !createForm.customer_name || !createForm.customer_phone) {
    alert('请填写所有必填项')
    return
  }
  creating.value = true
  try {
    await api.createTicket({ ...createForm })
    showCreate.value = false
    createForm.title = ''
    createForm.description = ''
    createForm.customer_name = ''
    createForm.customer_phone = ''
    loadData()
  } catch (e) {
    alert(e.message)
  } finally {
    creating.value = false
  }
}

function openBatchProcess() {
  batchResult.value = null
  showBatch.value = true
}

function closeBatch() {
  showBatch.value = false
  if (batchResult) {
    batchResult.value = null
    loadData()
  }
}

async function onBatchProcess() {
  batchLoading.value = true
  try {
    const version_map = {}
    selectedIds.value.forEach(id => {
      const t = tickets.value.find(x => x.id === id)
      if (t) version_map[id] = t.version
    })
    const resp = await api.batchProcess({
      ticket_ids: selectedIds.value,
      action: batchForm.action,
      target_status: batchForm.target_status,
      remark: batchForm.remark,
      version_map,
    })
    batchResult.value = resp
    selectedIds.value = []
  } catch (e) {
    alert(e.message)
  } finally {
    batchLoading.value = false
  }
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  const pad = n => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
</script>
