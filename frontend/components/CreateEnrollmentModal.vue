<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal modal-large">
      <div class="modal-header">
        <span>新增会员入会单</span>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <div v-if="error" class="alert alert-error">{{ error }}</div>

        <div class="form-grid">
          <div class="form-item">
            <label class="form-label">会员姓名 *</label>
            <input v-model="form.member_name" class="form-input" placeholder="请输入会员姓名" />
          </div>
          <div class="form-item">
            <label class="form-label">手机号码 *</label>
            <input v-model="form.member_phone" class="form-input" placeholder="请输入手机号码" />
          </div>
          <div class="form-item">
            <label class="form-label">身份证号</label>
            <input v-model="form.member_id_card" class="form-input" placeholder="请输入身份证号" />
          </div>
          <div class="form-item">
            <label class="form-label">会籍类型 *</label>
            <select v-model="form.membership_type" class="form-input">
              <option value="">请选择</option>
              <option value="月卡">月卡</option>
              <option value="季卡">季卡</option>
              <option value="半年卡">半年卡</option>
              <option value="年卡">年卡</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">卡等级</label>
            <select v-model="form.card_level" class="form-input">
              <option value="">请选择</option>
              <option value="普通">普通</option>
              <option value="银卡">银卡</option>
              <option value="金卡">金卡</option>
              <option value="钻石卡">钻石卡</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">金额 *</label>
            <input v-model.number="form.amount" type="number" class="form-input" placeholder="请输入金额" />
          </div>
          <div class="form-item">
            <label class="form-label">合同编号</label>
            <input v-model="form.contract_no" class="form-input" placeholder="请输入合同编号" />
          </div>
          <div class="form-item">
            <label class="form-label">会籍顾问</label>
            <input v-model="form.salesperson" class="form-input" placeholder="请输入会籍顾问" />
          </div>
          <div class="form-item">
            <label class="form-label">私教主管</label>
            <input v-model="form.private_trainer" class="form-input" placeholder="请输入私教主管" />
          </div>
          <div class="form-item">
            <label class="form-label">门店 *</label>
            <select v-model="form.store" class="form-input">
              <option value="">请选择</option>
              <option value="朝阳店">朝阳店</option>
              <option value="海淀店">海淀店</option>
              <option value="西城店">西城店</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">处理时限（天）</label>
            <input v-model.number="form.due_days" type="number" class="form-input" min="1" max="30" />
          </div>
          <div class="form-item form-item-full">
            <label class="form-label">备注</label>
            <textarea v-model="form.remark" class="form-input" rows="2" placeholder="请输入备注"></textarea>
          </div>
        </div>

        <div class="evidence-section">
          <div class="form-label mb-2">证据上传（至少三类齐全才能审核通过）</div>
          <div class="evidence-upload-list">
            <div
              v-for="evidence in evidenceOptions"
              :key="evidence.type"
              class="evidence-upload-item"
            >
              <div class="evidence-type">{{ evidence.label }}</div>
              <div v-if="hasEvidence(evidence.type)" class="evidence-file">
                <span class="text-success">✓ 已上传</span>
                <button
                  class="btn btn-sm text-error"
                  @click="removeEvidence(evidence.type)"
                >
                  移除
                </button>
              </div>
              <button
                v-else
                class="btn btn-sm"
                @click="addEvidence(evidence.type)"
              >
                + 上传
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="submitting" @click="handleSubmit">
          {{ submitting ? '提交中...' : '提交' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useEnrollmentApi } from '~/composables/useEnrollmentApi'
import { EVIDENCE_LABELS, type EvidenceTypeEnum } from '~/types'

const emit = defineEmits<{
  close: []
  created: []
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
  salesperson: '',
  private_trainer: '',
  store: '',
  remark: '',
  due_days: 3,
})

const attachments = ref<any[]>([])
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

const addEvidence = (type: EvidenceTypeEnum) => {
  attachments.value.push({
    evidence_type: type,
    file_name: `${EVIDENCE_LABELS[type]}_demo.pdf`,
    file_url: `/uploads/demo_${type}.pdf`,
  })
}

const removeEvidence = (type: EvidenceTypeEnum) => {
  const idx = attachments.value.findIndex((a) => a.evidence_type === type)
  if (idx > -1) {
    attachments.value.splice(idx, 1)
  }
}

const handleSubmit = async () => {
  error.value = ''

  if (!form.member_name || !form.member_phone || !form.membership_type || !form.amount || !form.store) {
    error.value = '请填写必填项'
    return
  }

  submitting.value = true
  try {
    await api.create({
      ...form,
      attachments: attachments.value,
    })
    emit('created')
  } catch (e: any) {
    error.value = e?.data?.detail || e?.message || '提交失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.modal-large {
  width: 680px;
  max-width: 90vw;
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

textarea.form-input {
  resize: vertical;
  font-family: inherit;
}
</style>
