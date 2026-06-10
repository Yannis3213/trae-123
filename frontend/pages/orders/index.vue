<script setup lang="ts">
import type {
  GroupOrder,
  OrderStatus,
  WarningStatus,
  UserRole,
  BatchProcessResult,
} from '~/types/order'

const ordersStore = useOrdersStore()
const authStore = useAuthStore()
const router = useRouter()

const selectedRows = ref<number[]>([])
const statusFilter = ref<OrderStatus | undefined>(undefined)
const warningFilter = ref<WarningStatus | undefined>(undefined)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)

const statusOptions = [
  { label: '全部状态', value: undefined },
  { label: '待派发', value: 'PENDING_ASSIGN' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已关闭', value: 'CLOSED' },
]

const warningOptions = [
  { label: '全部预警', value: undefined },
  { label: '正常', value: 'normal' },
  { label: '临期', value: 'approaching' },
  { label: '逾期', value: 'overdue' },
]

const columns = [
  { key: 'orderNo', label: '订单号' },
  { key: 'productName', label: '商品名' },
  { key: 'sku', label: 'SKU' },
  { key: 'orderStatus', label: '状态' },
  { key: 'currentRole', label: '当前处理角色' },
  { key: 'deadline', label: '截止日期' },
  { key: 'warningStatus', label: '预警状态' },
  { key: 'actions', label: '操作' },
]

const roleOptions = [
  { label: '团购登记员', value: 'GROUPON_REGISTRAR' },
  { label: '团购审核主管', value: 'AUDIT_SUPERVISOR' },
  { label: '复核负责人', value: 'REVIEW_LEADER' },
  { label: '团长运营', value: 'LEADER_OPERATOR' },
  { label: '履约专员', value: 'FULFILLMENT_SPECIALIST' },
  { label: '城市经理', value: 'CITY_MANAGER' },
]

const returnRoleOptions = [
  { label: '团长运营', value: 'LEADER_OPERATOR' },
  { label: '履约专员', value: 'FULFILLMENT_SPECIALIST' },
]

function getStatusColor(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PENDING_ASSIGN: 'amber',
    PROCESSING: 'blue',
    CLOSED: 'gray',
  }
  return map[status]
}

