import { defineStore } from 'pinia'
import type {
  GroupOrder,
  OrderListResponse,
  OrderStatus,
  WarningStatus,
  UserRole,
  QueryParams,
  BatchProcessDto,
  ReturnOrderDto,
  AssignOrderDto,
  ProcessOrderDto,
  ReviewOrderDto,
  CorrectOrderDto,
  AddNoteDto,
  AddAttachmentDto,
  CreateOrderDto,
  ActionType,
  ReasonType,
} from '~/types/order'

interface OrdersState {
  list: GroupOrder[]
  detail: GroupOrder | null
  loading: boolean
  detailLoading: boolean
  submitting: boolean
  total: number
  page: number
  pageSize: number
}

const statusLabels: Record<OrderStatus, string> = {
  PENDING_ASSIGN: '待派发',
  PROCESSING: '处理中',
  CLOSED: '已关闭',
}

const warningLabels: Record<WarningStatus, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
}

const roleLabels: Record<UserRole, string> = {
  GROUPON_REGISTRAR: '团购登记员',
  AUDIT_SUPERVISOR: '团购审核主管',
  REVIEW_LEADER: '复核负责人',
  LEADER_OPERATOR: '团长运营',
  FULFILLMENT_SPECIALIST: '履约专员',
  CITY_MANAGER: '城市经理',
}

const actionTypeLabels: Record<ActionType, string> = {
  CREATE: '创建订单',
  SUBMIT: '提交订单',
  ASSIGN: '派发订单',
  RETURN: '退回订单',
  REVIEW: '复核订单',
  CLOSE: '关闭订单',
  CORRECT_MATERIALS: '补正材料',
  CORRECT_EVIDENCE: '补正凭证',
  CORRECT_INFO: '更正信息',
  ADD_ATTACHMENT: '添加附件',
  ADD_AUDIT_NOTE: '添加审计备注',
}

const reasonTypeLabels: Record<ReasonType, string> = {
  overdue: '逾期',
  conflict: '冲突',
  material_missing: '材料缺失',
  other: '其他',
}

