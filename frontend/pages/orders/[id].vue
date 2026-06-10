<script setup lang="ts">
import type {
  GroupOrder,
  OrderStatus,
  WarningStatus,
  UserRole,
  ReasonType,
} from '~/types/order'

const route = useRoute()
const router = useRouter()
const ordersStore = useOrdersStore()
const authStore = useAuthStore()

const orderId = computed(() => Number(route.params.id))

const showActionModal = ref(false)
const currentAction = ref('')
const actionRemark = ref('')
const reviewPassed = ref(true)

const assignHandler = ref('')
const assignRole = ref<UserRole>('FULFILLMENT_SPECIALIST')
const assignDeadline = ref('')

const returnReason = ref('')
const returnToRole = ref<UserRole>('GROUPON_REGISTRAR')

const correctMaterialComplete = ref(false)
const correctShelfEvidence = ref('')
const correctOrderEvidence = ref('')
const correctDeliveryEvidence = ref('')

const noteContent = ref('')
const showNoteModal = ref(false)

const exceptionReasons = ref<{ reason: string; reasonType: ReasonType }[]>([
  { reason: '', reasonType: 'other' },
])

const roleOptions = [
  { label: '团购登记员', value: 'GROUPON_REGISTRAR' },
  { label: '团购审核主管', value: 'AUDIT_SUPERVISOR' },
  { label: '复核负责人', value: 'REVIEW_LEADER' },
  { label: '团长运营', value: 'LEADER_OPERATOR' },
  { label: '履约专员', value: 'FULFILLMENT_SPECIALIST' },
  { label: '城市经理', value: 'CITY_MANAGER' },
]

const reasonTypeOptions = [
  { label: '逾期', value: 'overdue' },
  { label: '冲突', value: 'conflict' },
  { label: '材料缺失', value: 'material_missing' },
  { label: '其他', value: 'other' },
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '未知'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const availableActions = computed(() => {
  const order = ordersStore.detail
  if (!order) return []

  const role = authStore.currentRole
  const actions: { label: string; action: string; color: string; variant: string }[] = []

  if (
    (role === 'GROUPON_REGISTRAR' || role === 'AUDIT_SUPERVISOR') &&
    order.orderStatus === 'PENDING_ASSIGN'
  ) {
    actions.push({ label: '派发订单', action: 'assign', color: 'primary', variant: 'solid' })
  }

  if (role === 'FULFILLMENT_SPECIALIST' && order.orderStatus === 'PROCESSING') {
    actions.push({ label: '处理订单', action: 'process', color: 'green', variant: 'solid' })
  }

  if (
    (role === 'REVIEW_LEADER' || role === 'CITY_MANAGER') &&
    order.orderStatus === 'PROCESSING'
  ) {
    actions.push({ label: '复核通过并关闭', action: 'review_pass', color: 'green', variant: 'solid' })
    actions.push({ label: '复核驳回', action: 'review_reject', color: 'red', variant: 'ghost' })
    actions.push({ label: '退回订单', action: 'return', color: 'amber', variant: 'ghost' })
  }

  if (role === 'LEADER_OPERATOR' && order.orderStatus !== 'CLOSED') {
    actions.push({ label: '补正材料', action: 'correct', color: 'primary', variant: 'solid' })
  }

  return actions
})

function openActionModal(action: string) {
  currentAction.value = action
  actionRemark.value = ''
  reviewPassed.value = !action.includes('reject')
  assignHandler.value = ''
  assignRole.value = 'FULFILLMENT_SPECIALIST'
  assignDeadline.value = ''
  returnReason.value = ''
  returnToRole.value = 'GROUPON_REGISTRAR'
  correctMaterialComplete.value = false
  correctShelfEvidence.value = ''
  correctOrderEvidence.value = ''
  correctDeliveryEvidence.value = ''
  exceptionReasons.value = [{ reason: '', reasonType: 'other' }]
  showActionModal.value = true
}

function addExceptionReason() {
  exceptionReasons.value.push({ reason: '', reasonType: 'other' })
}

function removeExceptionReason(index: number) {
  if (exceptionReasons.value.length > 1) {
    exceptionReasons.value.splice(index, 1)
  }
}

async function submitAction() {
  if (!ordersStore.detail) return

  const version = ordersStore.detail.version

  if (currentAction.value === 'assign') {
    await ordersStore.assignOrder(orderId.value, {
      handler: assignHandler.value,
      role: assignRole.value,
      deadline: assignDeadline.value || undefined,
      comment: actionRemark.value || undefined,
      version,
    })
  } else if (currentAction.value === 'process') {
    await ordersStore.processOrder(orderId.value, {
      comment: actionRemark.value || undefined,
      version,
      isMaterialComplete: correctMaterialComplete.value,
    })
  } else if (currentAction.value === 'review_pass' || currentAction.value === 'review_reject') {
    const validReasons = reviewPassed.value
      ? undefined
      : exceptionReasons.value.filter((r) => r.reason && r.reasonType)
    await ordersStore.reviewOrder(orderId.value, {
      passed: currentAction.value === 'review_pass',
      comment: actionRemark.value,
      version,
      exceptionReasons: validReasons?.length ? validReasons : undefined,
    })
  } else if (currentAction.value === 'return') {
    await ordersStore.returnOrder(orderId.value, {
      reason: returnReason.value,
      returnToRole: returnToRole.value,
      operator: authStore.userName,
      operatorRole: authStore.currentRole,
      version,
      comment: actionRemark.value,
    })
  } else if (currentAction.value === 'correct') {
    await ordersStore.correctOrder(orderId.value, {
      comment: actionRemark.value || undefined,
      version,
      isMaterialComplete: correctMaterialComplete.value,
      shelfEvidence: correctShelfEvidence.value || undefined,
      orderEvidence: correctOrderEvidence.value || undefined,
      deliveryEvidence: correctDeliveryEvidence.value || undefined,
    })
  }

  showActionModal.value = false
}

async function submitNote() {
  if (!noteContent.value.trim()) return
  await ordersStore.addNote(orderId.value, {
    content: noteContent.value,
  })
  noteContent.value = ''
  showNoteModal.value = false
}

function goBack() {
  router.push('/orders')
}

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    authStore.login()
  }
  await ordersStore.fetchDetail(orderId.value)
})

