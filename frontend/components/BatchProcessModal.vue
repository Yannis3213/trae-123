<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal modal-large">
      <div class="modal-header">
        <span>{{ isAudit ? '批量审核' : '批量复核' }}</span>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <div v-if="!processing && !results">
          <p class="mb-4">
            共选中 <strong>{{ selectedIds.length }}</strong> 条入会单，请选择处理方式：
          </p>

          <div class="batch-actions mb-4">
            <button
              class="btn btn-success"
              :disabled="processing"
              @click="handleBatch(true)"
            >
              ✓ {{ isAudit ? '审核通过' : '复核通过' }}
            </button>
            <button
              class="btn btn-error"
              :disabled="processing"
              @click="showRejectReason = true"
            >
              ✗ {{ isAudit ? '审核退回' : '复核退回' }}
            </button>
          </div>

          <div v-if="showRejectReason" class="reject-reason-section">
            <div class="form-item">
              <label class="form-label">退回原因</label>
              <textarea
                v-model="rejectComment"
                class="form-input"
                rows="3"
                placeholder="请输入退回原因..."
              ></textarea>
            </div>
            <div class="flex gap-2 justify-end">
              <button class="btn btn-sm" @click="showRejectReason = false">取消</button>
              <button
                class="btn btn-sm btn-error"
                :disabled="!rejectComment.trim()"
                @click="handleBatch(false)"
              >
                确认退回
              </button>
            </div>
          </div>

          <div class="selected-list mt-4">
            <div class="form-label mb-2">选中的入会单：</div>
            <div class="selected-items">
              <div v-for="id in selectedIds" :key="id" class="selected-item">
                #{{ id }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="processing" class="processing-section">
          <div class="spinner"></div>
          <p class="mt-3">处理中... {{ processedCount }} / {{ selectedIds.length }}</p>
        </div>

        <div v-if="results" class="results-section">
          <div class="result-summary mb-4">
            <div class="summary-item success">
              <span class="count">{{ results.success_count }}</span>
              <span class="label">成功</span>
            </div>
            <div class="summary-item fail">
              <span class="count">{{ results.fail_count }}</span>
              <span class="label">失败</span>
            </div>
          </div>

          <div class="result-list">
            <div class="form-label mb-2">详细结果：</div>
            <div
              v-for="result in results.results"
              :key="result.id"
              class="result-item"
              :class="{ failed: !result.success }"
            >
              <div class="result-id">
                <span v-if="result.success" class="text-success">✓</span>
                <span v-else class="text-error">✗</span>
                入会单 #{{ result.id }}
              </div>
              <div class="result-message text-sm">
                {{ result.message }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button v-if="results" class="btn btn-primary" @click="handleDone">完成</button>
        <button v-else class="btn" @click="$emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEnrollmentApi } from '~/composables/useEnrollmentApi'
import type { BatchResultResponse } from '~/types'

const props = defineProps<{
  selectedIds: number[]
  role: string
}>()

const emit = defineEmits<{
  close: []
  done: []
}>()

const api = useEnrollmentApi()

const processing = ref(false)
const processedCount = ref(0)
const results = ref<BatchResultResponse | null>(null)
const showRejectReason = ref(false)
const rejectComment = ref('')

const isAudit = computed(() => props.role === 'audit_supervisor')
const isReview = computed(() => props.role === 'review_lead')

const handleBatch = async (passed: boolean) => {
  if (!passed && !rejectComment.value.trim()) {
    return
  }

  processing.value = true
  processedCount.value = 0
  results.value = null

  try {
    let result: BatchResultResponse
    if (isAudit.value) {
      result = await api.batchAudit({
        ids: props.selectedIds,
        passed,
        comment: passed ? undefined : rejectComment.value,
      })
    } else {
      result = await api.batchReview({
        ids: props.selectedIds,
        passed,
        comment: passed ? undefined : rejectComment.value,
      })
    }
    results.value = result
  } catch (e: any) {
    results.value = {
      total: props.selectedIds.length,
      success_count: 0,
      fail_count: props.selectedIds.length,
      results: props.selectedIds.map((id) => ({
        id,
        success: false,
        message: e?.data?.detail || e?.message || '批量处理失败',
      })),
    }
  } finally {
    processing.value = false
    showRejectReason.value = false
  }
}

const handleDone = () => {
  emit('done')
}
</script>

<style scoped>
.modal-large {
  width: 560px;
  max-width: 90vw;
}

.batch-actions {
  display: flex;
  gap: 12px;
}

.reject-reason-section {
  padding: 16px;
  background-color: #fff2f0;
  border-radius: 6px;
  margin-bottom: 16px;
}

.selected-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-item {
  padding: 4px 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 13px;
}

.processing-section {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.result-summary {
  display: flex;
  gap: 24px;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 6px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.summary-item .count {
  font-size: 28px;
  font-weight: 700;
}

.summary-item.success .count {
  color: var(--success-color);
}

.summary-item.fail .count {
  color: var(--error-color);
}

.summary-item .label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.result-list {
  max-height: 300px;
  overflow-y: auto;
}

.result-item {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.result-item.failed {
  background-color: #fff2f0;
}

.result-id {
  font-weight: 500;
  margin-bottom: 2px;
}

.result-message {
  color: var(--text-secondary);
}

.flex {
  display: flex;
}

.gap-2 {
  gap: 8px;
}

.justify-end {
  justify-content: flex-end;
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

.mb-4 {
  margin-bottom: 16px;
}

.text-sm {
  font-size: 12px;
}

.text-success {
  color: var(--success-color);
}

.text-error {
  color: var(--error-color);
}

.text-secondary {
  color: var(--text-secondary);
}
</style>