export const useOrdersStore = defineStore('orders', {
  state: (): OrdersState => ({
    list: [],
    detail: null,
    loading: false,
    detailLoading: false,
    submitting: false,
    total: 0,
    page: 1,
    pageSize: 10,
  }),

  getters: {
    getStatusLabel:
      (): ((s: OrderStatus) => string) =>
      (s: OrderStatus) =>
        statusLabels[s],
    getWarningLabel:
      (): ((w: WarningStatus) => string) =>
      (w: WarningStatus) =>
        warningLabels[w],
    getRoleLabel:
      (): ((r: UserRole) => string) =>
      (r: UserRole) =>
        roleLabels[r],
    getActionTypeLabel:
      (): ((a: ActionType) => string) =>
      (a: ActionType) =>
        actionTypeLabels[a],
    getReasonTypeLabel:
      (): ((r: ReasonType) => string) =>
      (r: ReasonType) =>
        reasonTypeLabels[r],
  },

  actions: {
    async fetchList(params: QueryParams = {}) {
      this.loading = true
      try {
        const queryParams = new URLSearchParams()
        if (params.orderStatus) queryParams.append('orderStatus', params.orderStatus)
        if (params.currentRole) queryParams.append('currentRole', params.currentRole)
        if (params.keyword) queryParams.append('keyword', params.keyword)
        if (params.isOverdue !== undefined) queryParams.append('isOverdue', String(params.isOverdue))
        queryParams.append('page', String(params.page || 1))
        queryParams.append('pageSize', String(params.pageSize || 10))
        if (params.sortBy) queryParams.append('sortBy', params.sortBy)
        if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)

        const res = await useApiFetch<OrderListResponse>(
          `/group-orders?${queryParams.toString()}`,
          { method: 'GET' }
        )

        this.list = res.list
        this.total = res.total
        this.page = res.page
        this.pageSize = res.pageSize

        return res
      } finally {
        this.loading = false
      }
    },

    async fetchDetail(id: number | string) {
      this.detailLoading = true
      this.detail = null
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}`, { method: 'GET' })
        this.detail = res
        return res
      } finally {
        this.detailLoading = false
      }
    },

    async createOrder(dto: CreateOrderDto) {
      this.submitting = true
      try {
        const authStore = useAuthStore()
        const res = await useApiFetch<GroupOrder>('/group-orders', {
          method: 'POST',
          body: {
            ...dto,
            createdBy: authStore.userName,
          },
        })
        useToast().add({
          title: '创建成功',
          description: `订单 ${res.orderNo} 已创建`,
          color: 'green',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    async assignOrder(id: number | string, dto: AssignOrderDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}/assign`, {
          method: 'POST',
          body: dto,
        })
        if (this.detail && this.detail.id === Number(id)) {
          this.detail = res
        }
        useToast().add({
          title: '派发成功',
          description: '订单已成功派发',
          color: 'green',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    async processOrder(id: number | string, dto: ProcessOrderDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}/process`, {
          method: 'POST',
          body: dto,
        })
        if (this.detail && this.detail.id === Number(id)) {
          this.detail = res
        }
        useToast().add({
          title: '处理成功',
          description: '订单处理已完成',
          color: 'green',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    async reviewOrder(id: number | string, dto: ReviewOrderDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}/review`, {
          method: 'POST',
          body: dto,
        })
        if (this.detail && this.detail.id === Number(id)) {
          this.detail = res
        }
        useToast().add({
          title: dto.passed ? '复核通过' : '复核驳回',
          description: '订单复核已完成',
          color: dto.passed ? 'green' : 'amber',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    async returnOrder(id: number | string, dto: ReturnOrderDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}/return`, {
          method: 'POST',
          body: dto,
        })
        if (this.detail && this.detail.id === Number(id)) {
          this.detail = res
        }
        useToast().add({
          title: '退回成功',
          description: '订单已退回',
          color: 'amber',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    async correctOrder(id: number | string, dto: CorrectOrderDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}/correct`, {
          method: 'POST',
          body: dto,
        })
        if (this.detail && this.detail.id === Number(id)) {
          this.detail = res
        }
        useToast().add({
          title: '补正成功',
          description: '订单信息已补正',
          color: 'green',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    async batchProcess(dto: BatchProcessDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<{ success: number[]; failed: { id: number; reason: string }[] }>(
          '/group-orders/batch',
          {
            method: 'POST',
            body: dto,
          }
        )
        const successCount = res.success?.length || 0
        const failedCount = res.failed?.length || 0
        if (failedCount > 0) {
          useToast().add({
            title: '批量操作完成',
            description: `成功 ${successCount} 条，失败 ${failedCount} 条`,
            color: 'amber',
          })
          if (res.failed && res.failed.length > 0) {
            const failedInfo = res.failed.map(f => `订单${f.id}: ${f.reason}`).join('\n')
            window.alert(`以下订单处理失败：\n${failedInfo}`)
          }
        } else {
          useToast().add({
            title: '批量操作成功',
            description: `已成功处理 ${successCount} 条订单`,
            color: 'green',
          })
        }
        return res
      } finally {
        this.submitting = false
      }
    },

    async addNote(id: number | string, dto: AddNoteDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}/notes`, {
          method: 'POST',
          body: dto,
        })
        if (this.detail && this.detail.id === Number(id)) {
          this.detail = res
        }
        useToast().add({
          title: '添加成功',
          description: '审计备注已添加',
          color: 'green',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    async addAttachment(id: number | string, dto: AddAttachmentDto) {
      this.submitting = true
      try {
        const res = await useApiFetch<GroupOrder>(`/group-orders/${id}/attachments`, {
          method: 'POST',
          body: dto,
        })
        if (this.detail && this.detail.id === Number(id)) {
          this.detail = res
        }
        useToast().add({
          title: '添加成功',
          description: '附件已添加',
          color: 'green',
        })
        return res
      } finally {
        this.submitting = false
      }
    },

    clearDetail() {
      this.detail = null
    },
  },
})
