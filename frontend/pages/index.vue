<template>
  <div class="page-container">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">订单总数</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card stat-purple">
        <div class="stat-label">待派发</div>
        <div class="stat-value">{{ stats.pending_dispatch }}</div>
      </div>
      <div class="stat-card stat-yellow">
        <div class="stat-label">处理中</div>
        <div class="stat-value">{{ stats.processing }}</div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-label">已关闭</div>
        <div class="stat-value">{{ stats.closed }}</div>
      </div>
      <div class="stat-card stat-orange">
        <div class="stat-label">异常订单</div>
        <div class="stat-value">{{ stats.exception }}</div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-label">已逾期</div>
        <div class="stat-value">{{ stats.overdue }}</div>
      </div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom: 16px;">
        <h1>外贸订单列表 <span class="tag tag-blue" style="margin-left: 8px;">{{ currentRoleName }}队列</span></h1>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" @click="loadData">🔄 刷新</button>
          <button v-if="canCreateOrder" class="btn btn-primary" @click="showCreateModal = true">+ 新建订单</button>
        </div>
      </div>

      <div v-if="selectedProcessableCount > 0 && canBatchProcess" class="batch-bar">
        <span>已选择 <strong>{{ selectedProcessableCount }}</strong> 个可办理订单（共选中 {{ selectedIds.length }} 个）</span>
        <button class="btn btn-primary btn-sm" @click="showBatchModal = true">批量处理</button>
        <button class="btn btn-secondary btn-sm" @click="clearSelection">取消选择</button>
      </div>

      <div class="filter-bar">
        <div>
          <label>状态:</label>
          <select v-model="filters.status" @change="loadData">
            <option value="">全部</option>
            <option v-for="s in statusList" :key="s.code" :value="s.code">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label>阶段:</label>
          <select v-model="filters.stage" @change="loadData">
            <option value="">全部</option>
            <option v-for="s in stageList" :key="s.code" :value="s.code">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label>优先级:</label>
          <select v-model="filters.priority" @change="loadData">
            <option value="">全部</option>
            <option v-for="p in priorityList" :key="p.code" :value="p.code">{{ p.name }}</option>
          </select>
        </div>
        <div>
          <label>预警:</label>
          <select v-model="filters.warning_level" @change="loadData">
            <option value="">全部</option>
            <option v-for="w in warningList" :key="w.code" :value="w.code">{{ w.name }}</option>
          </select>
        </div>
        <div>
          <label>异常:</label>
          <select v-model="filters.is_exception" @change="loadData">
            <option value="">全部</option>
            <option value="true">仅异常</option>
            <option value="false">正常</option>
          </select>
        </div>
        <div>
          <input
            v-model="filters.keyword"
            placeholder="搜索订单号/客户/产品..."
            @keyup.enter="loadData"
          />
          <button class="btn btn-secondary btn-sm" style="margin-left: 4px;" @click="loadData">搜索</button>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th class="checkbox-cell">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  :disabled="!hasProcessable"
                />
              </th>
              <th>订单编号</th>
              <th>客户名称</th>
              <th>产品</th>
              <th>金额(USD)</th>
              <th>状态</th>
              <th>当前阶段</th>
              <th>优先级</th>
              <th>责任人</th>
              <th>当前处理人</th>
              <th>截止时间</th>
              <th>预警</th>
              <th>异常标签</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td class="checkbox-cell">
                <input
                  type="checkbox"
                  :value="order.id"
                  v-model="selectedIds"
                  :disabled="!order.can_process"
                />
              </td>
              <td>
                <a class="text-link" @click="goDetail(order.id)">{{ order.order_no }}</a>
              </td>
              <td>{{ order.customer_name }}</td>
              <td>{{ order.product_name }}</td>
              <td>{{ order.amount.toLocaleString() }}</td>
              <td>
                <span :class="['tag', statusTagClass(order.status)]">{{ order.status_display }}</span>
              </td>
              <td>
                <span class="tag tag-blue">{{ order.stage_display }}</span>
              </td>
              <td>
                <span :class="['priority-dot', 'priority-' + order.priority]"></span>
                {{ order.priority_display }}
              </td>
              <td>{{ order.responsible_person }}</td>
              <td>{{ order.current_handler || '-' }}</td>
              <td>{{ order.due_time ? formatDate(order.due_time) : '-' }}</td>
              <td>
                <span :class="['tag', warningTagClass(order.warning_level)]">
                  {{ order.warning_level_display }}
                </span>
              </td>
              <td>
                <div class="badge-row">
                  <span v-for="tag in order.exception_tags" :key="tag" class="tag tag-red">
                    {{ tag }}
                  </span>
                </div>
              </td>
              <td>{{ formatDate(order.create_time) }}</td>
              <td>
                <button class="btn btn-secondary btn-sm" @click="goDetail(order.id)">查看</button>
                <button v-if="order.can_process" class="btn btn-primary btn-sm" style="margin-left: 4px;" @click="goDetail(order.id)">
                  办理
                </button>
              </td>
            </tr>
            <tr v-if="orders.length === 0">
              <td colspan="15">
                <div class="empty-state">
                  <div class="empty-state-icon">📋</div>
                  <div>暂无订单数据</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 12px; font-size: 13px; color: #6b7280;">
        共 {{ total }} 条记录
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">新建外贸订单</div>
          <button class="modal-close" @click="showCreateModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>客户名称<span class="required">*</span></label>
              <input v-model="createForm.customer_name" placeholder="请输入客户名称" />
            </div>
            <div class="form-group">
              <label>产品名称<span class="required">*</span></label>
              <input v-model="createForm.product_name" placeholder="请输入产品名称" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>数量</label>
              <input type="number" v-model.number="createForm.quantity" placeholder="0" />
            </div>
            <div class="form-group">
              <label>金额(USD)</label>
              <input type="number" v-model.number="createForm.amount" placeholder="0" />
            </div>
            <div class="form-group">
              <label>目的国</label>
              <input v-model="createForm.country" placeholder="如：USA" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>优先级</label>
              <select v-model="createForm.priority">
                <option v-for="p in priorityList" :key="p.code" :value="p.code">{{ p.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>责任人</label>
              <input v-model="createForm.responsible_person" placeholder="责任人姓名" />
            </div>
            <div class="form-group">
              <label>截止时间</label>
              <input type="datetime-local" v-model="createForm.due_time" />
            </div>
          </div>
          <div class="form-group">
            <label>客户询盘内容</label>
            <textarea v-model="createForm.inquiry_content" placeholder="请输入客户询盘详情"></textarea>
          </div>
          <div v-if="createError" class="alert alert-error">{{ createError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" :disabled="creating" @click="submitCreate">
            {{ creating ? '创建中...' : '创建订单' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBatchModal" class="modal-overlay" @click.self="showBatchModal = false">
      <div class="modal" style="max-width: 800px;">
        <div class="modal-header">
          <div class="modal-title">批量处理订单 ({{ selectedIds.length }} 个)</div>
          <button class="modal-close" @click="showBatchModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>操作<span class="required">*</span></label>
              <select v-model="batchForm.action">
                <option value="">请选择操作</option>
                <option v-for="a in availableBatchActions" :key="a.code" :value="a.code">{{ a.name }}</option>
              </select>
            </div>
            <div v-if="batchForm.action === 'dispatch'" class="form-group">
              <label>派发到<span class="required">*</span></label>
              <select v-model="batchForm.dispatch_to_role">
                <option value="">请选择角色</option>
                <option v-for="r in roleList" :key="r.code" :value="r.code">{{ r.name }}</option>
              </select>
            </div>
          </div>
          <div v-if="['return'].includes(batchForm.action)" class="form-group">
            <label>退回原因<span class="required">*</span></label>
            <textarea v-model="batchForm.comment" placeholder="请输入退回原因"></textarea>
          </div>
          <div v-else class="form-group">
            <label>备注说明</label>
            <textarea v-model="batchForm.comment" placeholder="请输入处理说明"></textarea>
          </div>
          <div v-if="['return', 'correct'].includes(batchForm.action)" class="form-group">
            <label>补正动作要求</label>
            <textarea v-model="batchForm.corrective_action" placeholder="请描述需要补正的具体内容"></textarea>
          </div>
          <div v-if="['process', 'review', 'close'].includes(batchForm.action)" class="form-check" style="margin-bottom: 14px;">
            <input type="checkbox" v-model="batchForm.evidence_provided" id="ev-batch" />
            <label for="ev-batch">我已上传证据附件（办理/复核/归档必须）</label>
          </div>
          <div v-if="batchError" class="alert alert-error">{{ batchError }}</div>
          <div v-if="batchResult" class="card" style="margin-top: 16px;">
            <div class="section-title">批量处理结果</div>
            <div class="alert" :class="batchResult.failed_count > 0 ? 'alert-warning' : 'alert-success'">
              共 {{ batchResult.total }} 条，成功 {{ batchResult.success_count }} 条，失败 {{ batchResult.failed_count }} 条
              <span v-if="batchResult.failed_count > 0" style="font-size: 12px; margin-left: 8px;">（失败订单保留在原队列）</span>
            </div>
            <table style="margin-top: 8px;">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>结果</th>
                  <th>失败原因</th>
                  <th>错误码</th>
                  <th>新状态/阶段</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in batchResult.results" :key="r.order_id">
                  <td>{{ r.order_no }}</td>
                  <td>
                    <span :class="['tag', r.success ? 'tag-green' : 'tag-red']">
                      {{ r.success ? '成功' : '失败' }}
                    </span>
                  </td>
                  <td style="color: #b91c1c;">{{ r.error_message || '-' }}</td>
                  <td>
                    <span v-if="!r.success && r.error_code" class="tag tag-orange">{{ r.error_code }}</span>
                    <span v-else>-</span>
                  </td>
                  <td>
                    <span v-if="r.success">
                      {{ r.new_status }} / {{ r.new_stage }}
                    </span>
                    <span v-else class="tag tag-gray">保留原队列</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeBatchModal">关闭</button>
          <button class="btn btn-primary" :disabled="batchProcessing || !batchForm.action" @click="doBatchProcess">
            {{ batchProcessing ? '处理中...' : '执行批量处理' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OrderListItem, BatchProcessResponse } from '~/composables/types'

const { apiGet, apiPost } = useApi()
const { currentRole, roleList } = useUserStore()
const router = useRouter()

const currentRoleName = computed(() => {
  const r = roleList.find(x => x.code === currentRole.value)
  return r ? r.name : ''
})

const canCreateOrder = computed(() => currentRole.value === 'clerk')

const canBatchProcess = computed(() => ['clerk', 'supervisor', 'reviewer'].includes(currentRole.value))

const availableBatchActions = computed(() => {
  const role = currentRole.value
  const actions: { code: string; name: string }[] = []
  if (role === 'clerk' || role === 'supervisor') {
    actions.push({ code: 'dispatch', name: '派发' })
  }
  if (role === 'clerk' || role === 'supervisor') {
    actions.push({ code: 'correct', name: '补正' })
  }
  if (role === 'supervisor') {
    actions.push({ code: 'process', name: '办理' })
    actions.push({ code: 'return', name: '退回补正' })
  }
  if (role === 'reviewer') {
    actions.push({ code: 'review', name: '复核' })
    actions.push({ code: 'return', name: '退回补正' })
    actions.push({ code: 'close', name: '关闭归档' })
  }
  return actions
})

const orders = ref<OrderListItem[]>([])
const total = ref(0)
const stats = ref<Record<string, any>>({
  total: 0, pending_dispatch: 0, processing: 0, closed: 0, exception: 0, overdue: 0
})
const loading = ref(false)
const selectedIds = ref<number[]>([])

const statusList = ref([
  { code: 'pending_dispatch', name: '待派发' },
  { code: 'processing', name: '处理中' },
  { code: 'closed', name: '已关闭' },
])
const stageList = ref([
  { code: 'inquiry', name: '客户询盘' },
  { code: 'quote_confirmation', name: '报价确认' },
  { code: 'order_signing', name: '订单签订' },
  { code: 'archived', name: '已归档' },
])
const priorityList = ref([
  { code: 'low', name: '低' },
  { code: 'medium', name: '中' },
  { code: 'high', name: '高' },
  { code: 'urgent', name: '紧急' },
])
const warningList = ref([
  { code: 'normal', name: '正常' },
  { code: 'approaching', name: '临期' },
  { code: 'overdue', name: '逾期' },
])

const filters = reactive({
  status: '',
  stage: '',
  priority: '',
  warning_level: '',
  is_exception: '',
  keyword: ''
})

const isAllSelected = computed(() => {
  const processable = orders.value.filter(o => o.can_process)
  return processable.length > 0 && processable.every(o => selectedIds.value.includes(o.id))
})

const hasProcessable = computed(() => {
  return orders.value.some(o => o.can_process)
})

const selectedProcessableCount = computed(() => {
  return orders.value.filter(o => selectedIds.value.includes(o.id) && o.can_process).length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = orders.value.filter(o => o.can_process).map(o => o.id)
  }
}

const clearSelection = () => {
  selectedIds.value = []
}

const statusTagClass = (status: string) => {
  const map: Record<string, string> = {
    pending_dispatch: 'tag-purple',
    processing: 'tag-yellow',
    closed: 'tag-green'
  }
  return map[status] || 'tag-gray'
}

const warningTagClass = (level: string) => {
  const map: Record<string, string> = {
    normal: 'tag-green',
    approaching: 'tag-yellow',
    overdue: 'tag-red'
  }
  return map[level] || 'tag-gray'
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const loadData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { ...filters }
    if (params.is_exception === '') delete params.is_exception
    const res = await apiGet<any>('/orders', params)
    orders.value = res.items
    total.value = res.total
    stats.value = res.stats
  } catch (e: any) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const goDetail = (id: number) => {
  router.push(`/orders/${id}`)
}

const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = reactive({
  customer_name: '',
  product_name: '',
  quantity: 0,
  amount: 0,
  country: '',
  priority: 'medium',
  responsible_person: '',
  due_time: '',
  inquiry_content: ''
})

const submitCreate = async () => {
  if (!createForm.customer_name || !createForm.product_name) {
    createError.value = '客户名称和产品名称为必填项'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const body: any = { ...createForm }
    if (body.due_time) {
      body.due_time = new Date(body.due_time).toISOString()
    } else {
      delete body.due_time
    }
    await apiPost('/orders', body)
    showCreateModal.value = false
    Object.assign(createForm, {
      customer_name: '', product_name: '', quantity: 0, amount: 0,
      country: '', priority: 'medium', responsible_person: '',
      due_time: '', inquiry_content: ''
    })
    await loadData()
  } catch (e: any) {
    createError.value = e.data?.detail || e.message || '创建失败'
  } finally {
    creating.value = false
  }
}

const showBatchModal = ref(false)
const batchProcessing = ref(false)
const batchError = ref('')
const batchResult = ref<BatchProcessResponse | null>(null)
const batchForm = reactive({
  action: '',
  dispatch_to_role: '',
  comment: '',
  evidence_provided: false,
  corrective_action: ''
})

const doBatchProcess = async () => {
  batchError.value = ''
  batchResult.value = null
  if (!batchForm.action) {
    batchError.value = '请选择操作'
    return
  }
  if (batchForm.action === 'dispatch' && !batchForm.dispatch_to_role) {
    batchError.value = '请选择派发目标角色'
    return
  }
  if (batchForm.action === 'return' && !batchForm.comment.trim()) {
    batchError.value = '请填写退回原因'
    return
  }
  batchProcessing.value = true
  try {
    const items = selectedIds.value.map(id => {
      const order = orders.value.find(o => o.id === id)
      return {
        order_id: id,
        version: order ? 1 : 1,
        action: batchForm.action,
        comment: batchForm.comment,
        dispatch_to_role: batchForm.dispatch_to_role || null,
        evidence_provided: batchForm.evidence_provided,
        corrective_action: batchForm.corrective_action
      }
    })
    for (const item of items) {
      try {
        const detail = await apiGet<any>(`/orders/${item.order_id}`)
        item.version = detail.version
      } catch (e) {}
    }
    const res = await apiPost<BatchProcessResponse>('/batch/orders/process', { items, comment: batchForm.comment })
    batchResult.value = res
    await loadData()
    selectedIds.value = []
  } catch (e: any) {
    batchError.value = e.data?.detail || e.message || '批量处理失败'
  } finally {
    batchProcessing.value = false
  }
}

const closeBatchModal = () => {
  showBatchModal.value = false
  batchResult.value = null
  batchError.value = ''
  batchForm.action = ''
  batchForm.dispatch_to_role = ''
  batchForm.comment = ''
  batchForm.evidence_provided = false
  batchForm.corrective_action = ''
}

watch(currentRole, () => {
  loadData()
}, { immediate: true })
</script>
