<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal modal-xl">
      <div class="modal-header">
        <span>补正入会单</span>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <div v-if="error" class="alert alert-error">{{ error }}</div>

        <div class="form-grid">
          <div class="form-item">
            <label class="form-label">会员姓名</label>
            <input v-model="form.member_name" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">手机号码</label>
            <input v-model="form.member_phone" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">身份证号</label>
            <input v-model="form.member_id_card" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">会籍类型</label>
            <select v-model="form.membership_type" class="form-input">
              <option value="月卡">月卡</option>
              <option value="季卡">季卡</option>
              <option value="半年卡">半年卡</option>
              <option value="年卡">年卡</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">卡等级</label>
            <select v-model="form.card_level" class="form-input">
              <option value="">无</option>
              <option value="普通">普通</option>
              <option value="银卡">银卡</option>
              <option value="金卡">金卡</option>
              <option value="钻石卡">钻石卡</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">金额</label>
            <input v-model.number="form.amount" type="number" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">合同编号</label>
            <input v-model="form.contract_no" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">门店</label>
            <select v-model="form.store" class="form-input">
              <option value="朝阳店">朝阳店</option>
              <option value="海淀店">海淀店</option>
              <option value="西城店">西城店</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">会籍顾问</label>
            <input v-model="form.salesperson" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">私教主管</label>
            <input v-model="form.private_trainer" class="form-input" />
          </div>
          <div class="form-item form-item-full">
            <label class="form-label">备注</label>
            <textarea v-model="form.remark" class="form-input" rows="2"></textarea>
          </div>
        </div>

        <div class="evidence-section">
          <div class="form-label mb-2">证据材料</div>
          <div class="evidence-upload-list">
            <div
              v-for="evidence in evidenceOptions"
              :key="evidence.type"
              class="evidence-upload-item"
              :class="{ has: hasEvidence(evidence.type) }"
            >
              <div class="evidence-type">{{ evidence.label }}</div>
              <div v-if="hasEvidence(evidence.type)" class="evidence-file">
                <span class="text-success">✓ 已上传</span>
                <button class="btn btn-sm" @click="toggleEvidence(evidence.type)">
                  替换
                </button>
              </div>
              <button v-else class="btn btn-sm" @click="toggleEvidence(evidence.type)">
                + 上传
              </button>
            </div>
          </div>
          <p class="text-sm text-tertiary mt-2">
            提示：替换或新增的证据将覆盖原证据，审核通过需要三类证据齐全
          </p>
        </div>

        <div class="comment-section mt-4">
          <div class="form-label mb-2">补正说明 *</div>
          <textarea
            v-model="comment"
            class="form-input"
            rows="3"
            placeholder="请说明补正内容..."
          ></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="$emit('close')">取消</button>
        <button
          class="btn btn-primary"
          :disabled="submitting || !comment.trim()"
          @click="handleSubmit"
        >
          {{ submitting ? '提交中...' : '补正提交' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useEnrollmentApi } from '~/composables/useEnrollmentApi'
import { EVIDENCE_LABELS, type Enrollment, type EnrollmentDetail, type EvidenceTypeEnum, type Attachment } from '~/types'

const props = defineProps<{
  enrollment: Enrollment | null
  detail: EnrollmentDetail | null
}>()

const emit = defineEmits<{
  close: []
  done: []
}>()

const api = useEnrollmentApi()

const form = reactive({
  member_name: '',
  member_phone: '',
  member_id_card: '',
  membership_type: '',
  card_level: '',
  amount: 0,
  contract_no: '',
  store: '',
  salesperson: '',
  private_trainer: '',
  remark: '',
})

const attachments = ref<any[]>([])
const comment = ref('')
const submitting = ref(false)
const error = ref('')

const evidenceOptions = [
  { type: 'membership_form' as EvidenceTypeEnum, label: EVIDENCE_LABELS.membership_form },
  { type: 'contract_confirmation' as EvidenceTypeEnum, label: EVIDENCE_LABELS.contract_confirmation },
  { type: 'card_benefits' as EvidenceTypeEnum, label: EVIDENCE_LABELS.card_benefits },
]

const hasEvidence = (type: EvidenceTypeEnum) => {
  return attachments.value.some((a) => a.evidence_type === type)
}

const toggleEvidence = (type: EvidenceTypeEnum) => {
  const idx = attachments.value.findIndex((a) => a.evidence_type === type)
  if (idx > -1) {
    attachments.value.splice(idx, 1)
  } else {
    attachments.value.push({
      evidence_type: type,
      file_name: `${EVIDENCE_LABELS[type]}_补正.pdf`,
      file_url: `/uploads/corrected_${type}.pdf`,
    })
  }
}

onMounted(() => {
  if (props.enrollment) {
    form.member_name = props.enrollment.member_name
    form.member_phone = props.enrollment.member_phone
    form.member_id_card = props.enrollment.member_id_card || ''
    form.membership_type = props.enrollment.membership_type
    form.card_level = props.enrollment.card_level || ''
    form.amount = props.enrollment.amount
    form.contract_no = props.enrollment.contract_no || ''
    form.store = props.enrollment.store
    form.salesperson = props.enrollment.salesperson || ''
    form.private_trainer = props.enrollment.private_trainer || ''
    form.remark = props.enrollment.remark || ''
  }

  if (props.detail?.attachments) {
    attachments.value = props.detail.attachments
      .filter((a: Attachment) => a.is_valid)
      .map((a: Attachment) => ({
        evidence_type: a.evidence_type,
        file_name: a.file_name,
        file_url: a.file_url,
      }))
  }
})

const handleSubmit = async () => {
  if (!props.enrollment || !comment.value.trim()) return

  error.value = ''
  submitting.value = true

  try {
    await api.correct({
      enrollment_id: props.enrollment.id,
      comment: comment.value,
      update_data: {
        ...form,
        attachments: attachments.value,
      },
      version: props.enrollment.version,
    })
    emit('done')
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || '提交失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.modal-xl {
  width: 760px;
  max-width: 95vw;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

.form-item-full {
  grid-column: span 2;
}

.evidence-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.evidence-upload-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.evidence-upload-item {
  padding: 12px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  text-align: center;
}

.evidence-upload-item.has {
  border-color: var(--success-color);
  background-color: #f6ffed;
}

.evidence-type {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.evidence-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.comment-section {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
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

.text-sm {
  font-size: 12px;
}

.text-tertiary {
  color: var(--text-tertiary);
}

.text-success {
  color: var(--success-color);
}
</style>
