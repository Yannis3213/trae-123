<template>
  <div class="page-container">
    <a class="back-link" @click="router.back()">← 返回订单列表</a>

    <div v-if="loadError" class="alert alert-error">{{ loadError }}</div>

    <div v-if="order" class="card">
      <div class="page-header" style="margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0;">
            {{ order.order_no }} - {{ order.customer_name }}
            <span :class="['tag', statusTagClass(order.status)]" style="margin-left: 10px;">{{ order.status_display }}</span>
            <span class="tag tag-blue" style="margin-left: 6px;">{{ order.stage_display }}</span>
          </h1>
          <div style="margin-top: 6px; color: #6b7280; font-size: 13px;">
            <span :class="['priority-dot', 'priority-' + order.priority]"></span>
            优先级: {{ order.priority_display }}
            <span style="margin-left: 16px;">
              预警: <span :class="['tag', warningTagClass(order.warning_level)]">{{ order.warning_level_display }}</span>
            </span>
            <span v-if="order.is_exception" style="margin-left: 16px;" class="tag tag-red">异常</span>
          </div>
        </div>
        <div class="action-buttons">
          <button class="btn btn-secondary" @click="loadDetail">🔄 刷新</button>
        </div>
      </div>

      <div class="section-title">基本信息</div>
      <div class="detail-grid" style="margin-bottom: 20px;">
        <div class="detail-item">
          <span class="detail-label">客户名称</span>
          <span class="detail-value">{{ order.customer_name }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">产品名称</span>
          <span class="detail-value">{{ order.product_name }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">目的国</span>
          <span class="detail-value">{{ order.country || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">数量</span>
          <span class="detail-value">{{ order.quantity.toLocaleString() }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">金额(USD)</span>
          <span class="detail-value">{{ order.amount.toLocaleString() }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">责任人</span>
          <span class="detail-value">{{ order.responsible_person || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">当前处理人</span>
          <span class="detail-value">{{ order.current_handler || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">处理人角色</span>
          <span class="detail-value">{{ order.current_handler_role ? getRoleDisplayName(order.current_handler_role) : '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">截止时间</span>
          <span class="detail-value" :class="order.warning_level === 'overdue' ? '' : ''">
            {{ order.due_time ? formatDate(order.due_time) : '-' }}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">创建时间</span>
          <span class="detail-value">{{ formatDate(order.create_time) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">更新时间</span>
          <span class="detail-value">{{ formatDate(order.update_time) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">当前版本</span>
          <span class="detail-value">v{{ order.version }}</span>
        </div>
      </div>

      <div v-if="order.exception_tags.length > 0" style="margin-bottom: 16px;">
        <span style="font-size: 13px; color: #6b7280;">异常标签: </span>
        <span v-for="tag in order.exception_tags" :key="tag" class="tag tag-red" style="margin-right: 6px;">
          {{ tag }}
        </span>
      </div>

      <div class="divider"></div>

      <div class="tabs">
        <div :class="['tab', activeTab === 'content' ? 'active' : '']" @click="activeTab = 'content'">业务内容</div>
        <div :class="['tab', activeTab === 'attachments' ? 'active' : '']" @click="activeTab = 'attachments'">
          附件 ({{ order.attachments.length }})
        </div>
        <div :class="['tab', activeTab === 'result' ? 'active' : '']" @click="activeTab = 'result'">办理结果</div>
        <div :class="['tab', activeTab === 'return' ? 'active' : '']" @click="activeTab = 'return'">退回原因</div>
        <div :class="['tab', activeTab === 'exceptions' ? 'active' : '']" @click="activeTab = 'exceptions'">
          异常原因 ({{ order.exception_reasons.length }})
        </div>
        <div :class="['tab', activeTab === 'audit' ? 'active' : '']" @click="activeTab = 'audit'">
          审计备注 ({{ order.audit_notes.length }})
        </div>
        <div :class="['tab', activeTab === 'timeline' ? 'active' : '']" @click="activeTab = 'timeline'">
          处理轨迹 ({{ order.processing_records.length }})
        </div>
        <div :class="['tab', activeTab === 'actions' ? 'active' : '']" @click="activeTab = 'actions'">办理操作</div>
      </div>

      <div v-if="activeTab === 'content'">
        <div class="form-group" style="margin-bottom: 14px;">
          <label>客户询盘内容 <span v-if="!canEditInquiry" class="tag tag-gray" style="margin-left:6px;">仅登记员/审核阶段可编辑</span></label>
          <textarea v-model="editForm.inquiry_content" :disabled="!canEditInquiry"></textarea>
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label>报价确认信息 <span v-if="!canEditQuote" class="tag tag-gray" style="margin-left:6px;">仅报价/订单阶段可编辑</span></label>
          <textarea v-model="editForm.quote_content" :disabled="!canEditQuote"></textarea>
          <div class="form-check" style="margin-top: 6px;">
            <input type="checkbox" v-model="editForm.quote_confirmed" :disabled="!canEditQuote" id="qc" />
            <label for="qc">报价已确认</label>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label>订单签订信息 <span v-if="!canEditOrder" class="tag tag-gray" style="margin-left:6px;">仅订单/归档阶段可编辑</span></label>
          <textarea v-model="editForm.order_content" :disabled="!canEditOrder"></textarea>
          <div class="form-check" style="margin-top: 6px;">
            <input type="checkbox" v-model="editForm.order_signed" :disabled="!canEditOrder" id="os" />
            <label for="os">订单已签订</label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>责任人</label>
            <input v-model="editForm.responsible_person" :disabled="!canEdit" />
          </div>
          <div class="form-group">
            <label>优先级</label>
            <select v-model="editForm.priority" :disabled="!canEdit">
              <option v-for="p in priorityList" :key="p.code" :value="p.code">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>截止时间</label>
            <input type="datetime-local" v-model="editForm.due_time" :disabled="!canEdit" />
          </div>
        </div>
        <div v-if="canEdit" style="margin-top: 16px;">
          <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
            {{ saving ? '保存中...' : '💾 保存修改' }}
          </button>
          <span v-if="saveMessage" :class="['tag', saveSuccess ? 'tag-green' : 'tag-red']" style="margin-left: 10px;">
            {{ saveMessage }}
          </span>
        </div>
      </div>

      <div v-if="activeTab === 'attachments'">
        <div style="margin-bottom: 14px;">
          <input type="file" id="file-upload" @change="onFileSelect" style="display: none;" />
          <label for="file-upload" class="file-input-label">📎 上传附件</label>
          <select v-model="uploadStage" style="margin-left: 10px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px;">
            <option value="">选择阶段</option>
            <option value="inquiry">客户询盘</option>
            <option value="quote_confirmation">报价确认</option>
            <option value="order_signing">订单签订</option>
          </select>
          <input v-model="uploadDesc" placeholder="附件说明" style="margin-left: 6px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; min-width: 200px;" />
          <span v-if="uploadError" class="tag tag-red" style="margin-left: 10px;">{{ uploadError }}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>文件名</th>
              <th>阶段</th>
              <th>说明</th>
              <th>大小</th>
              <th>上传人</th>
              <th>上传时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in order.attachments" :key="a.id">
              <td>{{ a.file_name }}</td>
              <td>{{ stageName(a.stage) }}</td>
              <td>{{ a.description || '-' }}</td>
              <td>{{ formatFileSize(a.file_size) }}</td>
              <td>{{ a.uploaded_by }} ({{ getRoleDisplayName(a.uploaded_by_role) }})</td>
              <td>{{ formatDate(a.upload_time) }}</td>
              <td>
                <a class="text-link" :href="getAttachmentUrl(a.file_path)" target="_blank">下载</a>
              </td>
            </tr>
            <tr v-if="order.attachments.length === 0">
              <td colspan="7">
                <div class="empty-state">
                  <div class="empty-state-icon">📎</div>
                  <div>暂无附件</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="activeTab === 'result'">
        <div class="form-group">
          <label>办理结果</label>
          <textarea v-model="editForm.result" :disabled="!canEdit" placeholder="办理结果说明"></textarea>
        </div>
        <div v-if="canEdit" style="margin-top: 10px;">
          <button class="btn btn-primary" :disabled="saving" @click="saveEdit">保存结果</button>
        </div>
        <div v-if="!order.result" class="empty-state" style="margin-top: 16px;">
          <div>暂无办理结果</div>
        </div>
      </div>

      <div v-if="activeTab === 'return'">
        <div class="alert" v-if="order.return_reason" :class="order.status === 'closed' ? 'alert-info' : 'alert-warning'">
          <strong>退回原因:</strong>
          <p style="margin-top: 6px; white-space: pre-wrap;">{{ order.return_reason }}</p>
        </div>
        <div v-else class="empty-state">
          <div>暂无退回记录</div>
        </div>
      </div>

      <div v-if="activeTab === 'exceptions'">
        <div style="margin-bottom: 16px;">
          <button class="btn btn-secondary" @click="showExcModal = true">+ 添加异常原因</button>
        </div>
        <div v-for="exc in order.exception_reasons" :key="exc.id" class="card" style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <div>
              <span class="tag tag-red">{{ exc.reason_type }}</span>
              <span v-if="exc.resolved" class="tag tag-green">已解决</span>
            </div>
            <div style="font-size: 12px; color: #9ca3af;">
              {{ exc.recorded_by }} ({{ getRoleDisplayName(exc.recorded_by_role) }}) · {{ formatDate(exc.record_time) }}
            </div>
          </div>
          <div style="margin-bottom: 6px;">
            <strong>异常详情:</strong> {{ exc.reason_detail }}
          </div>
          <div v-if="exc.corrective_action">
            <strong>补正动作:</strong> {{ exc.corrective_action }}
          </div>
        </div>
        <div v-if="order.exception_reasons.length === 0" class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div>暂无异常记录</div>
        </div>

        <div v-if="showExcModal" class="modal-overlay" @click.self="showExcModal = false">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-title">添加异常原因</div>
              <button class="modal-close" @click="showExcModal = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group" style="margin-bottom: 14px;">
                <label>异常类型<span class="required">*</span></label>
                <input v-model="excForm.reason_type" placeholder="如：逾期、缺材料、退回补正等" />
              </div>
              <div class="form-group" style="margin-bottom: 14px;">
                <label>异常详情<span class="required">*</span></label>
                <textarea v-model="excForm.reason_detail"></textarea>
              </div>
              <div class="form-group">
                <label>补正动作</label>
                <textarea v-model="excForm.corrective_action" placeholder="建议的补正方式"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="showExcModal = false">取消</button>
              <button class="btn btn-primary" @click="addException">提交</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'audit'">
        <div style="margin-bottom: 16px;">
          <div style="display: flex; gap: 10px;">
            <input v-model="newAuditNote" placeholder="添加审计备注..." style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" />
            <button class="btn btn-primary" @click="addAuditNote">添加备注</button>
          </div>
        </div>
        <div v-for="note in order.audit_notes" :key="note.id" class="card" style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <div style="font-weight: 500;">{{ note.noted_by }} ({{ getRoleDisplayName(note.noted_by_role) }})</div>
            <div style="font-size: 12px; color: #9ca3af;">{{ formatDate(note.note_time) }}</div>
          </div>
          <div style="color: #374151;">{{ note.note }}</div>
        </div>
        <div v-if="order.audit_notes.length === 0" class="empty-state">
          <div>暂无审计备注</div>
        </div>
      </div>

      <div v-if="activeTab === 'timeline'">
        <div class="timeline">
          <div v-for="rec in order.processing_records" :key="rec.id" class="timeline-item">
            <div class="timeline-header">
              <span class="timeline-action">{{ rec.action_display }}</span>
              <span class="timeline-user">{{ rec.operator }} ({{ getRoleDisplayName(rec.operator_role) }})</span>
              <span class="timeline-time">{{ formatDate(rec.operate_time) }}</span>
              <span v-if="rec.evidence_required" class="tag tag-orange">
                需证据 {{ rec.evidence_provided ? '✓' : '✗' }}
              </span>
              <span class="tag tag-gray">v{{ rec.version_before }} → v{{ rec.version_after }}</span>
            </div>
            <div v-if="rec.from_status || rec.to_status" style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
              状态: {{ rec.from_status || '-' }} → {{ rec.to_status || '-' }}
              &nbsp;|&nbsp;
              阶段: {{ rec.from_stage || '-' }} → {{ rec.to_stage || '-' }}
            </div>
            <div v-if="rec.comment" class="timeline-comment">{{ rec.comment }}</div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'actions'">
        <div v-if="!order.can_process" class="alert alert-warning">
          当前角色无权办理此订单。此订单当前需由 <strong>{{ getRoleDisplayName(order.current_handler_role) }}</strong> 处理。
        </div>
        <div v-else>
          <div class="alert alert-info" style="margin-bottom: 14px;">
            当前角色: <strong>{{ getRoleDisplayName(currentRole) }}</strong>
            &nbsp;|&nbsp; 订单阶段: <strong>{{ order.stage_display }}</strong>
            &nbsp;|&nbsp; 订单状态: <strong>{{ order.status_display }}</strong>
          </div>
          <div style="margin-bottom: 14px;">
            <button class="btn btn-primary" @click="openAction('submit')" v-if="canDoAction('submit')">📤 提交下一环节</button>
            <button class="btn btn-secondary" @click="openAction('dispatch')" style="margin-left: 8px;" v-if="canDoAction('dispatch')">📋 派发</button>
            <button class="btn btn-success" @click="openAction('process')" style="margin-left: 8px;" v-if="canDoAction('process')">✅ 办理通过</button>
            <button class="btn btn-warning" @click="openAction('review')" style="margin-left: 8px;" v-if="canDoAction('review')">🔍 复核通过</button>
            <button class="btn btn-danger" @click="openAction('return')" style="margin-left: 8px;" v-if="canDoAction('return')">↩️ 退回补正</button>
            <button class="btn btn-secondary" @click="openAction('correct')" style="margin-left: 8px;" v-if="canDoAction('correct')">🔧 补正资料</button>
            <button class="btn btn-success" @click="openAction('close')" style="margin-left: 8px;" v-if="canDoAction('close')">📦 关闭归档</button>
          </div>

          <div v-if="showActionModal" class="modal-overlay" @click.self="showActionModal = false">
            <div class="modal">
              <div class="modal-header">
                <div class="modal-title">{{ actionModalTitle }}</div>
                <button class="modal-close" @click="showActionModal = false">×</button>
              </div>
              <div class="modal-body">
                <div v-if="actionForm.action === 'dispatch'" class="form-group" style="margin-bottom: 14px;">
                  <label>派发到角色<span class="required">*</span></label>
                  <select v-model="actionForm.dispatch_to_role">
                    <option value="">请选择</option>
                    <option v-for="r in roleList" :key="r.code" :value="r.code">{{ r.name }}</option>
                  </select>
                </div>
                <div v-if="['return', 'correct'].includes(actionForm.action)" class="form-group" style="margin-bottom: 14px;">
                  <label>补正动作</label>
                  <textarea v-model="actionForm.corrective_action" placeholder="请说明补正内容"></textarea>
                </div>
                <div class="form-group" style="margin-bottom: 14px;">
                  <label>
                    <span v-if="actionForm.action === 'return'">退回原因<span class="required">*</span></span>
                    <span v-else>处理说明</span>
                  </label>
                  <textarea v-model="actionForm.comment" :placeholder="actionForm.action === 'return' ? '请填写退回原因（必填）' : '请输入处理说明'"></textarea>
                </div>
                <div v-if="['process', 'review', 'close'].includes(actionForm.action)" class="form-check" style="margin-bottom: 14px;">
                  <input type="checkbox" v-model="actionForm.evidence_provided" id="evidence" />
                  <label for="evidence">我已上传证据附件（必须）</label>
                </div>
                <div v-if="actionError" class="alert alert-error">{{ actionError }}</div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" @click="showActionModal = false">取消</button>
                <button class="btn btn-primary" :disabled="actionSubmitting" @click="doAction">
                  {{ actionSubmitting ? '处理中...' : '确认' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OrderDetail } from '~/composables/types'

const route = useRoute()
const router = useRouter()
const { apiGet, apiPost, apiPut, apiUpload } = useApi()
const { currentRole, currentUserName, roleList, getRoleDisplayName, initFromStorage } = useUserStore()

const orderId = computed(() => Number(route.params.id))
const order = ref<OrderDetail | null>(null)
const loadError = ref('')
const activeTab = ref('content')
const newAuditNote = ref('')
const showExcModal = ref(false)
const uploadError = ref('')
const uploadStage = ref('')
const uploadDesc = ref('')
const saving = ref(false)
const saveMessage = ref('')
const saveSuccess = ref(false)

const priorityList = [
  { code: 'low', name: '低' },
  { code: 'medium', name: '中' },
  { code: 'high', name: '高' },
  { code: 'urgent', name: '紧急' },
]

const excForm = reactive({
  reason_type: '',
  reason_detail: '',
  corrective_action: ''
})

const editForm = reactive({
  inquiry_content: '',
  quote_content: '',
  order_content: '',
  quote_confirmed: false,
  order_signed: false,
  result: '',
  responsible_person: '',
  priority: 'medium',
  due_time: ''
})

const canEdit = computed(() => {
  if (!order.value) return false
  if (order.value.status === 'closed') return false
  const role = currentRole.value
  if (order.value.status === 'processing') {
    return role === order.value.current_handler_role
  }
  if (order.value.status === 'pending_dispatch') {
    if (order.value.stage === 'inquiry') return role === 'clerk'
    if (order.value.stage === 'quote_confirmation') return role === 'supervisor' || role === 'clerk'
    if (order.value.stage === 'order_signing') return role === 'reviewer' || role === 'supervisor'
  }
  return false
})

const canEditInquiry = computed(() => {
  if (!canEdit.value) return false
  return ['inquiry', 'quote_confirmation'].includes(order.value!.stage)
})

const canEditQuote = computed(() => {
  if (!canEdit.value) return false
  return ['quote_confirmation', 'order_signing'].includes(order.value!.stage)
})

const canEditOrder = computed(() => {
  if (!canEdit.value) return false
  return ['order_signing', 'archived'].includes(order.value!.stage)
})

const showActionModal = ref(false)
const actionSubmitting = ref(false)
const actionError = ref('')
const actionForm = reactive({
  action: '',
  comment: '',
  dispatch_to_role: '',
  evidence_provided: false,
  corrective_action: ''
})

const actionModalTitle = computed(() => {
  const titles: Record<string, string> = {
    submit: '提交订单',
    dispatch: '派发订单',
    process: '办理通过',
    review: '复核通过',
    return: '退回补正',
    correct: '补正资料',
    close: '关闭归档'
  }
  return titles[actionForm.action] || '办理操作'
})

const canDoAction = (action: string) => {
  if (!order.value) return false
  if (!order.value.can_process) return false
  const role = currentRole.value
  const stage = order.value.stage
  const status = order.value.status

  if (action === 'submit') return role === 'clerk' && stage === 'inquiry' && status === 'pending_dispatch'
  if (action === 'dispatch') return ['clerk', 'supervisor'].includes(role) && status === 'pending_dispatch'
  if (action === 'process') return role === order.value.current_handler_role && status === 'processing'
  if (action === 'review') return role === 'reviewer' && stage === 'order_signing'
  if (action === 'return') return ['supervisor', 'reviewer'].includes(role) && status === 'processing'
  if (action === 'correct') return role === order.value.current_handler_role && status === 'processing'
  if (action === 'close') return role === 'reviewer'
  return false
}

const openAction = (action: string) => {
  actionForm.action = action
  actionForm.comment = ''
  actionForm.dispatch_to_role = ''
  actionForm.evidence_provided = false
  actionForm.corrective_action = ''
  actionError.value = ''
  showActionModal.value = true
}

const doAction = async () => {
  if (!order.value) return
  actionError.value = ''
  if (actionForm.action === 'dispatch' && !actionForm.dispatch_to_role) {
    actionError.value = '请选择派发目标角色'
    return
  }
  if (actionForm.action === 'return' && !actionForm.comment.trim()) {
    actionError.value = '请填写退回原因'
    return
  }
  if (['process', 'review', 'close'].includes(actionForm.action) && !actionForm.evidence_provided) {
    actionError.value = '办理必须上传证据附件，请勾选确认'
    return
  }
  actionSubmitting.value = true
  try {
    await apiPost(`/orders/${orderId.value}/process`, {
      version: order.value.version,
      action: actionForm.action,
      comment: actionForm.comment,
      dispatch_to_role: actionForm.dispatch_to_role || null,
      evidence_provided: actionForm.evidence_provided,
      corrective_action: actionForm.corrective_action
    })
    showActionModal.value = false
    await loadDetail()
  } catch (e: any) {
    actionError.value = e.data?.detail || e.message || '操作失败'
  } finally {
    actionSubmitting.value = false
  }
}

const statusTagClass = (status: string) => {
  const map: Record<string, string> = {
    pending_dispatch: 'tag-purple', processing: 'tag-yellow', closed: 'tag-green'
  }
  return map[status] || 'tag-gray'
}

const warningTagClass = (level: string) => {
  const map: Record<string, string> = {
    normal: 'tag-green', approaching: 'tag-yellow', overdue: 'tag-red'
  }
  return map[level] || 'tag-gray'
}

const stageName = (code: string) => {
  const map: Record<string, string> = {
    inquiry: '客户询盘', quote_confirmation: '报价确认',
    order_signing: '订单签订', archived: '已归档'
  }
  return map[code] || code
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const getAttachmentUrl = (path: string) => {
  return 'http://localhost:8108' + path
}

const loadDetail = async () => {
  loadError.value = ''
  try {
    const res = await apiGet<OrderDetail>(`/orders/${orderId.value}`)
    order.value = res
    editForm.inquiry_content = res.inquiry_content
    editForm.quote_content = res.quote_content
    editForm.order_content = res.order_content
    editForm.quote_confirmed = res.quote_confirmed
    editForm.order_signed = res.order_signed
    editForm.result = res.result
    editForm.responsible_person = res.responsible_person
    editForm.priority = res.priority
    editForm.due_time = res.due_time ? new Date(res.due_time).toISOString().slice(0, 16) : ''
  } catch (e: any) {
    loadError.value = e.data?.detail || e.message || '加载订单失败'
  }
}

const saveEdit = async () => {
  if (!order.value) return
  saving.value = true
  saveMessage.value = ''
  try {
    const body: any = {
      version: order.value.version,
      inquiry_content: editForm.inquiry_content,
      quote_content: editForm.quote_content,
      order_content: editForm.order_content,
      quote_confirmed: editForm.quote_confirmed,
      order_signed: editForm.order_signed,
      result: editForm.result,
      responsible_person: editForm.responsible_person,
      priority: editForm.priority
    }
    if (editForm.due_time) {
      body.due_time = new Date(editForm.due_time).toISOString()
    }
    await apiPut(`/orders/${orderId.value}`, body)
    saveSuccess.value = true
    saveMessage.value = '保存成功'
    await loadDetail()
    setTimeout(() => { saveMessage.value = '' }, 2000)
  } catch (e: any) {
    saveSuccess.value = false
    saveMessage.value = e.data?.detail || e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

const onFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !order.value) return
  uploadError.value = ''
  try {
    await apiUpload(`/orders/${orderId.value}/attachments`, file, {
      description: uploadDesc.value,
      stage: uploadStage.value
    })
    uploadDesc.value = ''
    uploadStage.value = ''
    input.value = ''
    await loadDetail()
  } catch (e: any) {
    uploadError.value = e.data?.detail || e.message || '上传失败'
  }
}

const addAuditNote = async () => {
  if (!newAuditNote.value.trim() || !order.value) return
  try {
    await apiPost(`/orders/${orderId.value}/audit-notes`, { note: newAuditNote.value })
    newAuditNote.value = ''
    await loadDetail()
  } catch (e: any) {
    alert(e.data?.detail || e.message || '添加失败')
  }
}

const addException = async () => {
  if (!excForm.reason_type || !excForm.reason_detail) {
    alert('请填写异常类型和详情')
    return
  }
  try {
    await apiPost(`/orders/${orderId.value}/exception-reasons`, { ...excForm })
    showExcModal.value = false
    excForm.reason_type = ''
    excForm.reason_detail = ''
    excForm.corrective_action = ''
    await loadDetail()
  } catch (e: any) {
    alert(e.data?.detail || e.message || '添加失败')
  }
}

onMounted(() => {
  initFromStorage()
  loadDetail()
})
</script>
