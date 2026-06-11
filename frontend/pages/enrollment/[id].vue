<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="btn btn-sm" @click="goBack">← 返回列表</button>
      <h2 class="detail-title">入会单详情 #{{ enrollment?.id }}</h2>
      <div class="detail-status">
        <span class="tag" :class="'tag-' + enrollment?.status">
          {{ STATUS_LABELS[enrollment?.status || 'pending'] }}
        </span>
        <span
          v-if="enrollment?.expiry_status"
          class="tag ml-2"
          :class="'tag-' + enrollment.expiry_status"
        >
          {{ EXPIRY_LABELS[enrollment.expiry_status] }}
        </span>
        <span v-if="enrollment?.has_exception" class="tag tag-overdue ml-2">
          有异常
        </span>
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-4">
      <span class="alert-icon">⚠️</span>
      <span>{{ error }}</span>
    </div>

    <div v-if="enrollment" class="detail-content">
      <div class="detail-main">
        <div class="card mb-4">
          <div class="card-header">
            <span>基本信息</span>
            <span class="text-sm text-secondary">
              版本 v{{ enrollment.version }}
            </span>
          </div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">会员姓名</span>
                <span class="info-value">{{ enrollment.member_name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">手机号码</span>
                <span class="info-value">{{ enrollment.member_phone }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">身份证号</span>
                <span class="info-value">{{ enrollment.member_id_card || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">会籍类型</span>
                <span class="info-value">{{ enrollment.membership_type }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">卡等级</span>
                <span class="info-value">{{ enrollment.card_level || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">金额</span>
                <span class="info-value">¥{{ enrollment.amount }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">合同编号</span>
                <span class="info-value">{{ enrollment.contract_no || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">门店</span>
                <span class="info-value">{{ enrollment.store }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">会籍顾问</span>
                <span class="info-value">{{ enrollment.salesperson || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">私教主管</span>
                <span class="info-value">{{ enrollment.private_trainer || '-' }}</span>
              </div>
              <div class="info-item info-item-full">
                <span class="info-label">备注</span>
                <span class="info-value">{{ enrollment.remark || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header">
            <span>证据材料</span>
            <span class="text-sm" :class="evidenceCompleteCount === totalEvidenceTypes ? 'text-success' : 'text-warning'">
              {{ evidenceCompleteCount }}/{{ totalEvidenceTypes }} 项齐全
            </span>
          </div>
          <div class="card-body">
            <div class="evidence-grid">
              <div
                v-for="(label, key) in EVIDENCE_LABELS"
                :key="key"
                class="evidence-card"
                :class="{ complete: detail?.evidence_summary?.[key] }"
              >
                <div class="evidence-icon">
                  {{ detail?.evidence_summary?.[key] ? '✓' : '○' }}
                </div>
                <div class="evidence-info">
                  <div class="evidence-name">{{ label }}</div>
                  <div class="evidence-status text-sm">
                    {{ detail?.evidence_summary?.[key] ? '已上传' : '未上传' }}
                  </div>
                </div>
                <div v-if="getAttachment(key as any)" class="evidence-file text-sm text-secondary">
                  {{ getAttachment(key as any)?.file_name }}
                </div>
              </div>
            </div>
            <div v-if="evidenceCompleteCount < totalEvidenceTypes" class="evidence-tip mt-3">
              <span class="tip-icon">💡</span>
              <span class="text-sm text-warning">
                缺少 {{ totalEvidenceTypes - evidenceCompleteCount }} 项证据，审核/复核通过前请补齐
              </span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span>操作与补正记录</span>
            <span class="text-sm text-secondary">
              共 {{ detail?.audit_logs?.length || 0 }} 条记录
            </span>
          </div>
          <div class="card-body">
            <div class="timeline">
              <div v-for="log in detail?.audit_logs || []" :key="log.id" class="timeline-item">
                <div class="timeline-dot" :class="'dot-' + log.action_type"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="action-badge" :class="'action-' + log.action_type">
                      {{ ACTION_LABELS[log.action_type] }}
                    </span>
                    <span class="timeline-user">{{ log.user?.full_name || '系统' }}</span>
                    <span class="timeline-role text-sm text-tertiary">
                      {{ log.user ? ROLE_LABELS[log.user.role as RoleEnum] : '' }}
                    </span>
                    <span class="timeline-time text-sm text-tertiary">
                      {{ formatDateTime(log.created_at) }}
                    </span>
                  </div>
                  <div v-if="log.comment" class="timeline-comment">
                    <span class="comment-label">备注：</span>
                    <span>{{ log.comment }}</span>
                  </div>
                  <div v-if="log.old_status || log.new_status" class="timeline-status">
                    <template v-if="log.old_status">
                      <span class="tag tag-sm" :class="'tag-' + log.old_status">
                        {{ STATUS_LABELS[log.old_status] }}
                      </span>
                      <span class="arrow">→</span>
                    </template>
                    <span v-if="log.new_status" class="tag tag-sm" :class="'tag-' + log.new_status">
                      {{ STATUS_LABELS[log.new_status] }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-sidebar">
        <div class="card mb-4 role-card">
          <div class="card-header">
            <span>角色与权责</span>
          </div>
          <div class="card-body">
            <div class="role-info">
              <div class="role-avatar">👤</div>
              <div class="role-detail">
                <div class="role-name">{{ auth.currentUser.value?.full_name || '未登录' }}</div>
                <div class="role-label text-sm text-secondary">
                  {{ ROLE_LABELS[auth.userRole.value as RoleEnum] || '-' }}
                </div>
              </div>
            </div>
            <div class="role-divider"></div>
            <div class="handler-section">
              <div class="handler-row">
                <span class="handler-label text-sm text-secondary">当前节点</span>
                <span class="handler-value">
                  <span v-if="enrollment.required_role" class="tag tag-info">
                    {{ ROLE_LABELS[enrollment.required_role as RoleEnum] }}
                  </span>
                  <span v-else class="text-tertiary">
                    {{ enrollment.status === 'completed' ? '已完成' : '-' }}
                  </span>
                </span>
              </div>
              <div class="handler-row">
                <span class="handler-label text-sm text-secondary">责任人</span>
                <span class="handler-value">
                  <span v-if="enrollment.responsible_person">{{ enrollment.responsible_person }}</span>
                  <span v-else class="text-tertiary">-</span>
                </span>
              </div>
              <div class="handler-row">
                <span class="handler-label text-sm text-secondary">当前处理人</span>
                <span class="handler-value">
                  <span v-if="enrollment.current_handler">
                    {{ enrollment.current_handler.full_name }}
                    <span class="text-sm text-tertiary">
                      ({{ ROLE_LABELS[enrollment.current_handler.role as RoleEnum] }})
                    </span>
                  </span>
                  <span v-else class="text-tertiary">
                    {{ enrollment.status === 'completed' ? '已完成' : '待分配' }}
                  </span>
                </span>
              </div>
              <div class="handler-row">
                <span class="handler-label text-sm text-secondary">操作权限</span>
                <span class="handler-value">
                  <span v-if="enrollment.can_operate" class="tag tag-success">
                    可操作
                  </span>
                  <span v-else class="tag tag-disabled">
                    不可操作
                  </span>
                </span>
              </div>
              <div v-if="!enrollment.can_operate && enrollment.operate_reason" class="operate-reason mt-2">
                <span class="reason-icon">🔒</span>
                <span class="reason-text">{{ enrollment.operate_reason }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header">处理进度</div>
          <div class="card-body">
            <div class="progress-step" :class="{ done: enrollment.created_at }">
              <div class="step-dot"></div>
              <div class="step-content">
                <div class="step-title">创建入会单</div>
                <div class="step-info text-sm text-secondary">
                  {{ enrollment.created_by?.full_name || '-' }}
                  <br />
                  {{ formatDateTime(enrollment.created_at) }}
                </div>
              </div>
            </div>
            <div class="progress-step" :class="{ done: enrollment.audited_at, current: !enrollment.audited_at && enrollment.status === 'pending' && !enrollment.audit_by_id }">
              <div class="step-dot"></div>
              <div class="step-content">
                <div class="step-title">主管审核</div>
                <div class="step-info text-sm text-secondary">
                  {{ enrollment.audit_by?.full_name || '待处理' }}
                  <br />
                  {{ enrollment.audited_at ? formatDateTime(enrollment.audited_at) : '-' }}
                </div>
              </div>
            </div>
            <div class="progress-step" :class="{ done: enrollment.reviewed_at, current: enrollment.audited_at && !enrollment.reviewed_at && enrollment.status === 'pending' }">
              <div class="step-dot"></div>
              <div class="step-content">
                <div class="step-title">复核归档</div>
                <div class="step-info text-sm text-secondary">
                  {{ enrollment.review_by?.full_name || '待处理' }}
                  <br />
                  {{ enrollment.reviewed_at ? formatDateTime(enrollment.reviewed_at) : '-' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="unresolvedExceptions.length > 0" class="card mb-4 exception-card">
          <div class="card-header card-header-error">
            <span>⚠️ 待解决异常</span>
            <span class="text-sm">{{ unresolvedExceptions.length }} 项</span>
          </div>
          <div class="card-body">
            <div v-for="exc in unresolvedExceptions" :key="exc.id" class="exception-item exception-item-active">
              <div class="exception-header">
                <span class="tag tag-overdue tag-sm">
                  {{ EXCEPTION_LABELS[exc.exception_type] }}
                </span>
                <span class="error-code text-xs text-tertiary">
                  错误码: {{ exc.exception_type }}
                </span>
              </div>
              <div class="exception-desc text-sm mt-2">{{ exc.description }}</div>
              <div class="exception-meta text-xs text-tertiary mt-1">
                检测方：{{ exc.detected_by || '系统' }} · {{ formatDateTime(exc.detected_at) }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="resolvedExceptions.length > 0" class="card mb-4">
          <div class="card-header">
            <span>✓ 已解决异常</span>
            <span class="text-sm text-secondary">{{ resolvedExceptions.length }} 项</span>
          </div>
          <div class="card-body">
            <div v-for="exc in resolvedExceptions" :key="exc.id" class="exception-item exception-item-resolved">
              <div class="exception-header">
                <span class="tag tag-completed tag-sm">
                  {{ EXCEPTION_LABELS[exc.exception_type] }}
                </span>
              </div>
              <div class="exception-desc text-sm mt-2">{{ exc.description }}</div>
              <div v-if="exc.resolution_note" class="exception-resolution text-sm mt-2">
                <span class="resolution-label">解决：</span>
                <span>{{ exc.resolution_note }}</span>
              </div>
              <div class="exception-meta text-xs text-tertiary mt-1">
                {{ formatDateTime(exc.resolved_at || '') }} 解决
              </div>
            </div>
          </div>
        </div>

        <div class="card action-card">
          <div class="card-header">
            <span>办理操作</span>
          </div>
          <div class="card-body">
            <div v-if="canAuditFinal" class="action-section">
              <div class="action-hint mb-2 text-sm text-success">
                ✓ 您可以审核此单据
              </div>
              <button class="btn btn-success w-full mb-2" @click="handleAuditPass">
                审核通过
              </button>
              <button class="btn btn-error w-full" @click="showAuditFailModal = true">
                审核退回
              </button>
            </div>

            <div v-else-if="canReviewFinal" class="action-section">
              <div class="action-hint mb-2 text-sm text-success">
                ✓ 您可以复核此单据
              </div>
              <button class="btn btn-success w-full mb-2" @click="handleReviewPass">
                复核通过
              </button>
              <button class="btn btn-error w-full" @click="showReviewFailModal = true">
                复核退回
              </button>
            </div>

            <div v-else-if="canCorrectFinal" class="action-section">
              <div class="action-hint mb-2 text-sm text-warning">
                ⚡ 您需要补正此单据
              </div>
              <button class="btn btn-primary w-full" @click="showCorrectModal = true">
                补正提交
              </button>
            </div>

            <div v-else class="action-section">
              <div class="no-permission">
                <div class="no-perm-icon">🔒</div>
                <div class="no-perm-text text-sm text-secondary">
                  无此单据的操作权限
                </div>
                <div class="no-perm-reason text-xs mt-1">
                  {{ enrollment.operate_reason || '当前状态不支持操作' }}
                </div>
              </div>
            </div>

            <div class="version-info mt-4 pt-3 border-top text-xs text-tertiary">
              <div>版本号：v{{ enrollment.version }}</div>
              <div class="mt-1">创建人：{{ enrollment.created_by?.full_name || '-' }}</div>
              <div class="mt-1">处理时限：{{ formatDateTime(enrollment.due_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAuditFailModal" class="modal-mask" @click.self="showAuditFailModal = false">
      <div class="modal">
        <div class="modal-header">
          <span>审核退回</span>
          <button class="close-btn" @click="showAuditFailModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">退回原因 *</label>
            <textarea v-model="auditFailComment" class="form-input" rows="3" placeholder="请输入退回原因，登记员将根据此原因补正"></textarea>
          </div>
          <div class="form-tip text-sm text-tertiary mt-2">
            💡 退回后单据状态变为「核验失败」，当前处理人将变为登记员
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showAuditFailModal = false">取消</button>
          <button class="btn btn-error" :disabled="!auditFailComment.trim()" @click="handleAuditFail">
            确认退回
          </button>
        </div>
      </div>
    </div>

    <div v-if="showReviewFailModal" class="modal-mask" @click.self="showReviewFailModal = false">
      <div class="modal">
        <div class="modal-header">
          <span>复核退回</span>
          <button class="close-btn" @click="showReviewFailModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">退回原因 *</label>
            <textarea v-model="reviewFailComment" class="form-input" rows="3" placeholder="请输入退回原因，登记员将根据此原因补正"></textarea>
          </div>
          <div class="form-tip text-sm text-tertiary mt-2">
            💡 退回后单据状态变为「核验失败」，需要重新走审核流程
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showReviewFailModal = false">取消</button>
          <button class="btn btn-error" :disabled="!reviewFailComment.trim()" @click="handleReviewFail">
            确认退回
          </button>
        </div>
      </div>
    </div>

    <CorrectModal
      v-if="showCorrectModal"
      :enrollment="enrollment"
      :detail="detail"
      @close="showCorrectModal = false"
      @done="onCorrectDone"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { useEnrollmentApi } from '~/composables/useEnrollmentApi'
import {
  STATUS_LABELS,
  EXPIRY_LABELS,
  EVIDENCE_LABELS,
  ACTION_LABELS,
  EXCEPTION_LABELS,
  ROLE_LABELS,
  EVIDENCE_LABELS as EVIDENCE,
  type Enrollment,
  type EnrollmentDetail,
  type EvidenceTypeEnum,
  type RoleEnum,
  type ExceptionLog,
} from '~/types'
import CorrectModal from '~/components/CorrectModal.vue'

const route = useRoute()
const auth = useAuth()
const api = useEnrollmentApi()

const enrollment = ref<Enrollment | null>(null)
const detail = ref<EnrollmentDetail | null>(null)
const error = ref('')

const showAuditFailModal = ref(false)
const showReviewFailModal = ref(false)
const showCorrectModal = ref(false)
const auditFailComment = ref('')
const reviewFailComment = ref('')

const totalEvidenceTypes = Object.keys(EVIDENCE).length
const evidenceCompleteCount = computed(() => {
  if (!detail.value?.evidence_summary) return 0
  return Object.values(detail.value.evidence_summary).filter(Boolean).length
})

const unresolvedExceptions = computed<ExceptionLog[]>(() => {
  return detail.value?.exceptions?.filter(e => !e.resolved) || []
})

const resolvedExceptions = computed<ExceptionLog[]>(() => {
  return detail.value?.exceptions?.filter(e => e.resolved) || []
})

const canAudit = computed(() => {
  if (auth.userRole.value !== 'audit_supervisor') return false
  if (!enrollment.value) return false
  return enrollment.value.status === 'pending' && !enrollment.value.audit_by_id
})

const canReview = computed(() => {
  if (auth.userRole.value !== 'review_lead') return false
  if (!enrollment.value) return false
  return enrollment.value.status === 'pending' && enrollment.value.audit_by_id !== null && !enrollment.value.review_by_id
})

const canCorrect = computed(() => {
  if (auth.userRole.value !== 'registration_clerk') return false
  if (!enrollment.value) return false
  return (
    enrollment.value.status === 'failed' &&
    enrollment.value.created_by_id === auth.currentUser.value?.id
  )
})

const canAuditFinal = computed(() => {
  return enrollment.value?.can_operate && canAudit.value
})

const canReviewFinal = computed(() => {
  return enrollment.value?.can_operate && canReview.value
})

const canCorrectFinal = computed(() => {
  return enrollment.value?.can_operate && canCorrect.value
})

const noPermissionReason = computed(() => {
  if (!enrollment.value) return ''
  const role = auth.userRole.value
  const status = enrollment.value.status

  if (role === 'registration_clerk') {
    if (status === 'failed' && enrollment.value.created_by_id !== auth.currentUser.value?.id) {
      return '这不是您创建的单据，无法补正'
    }
    if (status === 'pending') {
      return '单据待审核中，登记员无法操作'
    }
    if (status === 'completed') {
      return '单据已完成归档'
    }
  }
  if (role === 'audit_supervisor') {
    if (enrollment.value.audit_by_id) {
      return '单据已审核过，请勿重复审核'
    }
    if (status === 'completed') {
      return '单据已完成归档'
    }
    if (status === 'failed') {
      return '单据为核验失败状态，需补正后再审核'
    }
  }
  if (role === 'review_lead') {
    if (!enrollment.value.audit_by_id) {
      return '单据尚未审核，无法复核'
    }
    if (enrollment.value.review_by_id) {
      return '单据已复核过，请勿重复复核'
    }
    if (status === 'failed') {
      return '单据为核验失败状态，需补正后再复核'
    }
    if (status === 'completed') {
      return '单据已完成归档'
    }
  }
  return '当前状态不支持操作'
})

const getAttachment = (type: EvidenceTypeEnum) => {
  return detail.value?.attachments.find(
    (a) => a.evidence_type === type && a.is_valid
  )
}

const loadDetail = async () => {
  const id = Number(route.params.id)
  if (!id) return

  error.value = ''
  try {
    const data = await api.getDetail(id)
    detail.value = data
    enrollment.value = data
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || '加载失败'
  }
}

const handleAuditPass = async () => {
  if (!enrollment.value) return
  error.value = ''
  try {
    await api.audit({
      enrollment_id: enrollment.value.id,
      passed: true,
      version: enrollment.value.version,
    })
    await loadDetail()
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || '操作失败'
  }
}

const handleAuditFail = async () => {
  if (!enrollment.value) return
  error.value = ''
  try {
    await api.audit({
      enrollment_id: enrollment.value.id,
      passed: false,
      comment: auditFailComment.value,
      version: enrollment.value.version,
    })
    showAuditFailModal.value = false
    auditFailComment.value = ''
    await loadDetail()
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || '操作失败'
  }
}

const handleReviewPass = async () => {
  if (!enrollment.value) return
  error.value = ''
  try {
    await api.review({
      enrollment_id: enrollment.value.id,
      passed: true,
      version: enrollment.value.version,
    })
    await loadDetail()
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || '操作失败'
  }
}

const handleReviewFail = async () => {
  if (!enrollment.value) return
  error.value = ''
  try {
    await api.review({
      enrollment_id: enrollment.value.id,
      passed: false,
      comment: reviewFailComment.value,
      version: enrollment.value.version,
    })
    showReviewFailModal.value = false
    reviewFailComment.value = ''
    await loadDetail()
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || '操作失败'
  }
}

const onCorrectDone = () => {
  showCorrectModal.value = false
  loadDetail()
}

const goBack = () => {
  navigateTo('/')
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(
  () => auth.isLoggedIn.value,
  (val) => {
    if (val) {
      loadDetail()
    }
  }
)

onMounted(() => {
  if (auth.isLoggedIn.value) {
    loadDetail()
  }
})
</script>

<style scoped>
.detail-page {
  max-width: 1200px;
  margin: 0 auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.detail-title {
  font-size: 20px;
  font-weight: 600;
  flex: 1;
}

.detail-status {
  display: flex;
  align-items: center;
}

.detail-content {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
}

.detail-main {
  min-width: 0;
}

.detail-sidebar {
  min-width: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item-full {
  grid-column: span 2;
}

.info-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.evidence-card {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  text-align: center;
}

.evidence-card.complete {
  border-color: var(--success-color);
  background-color: #f6ffed;
}

.evidence-icon {
  font-size: 24px;
  color: var(--success-color);
  margin-bottom: 8px;
}

.evidence-card:not(.complete) .evidence-icon {
  color: var(--text-tertiary);
}

.evidence-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.evidence-status {
  color: var(--text-secondary);
}

.evidence-file {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #f0f0f0;
  word-break: break-all;
}

.evidence-tip {
  padding: 8px 12px;
  background-color: #fffbe6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tip-icon {
  font-size: 14px;
}

.text-warning {
  color: var(--warning-color);
}

.timeline {
  position: relative;
  padding-left: 8px;
}

.timeline-item {
  position: relative;
  padding-left: 24px;
  padding-bottom: 20px;
  display: flex;
  gap: 12px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -4px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--primary-color);
  border: 2px solid white;
  box-shadow: 0 0 0 2px var(--primary-color);
  z-index: 1;
}

.timeline-dot.dot-create {
  background-color: #2f54eb;
  box-shadow: 0 0 0 2px #2f54eb;
}

.timeline-dot.dot-audit_pass,
.timeline-dot.dot-review_pass {
  background-color: var(--success-color);
  box-shadow: 0 0 0 2px var(--success-color);
}

.timeline-dot.dot-audit_fail,
.timeline-dot.dot-review_fail {
  background-color: var(--error-color);
  box-shadow: 0 0 0 2px var(--error-color);
}

.timeline-dot.dot-correct {
  background-color: var(--warning-color);
  box-shadow: 0 0 0 2px var(--warning-color);
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 16px;
  bottom: -4px;
  width: 2px;
  background-color: #f0f0f0;
}

.timeline-item:last-child::before {
  display: none;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.action-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background-color: #e6f7ff;
  color: var(--primary-color);
}

.action-audit_pass,
.action-review_pass {
  background-color: #f6ffed;
  color: var(--success-color);
}

.action-audit_fail,
.action-review_fail {
  background-color: #fff2f0;
  color: var(--error-color);
}

.action-create {
  background-color: #f0f5ff;
  color: #2f54eb;
}

.action-correct {
  background-color: #fffbe6;
  color: var(--warning-color);
}

.timeline-user {
  font-weight: 500;
  font-size: 14px;
}

.timeline-role {
  color: var(--text-tertiary);
}

.timeline-time {
  margin-left: auto;
}

.timeline-comment {
  color: var(--text-secondary);
  margin-top: 4px;
  font-size: 13px;
  background: #fafafa;
  padding: 6px 10px;
  border-radius: 4px;
}

.comment-label {
  color: var(--text-tertiary);
}

.timeline-status {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.arrow {
  color: var(--text-tertiary);
}

.role-card {
  background: linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%);
}

.role-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.role-detail {
  flex: 1;
}

.role-name {
  font-weight: 600;
  font-size: 15px;
}

.role-label {
  margin-top: 2px;
}

.role-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 12px 0;
}

.handler-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.handler-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.handler-label {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.handler-value {
  font-weight: 500;
  font-size: 13px;
  text-align: right;
}

.operate-reason {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  background: #fff2e8;
  border: 1px solid #ffd591;
  border-radius: 6px;
}

.reason-icon {
  flex-shrink: 0;
  font-size: 13px;
  line-height: 1.4;
}

.reason-text {
  font-size: 12px;
  color: #d4380d;
  line-height: 1.5;
}

.tag-info {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.tag-success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.tag-disabled {
  background: #f5f5f5;
  color: #8c8c8c;
  border: 1px solid #d9d9d9;
}

.no-perm-reason {
  color: #d4380d;
}

.progress-step {
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
  position: relative;
}

.progress-step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 9px;
  top: 24px;
  bottom: 0;
  width: 2px;
  background-color: #f0f0f0;
}

.progress-step.current .step-dot {
  background-color: var(--primary-color);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(24, 144, 255, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(24, 144, 255, 0); }
}

.step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #f0f0f0;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.progress-step.done .step-dot {
  background-color: var(--success-color);
}

.step-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.exception-card .card-header-error {
  color: var(--error-color);
  background-color: #fff2f0;
  margin: -1px -1px 0 -1px;
  padding: 12px 16px;
  border-radius: 8px 8px 0 0;
}

.exception-item {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
}

.exception-item:last-child {
  margin-bottom: 0;
}

.exception-item-active {
  background-color: #fff2f0;
  border-left: 3px solid var(--error-color);
}

.exception-item-resolved {
  background-color: #f6ffed;
  border-left: 3px solid var(--success-color);
  opacity: 0.8;
}

.exception-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-code {
  font-family: monospace;
}

.exception-resolution {
  padding-top: 6px;
  border-top: 1px dashed #b7eb8f;
  color: var(--success-color);
  font-size: 12px;
}

.resolution-label {
  font-weight: 500;
}

.action-card {
  border: 2px solid var(--primary-color);
}

.action-hint {
  padding: 6px 10px;
  background: #f6ffed;
  border-radius: 4px;
}

.action-hint.text-warning {
  background: #fffbe6;
}

.action-section {
  margin-bottom: 8px;
}

.no-permission {
  text-align: center;
  padding: 16px 0;
}

.no-perm-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.no-perm-text {
  margin-bottom: 4px;
}

.no-perm-reason {
  line-height: 1.5;
}

.w-full {
  width: 100%;
}

.ml-2 {
  margin-left: 8px;
}

.mt-1 {
  margin-top: 4px;
}

.mt-2 {
  margin-top: 8px;
}

.mt-3 {
  margin-top: 12px;
}

.mt-4 {
  margin-top: 16px;
}

.mb-2 {
  margin-bottom: 8px;
}

.mb-3 {
  margin-bottom: 12px;
}

.mb-4 {
  margin-bottom: 16px;
}

.pt-3 {
  padding-top: 12px;
}

.pt-4 {
  padding-top: 16px;
}

.border-top {
  border-top: 1px solid #f0f0f0;
}

.text-sm {
  font-size: 12px;
}

.text-xs {
  font-size: 11px;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-tertiary {
  color: var(--text-tertiary);
}

.text-error {
  color: var(--error-color);
}

.text-success {
  color: var(--success-color);
}

.text-warning {
  color: var(--warning-color);
}

.tag-sm {
  font-size: 11px;
  padding: 1px 6px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
}

.alert-error {
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  color: var(--error-color);
}

.alert-icon {
  font-size: 18px;
}

.form-tip {
  color: var(--text-tertiary);
}
</style>
