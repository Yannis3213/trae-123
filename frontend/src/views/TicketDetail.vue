<template>
  <div>
    <div class="page-header">
      <div>
        <button class="btn btn-secondary btn-sm" @click="goBack">← 返回列表</button>
      </div>
      <h1 class="page-title">客服工单详情</h1>
      <div style="width:100px;"></div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <div v-if="loading" class="empty">加载中...</div>

    <div v-else-if="detail" class="detail-layout">
      <div>
        <div class="card">
          <div class="ticket-header">
            <div class="ticket-main-info">
              <h2>{{ detail.ticket.title }}</h2>
              <div class="ticket-customer">
                客户：{{ detail.ticket.customer_name }} · {{ detail.ticket.customer_phone }}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="margin-bottom:6px;">
                <span :class="['status-tag', 'status-' + detail.ticket.status]" style="font-size:14px;padding:4px 14px;">
                  {{ detail.ticket.status_display }}
                </span>
              </div>
              <div style="font-size:12px;color:#9ca3af;">
                版本号：v{{ detail.ticket.version }}
              </div>
            </div>
          </div>

          <div class="handover-info">
            <div class="handover-info-title">🔄 交接流转信息</div>
            <div class="handover-info-row">
              <div>
                <span class="info-label">当前处理人：</span>
                <span class="info-value" style="font-weight:600;">{{ detail.ticket.current_handler_name }}</span>
              </div>
              <span class="handover-arrow">→</span>
              <div>
                <span class="info-label">下一处理人：</span>
                <span v-if="detail.ticket.next_handler_name" class="info-value" style="font-weight:600;color:#2563eb;">{{ detail.ticket.next_handler_name }}</span>
                <span v-else style="color:#9ca3af;">（待确定）</span>
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">优先级：</span>
              <span :class="['priority-tag', 'priority-' + detail.ticket.priority]">{{ detail.ticket.priority_display }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">到期预警：</span>
              <span :class="['expiry-tag', 'expiry-' + detail.ticket.expiry_status]">{{ detail.ticket.expiry_display }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">责任人：</span>
              <span class="info-value">{{ detail.ticket.responsible_name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">当前处理人：</span>
              <span class="info-value">{{ detail.ticket.current_handler_name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">创建时间：</span>
              <span class="info-value">{{ formatDate(detail.ticket.created_at) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">截止时间：</span>
              <span class="info-value">{{ formatDate(detail.ticket.deadline) }}</span>
            </div>
          </div>

          <div class="info-item" style="margin-bottom:10px;">
            <span class="info-label">异常标签：</span>
            <span v-if="detail.ticket.exception_tags.length === 0" class="info-value" style="color:#9ca3af;">无</span>
            <span v-for="tag in detail.ticket.exception_tags" :key="tag" class="tag-chip">{{ tag }}</span>
          </div>

          <div class="info-item">
            <span class="info-label">问题描述：</span>
          </div>
          <div class="ticket-description">{{ detail.ticket.description }}</div>

          <div v-if="detail.processing_result" style="margin-top:14px;">
            <div class="info-item" style="margin-bottom:6px;">
              <span class="info-label">处理结果：</span>
            </div>
            <div class="ticket-description" style="background:#ecfdf5;border:1px solid #a7f3d0;">
              {{ detail.processing_result }}
            </div>
          </div>

          <div v-if="detail.return_reason" style="margin-top:14px;">
            <div class="info-item" style="margin-bottom:6px;">
              <span class="info-label">退回原因：</span>
            </div>
            <div class="ticket-description" style="background:#fef2f2;border:1px solid #fecaca;">
              {{ detail.return_reason }}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="tabs">
            <button
              v-for="t in tabs"
              :key="t.key"
              :class="['tab', { active: activeTab === t.key }]"
              @click="activeTab = t.key"
            >
              {{ t.label }} ({{ t.count }})
            </button>
          </div>

          <div v-if="activeTab === 'attachments'">
            <div class="card-title">
              <span>附件（证据材料）</span>
              <div class="card-title-actions">
                <button class="btn btn-primary btn-sm" @click="showAddAttachment = true">+ 上传附件</button>
              </div>
            </div>
            <div v-if="detail.attachments.length === 0" class="empty">暂无附件</div>
            <div v-else class="attachment-list">
              <div v-for="a in detail.attachments" :key="a.id" class="attachment-item">
                <div class="attachment-icon">{{ a.file_type?.slice(0, 3)?.toUpperCase() || 'FILE' }}</div>
                <div class="attachment-info">
                  <div class="attachment-filename">{{ a.filename }}</div>
                  <div class="attachment-meta">{{ a.uploaded_by_name }} 上传于 {{ formatDate(a.uploaded_at) }}</div>
                </div>
                <a :href="a.url" target="_blank" class="link-btn">查看</a>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'records'">
            <div class="card-title"><span>处理记录（审计轨迹）</span></div>
            <div v-if="detail.processing_records.length === 0" class="empty">暂无处理记录</div>
            <div v-else class="timeline">
              <div v-for="r in detail.processing_records" :key="r.id" :class="['timeline-item', { exception: r.to_status === 'exception_returned' }]">
                <div class="timeline-dot"></div>
                <div class="timeline-title">
                  {{ r.action }}：{{ statusName(r.from_status) }} → {{ statusName(r.to_status) }}
                </div>
                <div class="timeline-meta">
                  {{ r.operator_name }} ({{ roleName(r.operator_role) }}) · {{ formatDate(r.created_at) }}
                </div>
                <div v-if="r.from_handler_name && r.to_handler_name && r.from_handler_name !== r.to_handler_name" class="timeline-handover">
                  📤 交接：{{ r.from_handler_name }} → {{ r.to_handler_name }}
                </div>
                <div v-else-if="r.to_handler_name" class="timeline-handover">
                  👤 当前处理人：{{ r.to_handler_name }}
                </div>
                <div v-if="r.remark" class="timeline-remark">{{ r.remark }}</div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'audit'">
            <div class="card-title">
              <span>审计备注</span>
              <div class="card-title-actions">
                <button class="btn btn-primary btn-sm" @click="showAddAudit = true">+ 添加备注</button>
              </div>
            </div>
            <div v-if="detail.audit_remarks.length === 0" class="empty">暂无审计备注</div>
            <div v-else class="timeline">
              <div v-for="r in detail.audit_remarks" :key="r.id" class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-title">{{ roleName(r.operator_role) }} · {{ r.operator_name }}</div>
                <div class="timeline-meta">{{ formatDate(r.created_at) }}</div>
                <div class="timeline-remark">{{ r.content }}</div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'exceptions'">
            <div class="card-title">
              <span>异常原因</span>
              <div class="card-title-actions">
                <button class="btn btn-primary btn-sm" @click="showAddException = true">+ 登记异常</button>
              </div>
            </div>
            <div v-if="detail.exception_reasons.length === 0" class="empty">暂无异常记录</div>
            <div v-else class="timeline">
              <div v-for="r in detail.exception_reasons" :key="r.id" class="timeline-item exception">
                <div class="timeline-dot"></div>
                <div class="timeline-title">
                  【{{ r.reason_type }}】{{ r.resolved ? '✅ 已解决' : '⚠️ 未解决' }}
                </div>
                <div class="timeline-meta">{{ r.reported_by_name }} 报告于 {{ formatDate(r.created_at) }}</div>
                <div class="timeline-remark">{{ r.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧操作面板 -->
      <div>
        <div class="card action-panel">
          <div class="card-title"><span>业务操作</span></div>

          <div v-if="availableActions.length === 0" class="empty" style="padding:20px 0;">
            当前角色对该工单暂无可用操作
            <div style="margin-top:8px;font-size:12px;color:#9ca3af;">
              状态：{{ detail.ticket.status_display }}
              <br />处理人：{{ detail.ticket.current_handler_name }}
            </div>
          </div>
          <div v-else class="action-buttons">
            <button
              v-for="act in availableActions"
              :key="act.target_status"
              :class="['btn', act.btnClass]"
              @click="openAction(act)"
            >
              {{ act.label }}
            </button>
          </div>

          <div style="margin-top:16px;padding-top:14px;border-top:1px solid #f3f4f6;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">当前登录身份：</div>
            <div style="font-size:14px;font-weight:500;">{{ currentUser?.role_display }} - {{ currentUser?.name }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 处理动作 Modal -->
    <div v-if="showAction" class="modal-mask" @click.self="showAction = null">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ currentAction?.label }}</div>
          <button class="modal-close" @click="showAction = null">×</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info">
            工单将从「{{ detail?.ticket.status_display }}」流转到「{{ statusName(currentAction?.target_status) }}」
          </div>
          <div class="form-group" v-if="currentAction?.needResult">
            <label>处理结果 *</label>
            <textarea v-model="actionForm.processing_result" rows="4" placeholder="请填写处理结果..."></textarea>
          </div>
          <div class="form-group" v-if="currentAction?.needReturnReason">
            <label>退回原因 *</label>
            <textarea v-model="actionForm.return_reason" rows="4" placeholder="请详细说明退回补正原因..."></textarea>
          </div>
          <div class="form-group">
            <label>备注 / 审计说明 {{ currentAction?.needRemark ? '*' : '' }}</label>
            <textarea v-model="actionForm.remark" rows="3" placeholder="选填：操作备注将写入审计轨迹"></textarea>
          </div>
          <div v-if="currentAction?.needEvidence" class="alert alert-warning">
            ⚠️ 此操作需要提供证据（附件）。当前已有 {{ detail?.attachments.length || 0 }} 个附件，不足请先上传。
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAction = null">取消</button>
          <button class="btn btn-primary" @click="doAction" :disabled="processing">{{ processing ? '提交中...' : '确认提交' }}</button>
        </div>
      </div>
    </div>

    <!-- 添加附件 -->
    <div v-if="showAddAttachment" class="modal-mask" @click.self="showAddAttachment = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">上传附件（证据）</div>
          <button class="modal-close" @click="showAddAttachment = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>文件名 *</label>
            <input v-model="attachForm.filename" placeholder="例如：购买凭证.jpg" />
          </div>
          <div class="form-group">
            <label>文件类型</label>
            <select v-model="attachForm.file_type">
              <option value="image">图片</option>
              <option value="pdf">PDF</option>
              <option value="video">视频</option>
              <option value="doc">文档</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label>文件地址（演示）*</label>
            <input v-model="attachForm.url" placeholder="https://example.com/file.jpg" />
          </div>
          <div class="alert alert-info">演示环境：直接填写文件名模拟上传即可。</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddAttachment = false">取消</button>
          <button class="btn btn-primary" @click="doAddAttachment" :disabled="processing">{{ processing ? '提交中...' : '添加' }}</button>
        </div>
      </div>
    </div>

    <!-- 添加审计备注 -->
    <div v-if="showAddAudit" class="modal-mask" @click.self="showAddAudit = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">添加审计备注</div>
          <button class="modal-close" @click="showAddAudit = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>备注内容 *</label>
            <textarea v-model="auditForm.content" rows="4" placeholder="请填写审计备注..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddAudit = false">取消</button>
          <button class="btn btn-primary" @click="doAddAudit" :disabled="processing">{{ processing ? '提交中...' : '添加' }}</button>
        </div>
      </div>
    </div>

    <!-- 登记异常 -->
    <div v-if="showAddException" class="modal-mask" @click.self="showAddException = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">登记异常原因</div>
          <button class="modal-close" @click="showAddException = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>异常类型 *</label>
            <select v-model="exceptionForm.reason_type">
              <option value="缺材料">缺材料</option>
              <option value="逾期">逾期</option>
              <option value="退回补正">退回补正</option>
              <option value="状态冲突">状态冲突</option>
              <option value="物流异常">物流异常</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label>异常描述 *</label>
            <textarea v-model="exceptionForm.description" rows="4" placeholder="请详细描述异常情况..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddException = false">取消</button>
          <button class="btn btn-primary" @click="doAddException" :disabled="processing">{{ processing ? '提交中...' : '登记' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api/index.js'
import { getCurrentUser } from '../stores/auth.js'

const props = defineProps(['id'])
const router = useRouter()
const route = useRoute()

const ticketId = computed(() => props.id || route.params.id)
const currentUser = ref(getCurrentUser())

const loading = ref(false)
const processing = ref(false)
const error = ref('')
const successMsg = ref('')
const detail = ref(null)
const activeTab = ref('attachments')

const showAction = ref(false)
const currentAction = ref(null)
const actionForm = reactive({ remark: '', processing_result: '', return_reason: '' })

const showAddAttachment = ref(false)
const attachForm = reactive({ filename: '', file_type: 'image', url: '' })

const showAddAudit = ref(false)
const auditForm = reactive({ content: '' })

const showAddException = ref(false)
const exceptionForm = reactive({ reason_type: '缺材料', description: '' })

const tabs = computed(() => [
  { key: 'attachments', label: '附件证据', count: detail.value?.attachments.length || 0 },
  { key: 'records', label: '处理记录', count: detail.value?.processing_records.length || 0 },
  { key: 'audit', label: '审计备注', count: detail.value?.audit_remarks.length || 0 },
  { key: 'exceptions', label: '异常原因', count: detail.value?.exception_reasons.length || 0 },
])

const availableActions = computed(() => {
  if (!detail.value) return []
  const role = currentUser.value?.role
  const status = detail.value.ticket.status
  const handler = detail.value.ticket.current_handler_id
  const me = currentUser.value?.id
  if (handler !== me) return []

  const actions = []
  const push = (label, target, btnClass, needEvidence, needRemark, needResult, needReturnReason) => {
    actions.push({ label, target_status: target, btnClass, needEvidence, needRemark, needResult, needReturnReason })
  }

  switch (role) {
    case 'registrar':
    case 'agent':
      if (status === 'pending_receipt') push('签收并登记来电', 'call_registered', 'btn-primary', false, true, false, false)
      if (status === 'exception_returned') push('补正后重新提交', 'call_registered', 'btn-success', true, true, false, false)
      if (status === 'dispatched') push('回访并关闭工单', 'callback_closed', 'btn-success', true, true, true, false)
      break
    case 'supervisor':
      if (status === 'call_registered') push('派单处理', 'dispatched', 'btn-primary', true, true, false, false)
      if (status === 'call_registered') push('退回补正（缺材料）', 'exception_returned', 'btn-warning', false, true, false, true)
      if (status === 'dispatched') push('审核签收完成', 'receipt_completed', 'btn-success', true, true, true, false)
      if (status === 'dispatched') push('退回补正', 'exception_returned', 'btn-danger', false, true, false, true)
      break
    case 'qa_supervisor':
      if (status === 'dispatched') push('质检签收完成', 'receipt_completed', 'btn-success', true, true, true, false)
      break
    case 'reviewer':
      if (status === 'callback_closed') push('复核归档', 'archived', 'btn-primary', false, true, false, false)
      if (status === 'receipt_completed') push('复核归档', 'archived', 'btn-primary', false, true, false, false)
      if (status === 'callback_closed' || status === 'receipt_completed') push('复核退回', 'exception_returned', 'btn-danger', false, true, false, true)
      break
    case 'cs_manager':
      break
  }

  return actions
})

onMounted(() => {
  loadDetail()
})

async function loadDetail() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await api.getTicket(ticketId.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/')
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  const pad = n => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function statusName(s) {
  const m = {
    pending_receipt: '待签收', exception_returned: '异常回传', receipt_completed: '签收完成',
    call_registered: '来电登记', dispatched: '问题派单', callback_closed: '回访关闭', archived: '已归档'
  }
  return m[s] || s
}

function roleName(r) {
  const m = {
    registrar: '客服登记员', supervisor: '客服审核主管', reviewer: '复核负责人',
    agent: '客服坐席', qa_supervisor: '质检主管', cs_manager: '客服经理'
  }
  return m[r] || r
}

function openAction(act) {
  currentAction.value = act
  actionForm.remark = ''
  actionForm.processing_result = ''
  actionForm.return_reason = ''
  showAction.value = true
}

async function doAction() {
  if (!currentAction.value) return
  const act = currentAction.value
  if (act.needReturnReason && !actionForm.return_reason) {
    alert('请填写退回原因')
    return
  }
  if (act.needResult && !actionForm.processing_result) {
    alert('请填写处理结果')
    return
  }
  if (act.needRemark && !actionForm.remark) {
    alert('请填写备注')
    return
  }

  processing.value = true
  error.value = ''
  successMsg.value = ''
  try {
    const newDetail = await api.processTicket(ticketId.value, {
      action: act.label,
      target_status: act.target_status,
      remark: actionForm.remark,
      processing_result: actionForm.processing_result || null,
      return_reason: actionForm.return_reason || null,
      version: detail.value.ticket.version,
    })
    detail.value = newDetail
    successMsg.value = '操作成功！工单状态已更新'
    showAction.value = false
    setTimeout(() => successMsg.value = '', 3000)
  } catch (e) {
    error.value = e.message
  } finally {
    processing.value = false
  }
}

async function doAddAttachment() {
  if (!attachForm.filename || !attachForm.url) {
    alert('请填写文件名和文件地址')
    return
  }
  processing.value = true
  try {
    await api.addAttachment(ticketId.value, { ...attachForm })
    attachForm.filename = ''
    attachForm.url = ''
    showAddAttachment.value = false
    await loadDetail()
  } catch (e) {
    alert(e.message)
  } finally {
    processing.value = false
  }
}

async function doAddAudit() {
  if (!auditForm.content) {
    alert('请填写备注内容')
    return
  }
  processing.value = true
  try {
    await api.addAuditRemark(ticketId.value, auditForm.content)
    auditForm.content = ''
    showAddAudit.value = false
    await loadDetail()
  } catch (e) {
    alert(e.message)
  } finally {
    processing.value = false
  }
}

async function doAddException() {
  if (!exceptionForm.description) {
    alert('请填写异常描述')
    return
  }
  processing.value = true
  try {
    await api.addExceptionReason(ticketId.value, exceptionForm.reason_type, exceptionForm.description)
    exceptionForm.description = ''
    showAddException.value = false
    await loadDetail()
  } catch (e) {
    alert(e.message)
  } finally {
    processing.value = false
  }
}
</script>
