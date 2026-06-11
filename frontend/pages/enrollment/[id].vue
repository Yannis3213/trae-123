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
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-4">{{ error }}</div>

    <div v-if="enrollment" class="detail-content">
      <div class="detail-main">
        <div class="card mb-4">
          <div class="card-header">基本信息</div>
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
            <span class="text-sm text-secondary">
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
          </div>
        </div>

        <div class="card">
          <div class="card-header">操作记录</div>
          <div class="card-body">
            <div class="timeline">
              <div v-for="log in detail?.audit_logs || []" :key="log.id" class="timeline-item">
                <div class="timeline-header">
                  <span class="action-badge" :class="'action-' + log.action_type">
                    {{ ACTION_LABELS[log.action_type] }}
                  </span>
                  <span class="timeline-user">{{ log.user?.full_name || '系统' }}</span>
                  <span class="timeline-time text-sm text-tertiary">
                    {{ formatDateTime(log.created_at) }}
                  </span>
                </div>
                <div v-if="log.comment" class="timeline-comment text-sm text-secondary">
                  {{ log.comment }}
                </div>
                <div v-if="log.old_status || log.new_status" class="timeline-status text-sm">
                  <template v-if="log.old_status">
                    <span class="tag" :class="'tag-' + log.old_status">
                      {{ STATUS_LABELS[log.old_status] }}
                    </span>
                    <span class="arrow">→</span>
                  </template>
                  <span v-if="log.new_status" class="tag" :class="'tag-' + log.new_status">
                    {{ STATUS_LABELS[log.new_status] }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-sidebar">
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
            <div class="progress-step" :class="{ done: enrollment.audited_at }">
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
            <div class="progress-step" :class="{ done: enrollment.reviewed_at }">
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

        <div v-if="detail?.exceptions?.length" class="card mb-4">
          <div class="card-header" style="color: var(--error-color)">
            异常记录 <span class="text-sm">({{ detail.exceptions.length }})</span>
          </div>
          <div class="card-body">
            <div v-for="exc in detail.exceptions" :key="exc.id" class="exception-item">
              <div class="exception-header">
                <span class="tag tag-overdue">{{ EXCEPTION_LABELS[exc.exception_type] }}</span>
                <span v-if="exc.resolved" class="tag tag-completed ml-2">已解决</span>
              </div>
              <div class="exception-desc text-sm mt-2">{{ exc.description }}</div>
              <div class="exception-meta text-sm text-tertiary mt-1">
                检测方：{{ exc.detected_by || '系统' }} · {{ formatDateTime(exc.detected_at) }}
              </div>
              <div v-if="exc.resolution_note" class="exception-resolution text-sm mt-2">
                处理：{{ exc.resolution_note }}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">操作</div>
          <div class="card-body">
            <div v-if="canAudit" class="action-buttons">
              <button class="btn btn-success w-full mb-2" @click="handleAuditPass">
                审核通过
              </button>
              <button class="btn btn-error w-full" @click="showAuditFailModal = true">
                审核退回
              </button>
            </div>

            <div v-if="canReview" class="action-buttons">
              <button class="btn btn-success w-full mb-2" @click="handleReviewPass">
                复核通过
              </button>
              <button class="btn btn-error w-full" @click="showReviewFailModal = true">
                复核退回
              </button>
            </div>

            <div v-if="canCorrect" class="action-buttons">
              <button class="btn btn-primary w-full" @click="showCorrectModal = true">
                补正提交
              </button>
            </div>

            <div v-if="!canAudit && !canReview && !canCorrect" class="text-secondary text-sm">
              当前角色无操作权限
            </div>

            <div class="current-handler mt-4 pt-4 border-top">
              <div class="text-sm text-secondary">当前处理人</div>
              <div class="mt-1">
                {{ enrollment.current_handler?.full_name || '暂无' }}
              </div>
            </div>

            <div class="version-info mt-2 text-sm text-tertiary">
              版本号：v{{ enrollment.version }}
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
            <textarea v-model="auditFailComment" class="form-input" rows="3" placeholder="请输入退回原因"></textarea>
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
            <textarea v-model="reviewFailComment" class="form-input" rows="3" placeholder="请输入退回原因"></textarea>
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
  EVIDENCE_LABELS as EVIDENCE,
  type Enrollment,
  type EnrollmentDetail,
  type EvidenceTypeEnum,
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

const canAudit = computed(() => {
  if (auth.userRole.value !== 'audit_supervisor') return false
  if (!enrollment.value) return false
  return enrollment.value.status === 'pending'
})

const canReview = computed(() => {
  if (auth.userRole.value !== 'review_lead') return false
  if (!enrollment.value) return false
  return enrollment.value.status === 'pending' && enrollment.value.audit_by_id !== null
})

const canCorrect = computed(() => {
  if (auth.userRole.value !== 'registration_clerk') return false
  if (!enrollment.value) return false
  return (
    enrollment.value.status === 'failed' &&
    enrollment.value.created_by_id === auth.currentUser.value?.id
  )
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
  grid-template-columns: 1fr 320px;
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

.timeline {
  position: relative;
  padding-left: 24px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background-color: #f0f0f0;
}

.timeline-item {
  position: relative;
  padding-bottom: 20px;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -20px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--primary-color);
  border: 2px solid white;
  box-shadow: 0 0 0 2px var(--primary-color);
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
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

.timeline-time {
  margin-left: auto;
}

.timeline-comment {
  color: var(--text-secondary);
  margin-top: 4px;
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

.exception-item {
  padding: 12px;
  background-color: #fff2f0;
  border-radius: 6px;
  margin-bottom: 8px;
}

.exception-item:last-child {
  margin-bottom: 0;
}

.exception-header {
  display: flex;
  align-items: center;
}

.exception-resolution {
  padding-top: 6px;
  border-top: 1px dashed #ffccc7;
  color: var(--success-color);
}

.action-buttons {
  display: flex;
  flex-direction: column;
}

.current-handler {
  border-top: 1px solid #f0f0f0;
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

.mt-4 {
  margin-top: 16px;
}

.mb-2 {
  margin-bottom: 8px;
}

.mb-4 {
  margin-bottom: 16px;
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
</style>