function getWarningColor(status: WarningStatus): string {
  const map: Record<WarningStatus, string> = {
    normal: 'green',
    approaching: 'amber',
    overdue: 'red',
  }
  return map[status]
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function handleRowSelect(rows: GroupOrder[]) {
  selectedRows.value = rows.map((r) => Number(r.id))
}

function goToDetail(id: number) {
  router.push(`/orders/${id}`)
}

async function handleSearch() {
  page.value = 1
  await loadOrders()
}

async function handleReset() {
  statusFilter.value = undefined
  warningFilter.value = undefined
  keyword.value = ''
  page.value = 1
  await loadOrders()
}

async function handlePageChange(p: number) {
  page.value = p
  await loadOrders()
}

const rawList = ref<GroupOrder[]>([])

const filteredList = computed(() => {
  if (!warningFilter.value) return ordersStore.list
  return ordersStore.list.filter((o) => o.warningStatus === warningFilter.value)
})

async function loadOrders() {
  const isOverdue = warningFilter.value === 'overdue' ? true : undefined
  const res = await ordersStore.fetchList({
    page: page.value,
    pageSize: pageSize.value,
    orderStatus: statusFilter.value,
    keyword: keyword.value || undefined,
    isOverdue,
  })
  rawList.value = res?.list || ordersStore.list
}

const batchMenuItems = [
  {
    label: '批量派发',
    icon: 'i-heroicons-paper-airplane',
    action: 'ASSIGN',
    allowedRoles: ['GROUPON_REGISTRAR', 'AUDIT_SUPERVISOR'],
    needsConfig: true,
  },
  {
    label: '批量处理',
    icon: 'i-heroicons-check-circle',
    action: 'PROCESS',
    allowedRoles: ['FULFILLMENT_SPECIALIST'],
    needsConfig: false,
  },
  {
    label: '批量关闭',
    icon: 'i-heroicons-x-circle',
    action: 'CLOSE',
    allowedRoles: ['REVIEW_LEADER', 'CITY_MANAGER'],
    needsConfig: false,
  },
  {
    label: '批量退回',
    icon: 'i-heroicons-arrow-uturn-left',
    action: 'RETURN',
    allowedRoles: ['REVIEW_LEADER', 'CITY_MANAGER', 'AUDIT_SUPERVISOR'],
    needsConfig: true,
  },
]

const availableBatchActions = computed(() =>
  batchMenuItems.filter((item) => item.allowedRoles.includes(authStore.currentRole))
)

const showBatchConfig = ref(false)
const batchActionType = ref('')
const batchTargetRole = ref<UserRole>('FULFILLMENT_SPECIALIST')
const batchTargetHandler = ref('')
const batchReturnReason = ref('')
const batchReturnToRole = ref<UserRole>('LEADER_OPERATOR')

const showBatchResult = ref(false)
const batchResult = ref<BatchProcessResult | null>(null)

function openBatchModal(action: string) {
  batchActionType.value = action
  const item = batchMenuItems.find((i) => i.action === action)
  if (item?.needsConfig) {
    if (action === 'ASSIGN') {
      batchTargetRole.value = 'FULFILLMENT_SPECIALIST'
      batchTargetHandler.value = ''
    } else if (action === 'RETURN') {
      batchReturnReason.value = ''
      batchReturnToRole.value = 'LEADER_OPERATOR'
    }
    showBatchConfig.value = true
  } else {
    confirmBatchAction()
  }
}

function canSubmitBatchConfig(): boolean {
  if (batchActionType.value === 'ASSIGN') {
    return batchTargetRole.value !== '' && batchTargetHandler.value.trim() !== ''
  }
  if (batchActionType.value === 'RETURN') {
    return batchReturnReason.value.trim() !== '' && batchReturnToRole.value !== ''
  }
  return true
}

async function confirmBatchAction() {
  if (selectedRows.value.length === 0) return

  const dto: any = {
    ids: selectedRows.value,
    action: batchActionType.value,
    operator: authStore.userName,
    operatorRole: authStore.currentRole,
  }

  if (batchActionType.value === 'ASSIGN') {
    dto.targetRole = batchTargetRole.value
    dto.targetHandler = batchTargetHandler.value
  }
  if (batchActionType.value === 'RETURN') {
    dto.reason = batchReturnReason.value
    dto.returnToRole = batchReturnToRole.value
  }

  showBatchConfig.value = false
  const result = await ordersStore.batchProcess(dto)
  batchResult.value = result
  showBatchResult.value = true
  selectedRows.value = []
  await loadOrders()
}

function viewFailedOrder(orderId: number) {
  showBatchResult.value = false
  router.push(`/orders/${orderId}`)
}

const totalPages = computed(() =>
  Math.ceil(ordersStore.total / pageSize.value)
)

const showCreateModal = ref(false)
const createForm = ref({
  productName: '',
  sku: '',
  shelfDate: new Date().toISOString().split('T')[0],
  grouponPrice: 0,
  quantity: 1,
})

async function submitCreate() {
  if (!createForm.value.productName || !createForm.value.sku || createForm.value.grouponPrice <= 0 || createForm.value.quantity <= 0) {
    useToast().add({
      title: '创建失败',
      description: '请填写完整的订单信息',
      color: 'red',
    })
    return
  }
  await ordersStore.createOrder({
    ...createForm.value,
  })
  showCreateModal.value = false
  createForm.value = {
    productName: '',
    sku: '',
    shelfDate: new Date().toISOString().split('T')[0],
    grouponPrice: 0,
    quantity: 1,
  }
  await loadOrders()
}

const canCreate = computed(() =>
  ['GROUPON_REGISTRAR', 'LEADER_OPERATOR'].includes(authStore.currentRole)
)

onMounted(async () => {
  await loadOrders()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">订单管理</h1>
        <p class="text-sm text-gray-500 mt-1">管理所有团购订单</p>
      </div>
      <UButton v-if="canCreate" color="primary" @click="showCreateModal = true">
        <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1.5" />
        新建订单
      </UButton>
    </div>

    <UCard class="shadow-sm">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">订单状态</label>
          <USelect
            v-model="statusFilter"
            :options="statusOptions"
            placeholder="选择状态"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">预警状态</label>
          <USelect
            v-model="warningFilter"
            :options="warningOptions"
            placeholder="选择预警"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">关键词搜索</label>
          <UInput
            v-model="keyword"
            placeholder="订单号 / 商品名 / SKU"
            icon="i-heroicons-magnifying-glass"
            @keyup.enter="handleSearch"
          />
        </div>
        <div class="flex items-end gap-2">
          <UButton color="primary" @click="handleSearch">
            <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 mr-1.5" />
            搜索
          </UButton>
          <UButton variant="ghost" @click="handleReset">
            重置
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard class="shadow-sm">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="font-semibold text-gray-900">订单列表</h2>
            <UBadge color="gray" variant="subtle">
              共 {{ ordersStore.total }} 条
            </UBadge>
          </div>
          <div v-if="selectedRows.length > 0 && availableBatchActions.length > 0" class="flex items-center gap-2">
            <UBadge color="primary" variant="subtle">
              已选 {{ selectedRows.length }} 条
            </UBadge>
            <UDropdown :popper="{ placement: 'bottom-end' }">
              <UButton color="primary" size="sm">
                <UIcon name="i-heroicons-ellipsis-horizontal" class="w-4 h-4 mr-1.5" />
                批量操作
              </UButton>
              <template #panel="{ open }">
                <div v-show="open" class="w-48 py-1">
                  <button
                    v-for="item in availableBatchActions"
                    :key="item.action"
                    @click="openBatchModal(item.action)"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <UIcon :name="item.icon" class="w-4 h-4" />
                    {{ item.label }}
                  </button>
                </div>
              </template>
            </UDropdown>
          </div>
        </div>
      </template>

      <UTable
        :rows="filteredList"
        :columns="columns"
        loading-state="loading"
        selectable
        :selected-rows="selectedRows"
        empty-state="暂无数据"
        @update:selected-rows="handleRowSelect"
      >
        <template #column-orderNo="{ row }">
          <button
            class="text-primary-600 hover:text-primary-700 font-medium text-sm"
            @click="goToDetail(row.id)"
          >
            {{ row.orderNo }}
          </button>
        </template>

        <template #column-productName="{ row }">
          <span class="text-sm text-gray-900">{{ row.productName }}</span>
        </template>

        <template #column-sku="{ row }">
          <span class="text-sm text-gray-600 font-mono">{{ row.sku }}</span>
        </template>

        <template #column-orderStatus="{ row }">
          <UBadge :color="getStatusColor(row.orderStatus)" variant="subtle" size="sm">
            {{ ordersStore.getStatusLabel(row.orderStatus) }}
          </UBadge>
        </template>

        <template #column-currentRole="{ row }">
          <span v-if="row.currentRole" class="text-sm text-gray-900">
            {{ ordersStore.getRoleLabel(row.currentRole) }}
          </span>
          <span v-else class="text-sm text-gray-400">-</span>
        </template>

        <template #column-deadline="{ row }">
          <span class="text-sm text-gray-600">{{ formatDate(row.deadline) }}</span>
        </template>

        <template #column-warningStatus="{ row }">
          <UBadge :color="getWarningColor(row.warningStatus)" variant="subtle" size="sm">
            {{ ordersStore.getWarningLabel(row.warningStatus) }}
          </UBadge>
        </template>

        <template #column-actions="{ row }">
          <UButton
            size="xs"
            variant="ghost"
            color="primary"
            @click="goToDetail(row.id)"
          >
            查看详情
            <UIcon name="i-heroicons-arrow-right" class="w-3.5 h-3.5 ml-1" />
          </UButton>
        </template>

        <template #loading>
          <div class="flex items-center justify-center py-12">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary" />
          </div>
        </template>

        <template #empty>
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <UIcon name="i-heroicons-inbox" class="w-12 h-12 mb-3 opacity-40" />
            <p>暂无订单数据</p>
          </div>
        </template>
      </UTable>

      <div
        v-if="ordersStore.total > 0"
        class="flex items-center justify-between px-1 py-4 border-t border-gray-100"
      >
        <div class="text-sm text-gray-500">
          显示第 {{ (page - 1) * pageSize + 1 }} -
          {{ Math.min(page * pageSize, ordersStore.total) }} 条，
          共 {{ ordersStore.total }} 条
        </div>
        <div class="flex items-center gap-1">
          <UButton
            size="sm"
            variant="ghost"
            :disabled="page <= 1"
            @click="handlePageChange(page - 1)"
          >
            <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
          </UButton>
          <div class="flex items-center gap-1">
            <button
              v-for="p in Math.min(totalPages, 7)"
              :key="p"
              @click="handlePageChange(p)"
              class="w-8 h-8 rounded-md text-sm font-medium transition-colors"
              :class="
                page === p
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              {{ p }}
            </button>
            <span v-if="totalPages > 7" class="px-1 text-gray-400">...</span>
            <button
              v-if="totalPages > 7"
              @click="handlePageChange(totalPages)"
              class="w-8 h-8 rounded-md text-sm font-medium transition-colors"
              :class="
                page === totalPages
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              {{ totalPages }}
            </button>
          </div>
          <UButton
            size="sm"
            variant="ghost"
            :disabled="page >= totalPages"
            @click="handlePageChange(page + 1)"
          >
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
          </UButton>
        </div>
      </div>
    </UCard>

    <UModal v-model="showBatchConfig">
      <UCard class="border-0">
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ batchMenuItems.find((i) => i.action === batchActionType)?.label }}
          </h3>
        </template>

        <div class="space-y-4">
          <p class="text-gray-600">
            已选择 <span class="font-semibold text-primary">{{ selectedRows.length }}</span> 条订单
          </p>

          <div v-if="batchActionType === 'ASSIGN'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              目标角色 <span class="text-red-500">*</span>
            </label>
            <USelect v-model="batchTargetRole" :options="roleOptions" placeholder="选择目标角色" />
          </div>

          <div v-if="batchActionType === 'ASSIGN'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              目标处理人 <span class="text-red-500">*</span>
            </label>
            <UInput v-model="batchTargetHandler" placeholder="请输入处理人姓名" />
          </div>

          <div v-if="batchActionType === 'RETURN'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              退回角色 <span class="text-red-500">*</span>
            </label>
            <USelect v-model="batchReturnToRole" :options="returnRoleOptions" placeholder="选择退回角色" />
          </div>

          <div v-if="batchActionType === 'RETURN'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              退回原因 <span class="text-red-500">*</span>
            </label>
            <UTextarea v-model="batchReturnReason" placeholder="请输入退回原因" rows="3" />
            <p v-if="!batchReturnReason.trim()" class="text-xs text-red-500 mt-1">请填写退回原因</p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showBatchConfig = false">
              取消
            </UButton>
            <UButton
              color="primary"
              :loading="ordersStore.submitting"
              :disabled="!canSubmitBatchConfig()"
              @click="confirmBatchAction"
            >
              确认执行
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showBatchResult" :ui="{ width: 'max-w-3xl' }">
      <UCard class="border-0">
        <template #header>
          <h3 class="text-lg font-semibold">批量操作结果</h3>
        </template>

        <div v-if="batchResult" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-green-50 rounded-lg p-4 border border-green-200">
              <div class="flex items-center gap-2 mb-3">
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-600" />
                <p class="text-sm font-semibold text-green-800">
                  成功 ({{ batchResult.success?.length || 0 }} 条)
                </p>
              </div>
              <div v-if="!batchResult.success || batchResult.success.length === 0" class="text-sm text-green-600 py-2">
                无
              </div>
              <ul v-else class="space-y-1.5 max-h-64 overflow-y-auto">
                <li
                  v-for="item in batchResult.success"
                  :key="item.id"
                  class="text-sm text-green-700 flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-check" class="w-4 h-4 text-green-500" />
                  <button
                    class="text-green-700 hover:text-green-900 hover:underline font-medium"
                    @click="viewFailedOrder(item.id)"
                  >
                    {{ item.orderNo }}
                  </button>
                </li>
              </ul>
            </div>

            <div class="bg-red-50 rounded-lg p-4 border border-red-200">
              <div class="flex items-center gap-2 mb-3">
                <UIcon name="i-heroicons-x-circle" class="w-5 h-5 text-red-600" />
                <p class="text-sm font-semibold text-red-800">
                  失败 ({{ batchResult.failed?.length || 0 }} 条)
                </p>
              </div>
              <div v-if="!batchResult.failed || batchResult.failed.length === 0" class="text-sm text-red-600 py-2">
                无
              </div>
              <ul v-else class="space-y-3 max-h-64 overflow-y-auto">
                <li
                  v-for="item in batchResult.failed"
                  :key="item.id"
                  class="text-sm text-red-700 p-2 bg-red-100/50 rounded"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon name="i-heroicons-x-mark" class="w-4 h-4 text-red-500" />
                    <button
                      class="font-medium text-red-700 hover:text-red-900 hover:underline"
                      @click="viewFailedOrder(item.id)"
                    >
                      {{ item.orderNo }}
                    </button>
                  </div>
                  <div class="ml-6 text-red-600">
                    <p><span class="font-medium">失败原因：</span>{{ item.reason }}</p>
                    <p v-if="item.needRole">
                      <span class="font-medium">需补正角色：</span>
                      {{ ordersStore.getRoleLabel(item.needRole) }}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="primary" @click="showBatchResult = false">
              确定
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showCreateModal">
      <UCard class="border-0">
        <template #header>
          <h3 class="text-lg font-semibold">新建团购订单</h3>
        </template>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">商品名称 <span class="text-red-500">*</span></label>
            <UInput v-model="createForm.productName" placeholder="请输入商品名称" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">SKU编码 <span class="text-red-500">*</span></label>
            <UInput v-model="createForm.sku" placeholder="请输入SKU编码" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">上架日期 <span class="text-red-500">*</span></label>
              <UInput v-model="createForm.shelfDate" type="date" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">团购单价（元） <span class="text-red-500">*</span></label>
              <UInput v-model.number="createForm.grouponPrice" type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">订单数量 <span class="text-red-500">*</span></label>
            <UInput v-model.number="createForm.quantity" type="number" min="1" placeholder="1" />
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showCreateModal = false">
              取消
            </UButton>
            <UButton color="primary" :loading="ordersStore.submitting" @click="submitCreate">
              创建
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
