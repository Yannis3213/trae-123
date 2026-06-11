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

          <div class="batch-tip text-sm text-tertiary mb-4">
            💡 提示：批量处理将逐条执行，遇到异常会跳过并记录错误原因
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
          <p class="text-sm text-secondary mt-1">
            成功 {{ successCount }} · 失败 {{ failCount }}
          </p>
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
            <div class="summary-item total">
              <span class="count">{{ results.total }}</span>
              <span class="label">总计</span>
            </div>
          </div>

          <div class="result-tabs mb-3">
            <button
              class="tab-btn"
              :class="{ active: resultFilter === 'all' }"
              @click="resultFilter = 'all'"
            >
              全部 ({{ results.results.length }})
            </button>
            <button
              class="tab-btn"
              :class="{ active: resultFilter === 'success' }"
              @click="resultFilter = 'success'"
            >
              成功 ({{ results.success_count }})
            </button>
            <button
              class="tab-btn"
              :class="{ active: resultFilter === 'fail' }"
              @click="resultFilter = 'fail'"
            >
              失败 ({{ results.fail_count }})
            </button>
          </div>

          <div class="result-list">
            <div class="form-label mb-2">详细结果：</div>
            <div
              v-for="result in filteredResults"
              :key="result.id"
              class="result-item"
              :class="{ failed: !result.success }"
            >
              <div class="result-header">
                <div class="result-id">
                  <span v-if="result.success" class="result-icon text-success">✓</span>
                  <span v-else class="result-icon text-error">✗</span>
                  <span class="result-id-text">入会单 #{{ result.id }}</span>
                </div>
                <div v-if="result.error_code" class="result-error-code">
                  <span class="error-tag">
                    {{ ERROR_CODE_LABELS[result.error_code] || result.error_code }}
                  </span>
                </div>
              </div>
              <div class="result-message text-sm">
                {{ result.message }}
              </div>
              <div v-if="!result.success && result.error_code" class="result-hint text-xs">
                <span class="hint-icon">💡</span>
                <span>{{ getErrorHint(result.error_code) }}</span>
              </div>
            </div>
            <div v-if="filteredResults.length === 0" class="result-empty text-center text-tertiary py-4">
              暂无数据
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
import { ERROR_CODE_LABELS, type BatchResultResponse } from '~/types'

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
const successCount = ref(0)
const failCount = ref(0)
const results = ref<BatchResultResponse | null>(null)
const showRejectReason = ref(false)
const rejectComment = ref('')
const resultFilter = ref<'all' | 'success' | 'fail'>('all')

const isAudit = computed(() => props.role === 'audit_supervisor')

const filteredResults = computed(() => {
  if (!results.value) return []
  if (resultFilter.value === 'all') return results.value.results
  if (resultFilter.value === 'success') return results.value.results.filter(r => r.success)
  return results.value.results.filter(r => !r.success)
})

const getErrorHint = (errorCode: string) => {
  const hints: Record<string, string> = {
    unauthorized_advance: '请检查当前登录角色是否有权限执行此操作',
    status_conflict: '单据状态已发生变化，请刷新后再试',
    version_conflict: '单据已被他人修改，请刷新页面获取最新版本',
    missing_materials: '请先补齐缺失的证据材料再进行审核/复核',
    overdue: '单据已逾期，请先处理逾期异常或联系管理员',
    not_found: '该单据可能已被删除，请刷新列表',
    business_error: '业务逻辑错误，请联系技术支持',
  }
  return hints[errorCode] || '请稍后重试或联系管理员'
}

const handleBatch = async (passed: boolean) => {
  if (!passed && !rejectComment.value.trim()) {
    return
  }

  processing.value = true
  processedCount.value = 0
  successCount.value = 0
  failCount.value = 0
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
    successCount.value = result.success_count
    failCount.value = result.fail_count
    processedCount.value = result.total
  } catch (e: any) {
    results.value = {
      total: props.selectedIds.length,
      success_count: 0,
      fail_count: props.selectedIds.length,
      results: props.selectedIds.map((id) => ({
        id,
        success: false,
        message: e?.data?.detail || e?.message || '批量处理失败',
        error_code: e?.data?.error_code || 'business_error',
      })),
    }
    failCount.value = props.selectedIds.length
    processedCount.value = props.selectedIds.length
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
  width: 600px;
  max-width: 90vw;
}

.batch-actions {
  display: flex;
  gap: 12px;
}

.batch-tip {
  padding: 8px 12px;
  background: #f6ffed;
  border-radius: 4px;
  border-left: 3px solid var(--success-color);
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
  gap: 12px;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 6px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  background: white;
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

.summary-item.total .count {
  color: var(--text-primary);
}

.summary-item .label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.result-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.result-tabs .tab-btn {
  padding: 4px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 4px;
}

.result-tabs .tab-btn:hover {
  background: #f5f5f5;
}

.result-tabs .tab-btn.active {
  background: #e6f7ff;
  color: var(--primary-color);
}

.result-list {
  max-height: 320px;
  overflow-y: auto;
}

.result-item {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.result-item:hover {
  background: #fafafa;
}

.result-item.failed {
  background-color: #fff2f0;
  border-left: 3px solid var(--error-color);
  border-bottom: 1px solid #ffccc7;
}

.result-item.failed:hover {
  background-color: #ffecea;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.result-id {
  display: flex;
  align-items: center;
  gap: 6px;
}

.result-icon {
  font-weight: bold;
  font-size: 14px;
}

.result-id-text {
  font-weight: 500;
  font-size: 14px;
}

.result-error-code .error-tag {
  padding: 2px 8px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: var(--error-color);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.result-message {
  color: var(--text-secondary);
  margin-left: 20px;
  word-break: break-all;
}

.result-hint {
  margin-left: 20px;
  margin-top: 4px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint-icon {
  font-size: 12px;
}

.result-empty {
  padding: 24px 0;
  color: var(--text-tertiary);
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

.mt-1 {
  margin-top: 4px;
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

.text-sm {
  font-size: 12px;
}

.text-xs {
  font-size: 11px;
}

.text-center {
  text-align: center;
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

.text-tertiary {
  color: var(--text-tertiary);
}

.py-4 {
  padding: 16px 0;
}
</style>