onBeforeUnmount(() => {
  ordersStore.clearDetail()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <UButton variant="ghost" size="sm" @click="goBack">
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1.5" />
        返回列表
      </UButton>
      <div class="h-5 w-px bg-gray-200"></div>
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">订单详情</h1>
      </div>
    </div>

    <div v-if="ordersStore.detailLoading" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <template v-else-if="ordersStore.detail">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <UCard class="shadow-sm">
            <template #header>
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-3">
                    <h2 class="text-lg font-semibold text-gray-900">
                      {{ ordersStore.detail.productName }}
                    </h2>
                    <UBadge :color="getStatusColor(ordersStore.detail.orderStatus)" variant="subtle">
                      {{ ordersStore.getStatusLabel(ordersStore.detail.orderStatus) }}
                    </UBadge>
                    <UBadge :color="getWarningColor(ordersStore.detail.warningStatus)" variant="subtle">
                      {{ ordersStore.getWarningLabel(ordersStore.detail.warningStatus) }}
                    </UBadge>
                    <UBadge
                      v-if="ordersStore.detail.isOverdue"
                      color="red"
                      variant="subtle"
                    >
                      已逾期
                    </UBadge>
                  </div>
                  <p class="text-sm text-gray-500 mt-1">
                    订单号：{{ ordersStore.detail.orderNo }} · SKU：{{ ordersStore.detail.sku }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UButton
                    v-for="act in availableActions"
                    :key="act.action"
                    :color="act.color"
                    :variant="act.variant"
                    size="sm"
                    @click="openActionModal(act.action)"
                  >
                    {{ act.label }}
                  </UButton>
                </div>
              </div>
            </template>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">上架日期</p>
                <p class="text-sm text-gray-900 mt-1">{{ formatDate(ordersStore.detail.shelfDate) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">团购单价</p>
                <p class="text-sm text-gray-900 mt-1 font-medium">
                  ¥ {{ Number(ordersStore.detail.grouponPrice).toLocaleString() }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">订单数量</p>
                <p class="text-sm text-gray-900 mt-1">{{ ordersStore.detail.quantity }} 件</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">订单金额</p>
                <p class="text-sm text-gray-900 mt-1 font-medium">
                  ¥ {{ Number(ordersStore.detail.totalAmount).toLocaleString() }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">当前处理人</p>
                <p class="text-sm text-gray-900 mt-1">{{ ordersStore.detail.currentHandler || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">当前处理角色</p>
                <p class="text-sm text-gray-900 mt-1">
                  {{ ordersStore.detail.currentRole ? ordersStore.getRoleLabel(ordersStore.detail.currentRole) : '-' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">截止日期</p>
                <p class="text-sm text-gray-900 mt-1">{{ formatDate(ordersStore.detail.deadline) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">材料是否完整</p>
                <UBadge
                  :color="ordersStore.detail.isMaterialComplete ? 'green' : 'amber'"
                  variant="subtle"
                  size="sm"
                  class="mt-1"
                >
                  {{ ordersStore.detail.isMaterialComplete ? '完整' : '待补正' }}
                </UBadge>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">创建人</p>
                <p class="text-sm text-gray-900 mt-1">{{ ordersStore.detail.createdBy }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">创建时间</p>
                <p class="text-sm text-gray-900 mt-1">{{ formatDate(ordersStore.detail.createdAt) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">更新时间</p>
                <p class="text-sm text-gray-900 mt-1">{{ formatDate(ordersStore.detail.updatedAt) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">版本号</p>
                <p class="text-sm text-gray-900 mt-1">v{{ ordersStore.detail.version }}</p>
              </div>
            </div>

            <div v-if="ordersStore.detail.overdueReason" class="mt-6">
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">逾期原因</p>
              <p class="text-sm text-red-600 mt-1">{{ ordersStore.detail.overdueReason }}</p>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">上架凭证</p>
                <p class="text-sm text-gray-900 mt-1">{{ ordersStore.detail.shelfEvidence || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">订单凭证</p>
                <p class="text-sm text-gray-900 mt-1">{{ ordersStore.detail.orderEvidence || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">履约凭证</p>
                <p class="text-sm text-gray-900 mt-1">{{ ordersStore.detail.deliveryEvidence || '-' }}</p>
              </div>
            </div>

            <div
              v-if="ordersStore.detail.exceptionReasons && ordersStore.detail.exceptionReasons.length > 0"
              class="mt-6 p-4 bg-red-50 rounded-lg border border-red-100"
            >
              <div class="flex items-center gap-2 mb-2">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
                <p class="text-sm font-semibold text-red-800">异常原因</p>
              </div>
              <ul class="space-y-1">
                <li
                  v-for="(reason, idx) in ordersStore.detail.exceptionReasons"
                  :key="idx"
                  class="text-sm text-red-700"
                >
                  <UBadge size="xs" variant="subtle" color="red" class="mr-2">
                    {{ ordersStore.getReasonTypeLabel(reason.reasonType) }}
                  </UBadge>
                  {{ reason.reason }}
                  <span class="text-xs text-red-500 ml-2">
                    · {{ reason.operator }} · {{ formatDate(reason.createdAt) }}
                  </span>
                </li>
              </ul>
            </div>
          </UCard>

          <UCard class="shadow-sm">
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="font-semibold text-gray-900">处理记录</h2>
              </div>
            </template>
            <div v-if="ordersStore.detail.processingRecords.length === 0" class="text-sm text-gray-500 py-4">
              暂无处理记录
            </div>
            <UTimeline v-else>
              <UTimelineItem
                v-for="record in ordersStore.detail.processingRecords"
                :key="record.id"
                :title="ordersStore.getActionTypeLabel(record.actionType)"
                :date="formatDate(record.createdAt)"
              >
                <template #icon>
                  <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <UIcon name="i-heroicons-check" class="w-4 h-4 text-primary" />
                  </div>
                </template>
                <p class="text-sm text-gray-600">
                  <span class="font-medium">{{ record.operator }}</span>
                  <span class="text-gray-400"> · </span>
                  <span>{{ ordersStore.getRoleLabel(record.operatorRole) }}</span>
                  <span class="text-gray-400"> · v{{ record.version }}</span>
                </p>
                <p v-if="record.previousStatus || record.newStatus" class="text-sm text-gray-500 mt-1">
                  状态变更：
                  <span v-if="record.previousStatus">{{ ordersStore.getStatusLabel(record.previousStatus) }}</span>
                  <span v-if="record.previousStatus && record.newStatus"> → </span>
                  <span v-if="record.newStatus">{{ ordersStore.getStatusLabel(record.newStatus) }}</span>
                </p>
                <p v-if="record.previousHandler || record.newHandler" class="text-sm text-gray-500 mt-1">
                  处理人变更：
                  <span v-if="record.previousHandler">{{ record.previousHandler }}</span>
                  <span v-if="record.previousHandler && record.newHandler"> → </span>
                  <span v-if="record.newHandler">{{ record.newHandler }}</span>
                </p>
                <p v-if="record.comment" class="text-sm text-gray-500 mt-1">
                  备注：{{ record.comment }}
                </p>
              </UTimelineItem>
            </UTimeline>
          </UCard>

          <UCard class="shadow-sm">
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="font-semibold text-gray-900">审计备注</h2>
                <UButton size="xs" color="primary" variant="ghost" @click="showNoteModal = true">
                  <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5 mr-1" />
                  添加备注
                </UButton>
              </div>
            </template>
            <div v-if="ordersStore.detail.auditNotes.length === 0" class="text-sm text-gray-500 py-4">
              暂无审计备注
            </div>
            <div v-else class="space-y-4">
              <div
                v-for="note in ordersStore.detail.auditNotes"
                :key="note.id"
                class="p-4 bg-gray-50 rounded-lg"
              >
                <div class="flex items-center gap-2 mb-2">
                  <UAvatar :name="note.author" size="xs" />
                  <p class="text-sm font-medium text-gray-900">{{ note.author }}</p>
                  <UBadge size="xs" variant="subtle" color="primary">
                    {{ ordersStore.getRoleLabel(note.authorRole) }}
                  </UBadge>
                  <p class="text-xs text-gray-500">{{ formatDate(note.createdAt) }}</p>
                </div>
                <p class="text-sm text-gray-700">{{ note.content }}</p>
              </div>
            </div>
          </UCard>
        </div>

        <div class="space-y-6">
          <UCard class="shadow-sm">
            <template #header>
              <h2 class="font-semibold text-gray-900">附件列表</h2>
            </template>
            <div v-if="ordersStore.detail.attachments.length === 0" class="text-sm text-gray-500 py-4">
              暂无附件
            </div>
            <ul v-else class="space-y-3">
              <li
                v-for="att in ordersStore.detail.attachments"
                :key="att.id"
                class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <UIcon name="i-heroicons-document" class="w-5 h-5 text-blue-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ att.fileName }}</p>
                  <p class="text-xs text-gray-500">
                    {{ att.evidenceType === 'shelf' ? '上架凭证' : att.evidenceType === 'order' ? '订单凭证' : '履约凭证' }}
                    · {{ att.uploadedBy }}
                  </p>
                </div>
                <UButton size="xs" variant="ghost" color="primary" as="a" :href="att.fileUrl" target="_blank">
                  查看
                </UButton>
              </li>
            </ul>
          </UCard>

          <UCard class="shadow-sm">
            <template #header>
              <h2 class="font-semibold text-gray-900">操作信息</h2>
            </template>
            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">当前角色</span>
                <UBadge color="primary" variant="subtle" size="sm">
                  {{ authStore.roleLabel }}
                </UBadge>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">当前用户</span>
                <span class="font-medium text-gray-900">{{ authStore.userName }}</span>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>

    <div v-else class="flex flex-col items-center justify-center py-20 text-gray-500">
      <UIcon name="i-heroicons-document-x-mark" class="w-16 h-16 mb-4 opacity-40" />
      <p class="text-lg">订单不存在或已被删除</p>
      <UButton color="primary" variant="ghost" class="mt-4" @click="goBack">
        返回列表
      </UButton>
    </div>

    <UModal v-model="showActionModal">
      <UCard class="border-0">
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ availableActions.find((a) => a.action === currentAction)?.label }}
          </h3>
        </template>

        <div class="space-y-4">
          <div v-if="currentAction === 'assign'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">派发处理人</label>
            <UInput v-model="assignHandler" placeholder="请输入处理人姓名" />
          </div>

          <div v-if="currentAction === 'assign'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">派发角色</label>
            <USelect v-model="assignRole" :options="roleOptions" placeholder="选择角色" />
          </div>

          <div v-if="currentAction === 'assign'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">截止日期（可选）</label>
            <UInput v-model="assignDeadline" type="date" />
          </div>

          <div v-if="currentAction === 'process' || currentAction === 'correct'">
            <div class="flex items-center gap-2">
              <UCheckbox v-model="correctMaterialComplete" id="material-complete" />
              <label for="material-complete" class="text-sm text-gray-700">
                标记材料已完整
              </label>
            </div>
          </div>

          <div v-if="currentAction === 'correct'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">上架凭证（可选）</label>
            <UInput v-model="correctShelfEvidence" placeholder="凭证链接或说明" />
          </div>

          <div v-if="currentAction === 'correct'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">订单凭证（可选）</label>
            <UInput v-model="correctOrderEvidence" placeholder="凭证链接或说明" />
          </div>

          <div v-if="currentAction === 'correct'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">履约凭证（可选）</label>
            <UInput v-model="correctDeliveryEvidence" placeholder="凭证链接或说明" />
          </div>

          <div v-if="currentAction === 'return'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">退回到角色</label>
            <USelect v-model="returnToRole" :options="roleOptions" placeholder="选择角色" />
          </div>

          <div v-if="currentAction === 'return'">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">退回原因</label>
            <UTextarea v-model="returnReason" placeholder="请输入退回原因" rows="3" />
          </div>

          <div v-if="currentAction === 'review_reject'">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">异常原因</label>
              <UButton size="xs" variant="ghost" color="primary" @click="addExceptionReason">
                <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5 mr-1" />
                添加
              </UButton>
            </div>
            <div class="space-y-2">
              <div
                v-for="(_, idx) in exceptionReasons"
                :key="idx"
                class="grid grid-cols-11 gap-2"
              >
                <USelect
                  v-model="exceptionReasons[idx].reasonType"
                  :options="reasonTypeOptions"
                  placeholder="类型"
                  class="col-span-4"
                />
                <UInput
                  v-model="exceptionReasons[idx].reason"
                  placeholder="异常原因"
                  class="col-span-6"
                />
                <UButton
                  size="sm"
                  variant="ghost"
                  color="red"
                  class="col-span-1"
                  :disabled="exceptionReasons.length <= 1"
                  @click="removeExceptionReason(idx)"
                >
                  <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                </UButton>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">备注说明</label>
            <UTextarea
              v-model="actionRemark"
              placeholder="请输入操作备注（可选）"
              rows="3"
            />
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showActionModal = false">
              取消
            </UButton>
            <UButton
              :color="availableActions.find((a) => a.action === currentAction)?.color || 'primary'"
              :loading="ordersStore.submitting"
              @click="submitAction"
            >
              确认提交
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showNoteModal">
      <UCard class="border-0">
        <template #header>
          <h3 class="text-lg font-semibold">添加审计备注</h3>
        </template>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">备注内容</label>
          <UTextarea v-model="noteContent" placeholder="请输入备注内容" rows="4" />
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showNoteModal = false">
              取消
            </UButton>
            <UButton color="primary" :loading="ordersStore.submitting" @click="submitNote">
              添加
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
