<template>
  <div>
    <div class="flex-between mb-4">
      <button class="btn btn-outline" @click="goBack">← 返回列表</button>
      <div class="flex gap-2">
        <span class="badge" :class="getBadgeClass(workorder?.status)" style="font-size: 14px; padding: 4px 12px;">
          {{ workorder?.status_name }}
        </span>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <div class="card" v-if="workorder">
      <div class="flex-between mb-4">
        <div>
          <h2 style="font-size: 20px; font-weight: 600;">{{ workorder.title }}</h2>
          <div class="text-sm text-muted mt-1">
            工单编号：<span style="font-weight: 500; color: #2563eb;">{{ workorder.code }}</span>
            · 版本：v{{ workorder.version }}
          </div>
        </div>
        <div class="text-sm text-muted">
          创建时间：{{ formatDate(workorder.created_at) }}
        </div>
      </div>

      <div class="progress-steps">
        <div class="step" :class="{ completed: workorder.production_schedule, active: !workorder.production_schedule && workorder.status === 'pending_correction' }">
          生产排程
        </div>
        <div class="step" :class="{
          completed: workorder.material_issue,
          active: workorder.production_schedule && !workorder.material_issue && workorder.status === 'pending_correction'
        }">
          领料确认
        </div>
        <div class="step" :class="{
          completed: workorder.completion_report,
          active: workorder.material_issue && !workorder.completion_report && workorder.status === 'pending_correction'
        }">
          完工报工
        </div>
        <div class="step" :class="{
          active: workorder.status === 'under_review',
          completed: workorder.status === 'completed'
        }">
          复核办结
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <div>
          <div class="card" style="background: #f9fafb; margin-bottom: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">基本信息</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;" class="text-sm">
              <div>
                <span class="text-muted">产品名称：</span>
                <span>{{ workorder.product_name }}</span>
              </div>
              <div>
                <span class="text-muted">数量：</span>
                <span>{{ workorder.quantity }} {{ workorder.unit }}</span>
              </div>
              <div>
                <span class="text-muted">截止日期：</span>
                <span :class="{ 'text-danger': workorder.warning_level === 'overdue' }">
                  {{ formatDate(workorder.deadline) }}
                </span>
              </div>
              <div>
                <span class="text-muted">预警级别：</span>
                <span class="badge" :class="getWarningClass(workorder.warning_level)">
                  {{ getWarningLabel(workorder.warning_level) }}
                </span>
              </div>
              <div>
                <span class="text-muted">生产计划员：</span>
                <span>{{ workorder.planner }}</span>
              </div>
              <div>
                <span class="text-muted">车间主任：</span>
                <span>{{ workorder.workshop_director }}</span>
              </div>
            </div>
          </div>

          <div class="card" style="background: #f9fafb; margin-bottom: 16px;">
            <div class="flex-between" style="margin-bottom: 12px;">
              <h3 style="font-size: 15px; font-weight: 600;">生产排程</h3>
              <button
                v-if="canEditSchedule"
                class="btn btn-primary btn-sm"
                @click="showScheduleModal = true"
              >
                {{ workorder.production_schedule ? '修改' : '排程' }}
              </button>
            </div>
            <div v-if="workorder.production_schedule" class="text-sm">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><span class="text-muted">开始日期：</span>{{ workorder.production_schedule.start_date }}</div>
                <div><span class="text-muted">结束日期：</span>{{ workorder.production_schedule.end_date }}</div>
                <div><span class="text-muted">车间：</span>{{ workorder.production_schedule.workshop }}</div>
                <div><span class="text-muted">生产线：</span>{{ workorder.production_schedule.line }}</div>
                <div><span class="text-muted">班次：</span>{{ workorder.production_schedule.shift }}</div>
                <div><span class="text-muted">排程人：</span>{{ workorder.production_schedule.scheduled_by }}</div>
              </div>
              <div v-if="workorder.production_schedule.remark" class="mt-2">
                <span class="text-muted">备注：</span>{{ workorder.production_schedule.remark }}
              </div>
            </div>
            <div v-else class="text-sm text-muted">
              尚未安排生产排程
            </div>
          </div>

          <div class="card" style="background: #f9fafb; margin-bottom: 16px;">
            <div class="flex-between" style="margin-bottom: 12px;">
              <h3 style="font-size: 15px; font-weight: 600;">领料确认</h3>
              <button
                v-if="canEditMaterial"
                class="btn btn-primary btn-sm"
                @click="showMaterialModal = true"
              >
                {{ workorder.material_issue ? '修改' : '领料' }}
              </button>
            </div>
            <div v-if="workorder.material_issue" class="text-sm">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><span class="text-muted">领料日期：</span>{{ workorder.material_issue.issue_date }}</div>
                <div><span class="text-muted">仓库：</span>{{ workorder.material_issue.warehouse }}</div>
                <div><span class="text-muted">发料人：</span>{{ workorder.material_issue.issued_by }}</div>
                <div><span class="text-muted">收料人：</span>{{ workorder.material_issue.received_by }}</div>
              </div>
              <div v-if="workorder.material_issue.materials?.length > 0" class="mt-2">
                <div class="text-muted">物料清单：</div>
                <ul style="padding-left: 20px; margin-top: 4px;">
                  <li v-for="(m, idx) in workorder.material_issue.materials" :key="idx">
                    {{ m.name }} - {{ m.quantity }} {{ m.unit }}
                  </li>
                </ul>
              </div>
              <div v-if="workorder.material_issue.remark" class="mt-2">
                <span class="text-muted">备注：</span>{{ workorder.material_issue.remark }}
              </div>
            </div>
            <div v-else class="text-sm text-muted">
              尚未办理领料确认
            </div>
          </div>

          <div class="card" style="background: #f9fafb;">
            <div class="flex-between" style="margin-bottom: 12px;">
              <h3 style="font-size: 15px; font-weight: 600;">完工报工</h3>
              <button
                v-if="canEditCompletion"
                class="btn btn-primary btn-sm"
                @click="showCompletionModal = true"
              >
                {{ workorder.completion_report ? '修改' : '报工' }}
              </button>
            </div>
            <div v-if="workorder.completion_report" class="text-sm">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><span class="text-muted">完工日期：</span>{{ workorder.completion_report.completion_date }}</div>
                <div><span class="text-muted">实际产量：</span>{{ workorder.completion_report.actual_quantity }}</div>
                <div><span class="text-muted">合格数量：</span><span class="text-success">{{ workorder.completion_report.qualified_quantity }}</span></div>
                <div><span class="text-muted">不合格数量：</span><span class="text-danger">{{ workorder.completion_report.defective_quantity }}</span></div>
                <div><span class="text-muted">检验员：</span>{{ workorder.completion_report.inspector }}</div>
                <div><span class="text-muted">报工人：</span>{{ workorder.completion_report.report_by }}</div>
              </div>
              <div v-if="workorder.completion_report.remark" class="mt-2">
                <span class="text-muted">备注：</span>{{ workorder.completion_report.remark }}
              </div>
            </div>
            <div v-else class="text-sm text-muted">
              尚未提交完工报工
            </div>
          </div>
        </div>

        <div>
          <div class="card" style="background: #f9fafb; margin-bottom: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">操作</h3>

            <div v-if="workorder.status === 'pending_correction' && currentRole === 'planner' && workorder.planner === currentUserName">
              <button
                class="btn btn-primary"
                style="width: 100%; margin-bottom: 8px;"
                @click="submitForReview"
                :disabled="!canSubmit"
              >
                提交复核
              </button>
              <p class="text-sm text-muted" v-if="!canSubmit">
                请先完成生产排程、领料确认、完工报工
              </p>
            </div>

            <div v-if="workorder.status === 'under_review' && currentRole === 'workshop_director' && workorder.workshop_director === currentUserName">
              <button
                class="btn btn-success"
                style="width: 100%; margin-bottom: 8px;"
                @click="showReviewModal = true"
              >
                复核通过
              </button>
              <button
                class="btn btn-danger"
                style="width: 100%;"
                @click="showRejectModal = true"
              >
                退回补正
              </button>
            </div>

            <div v-if="workorder.status === 'under_review' && currentRole === 'factory_manager' && workorder.factory_manager === currentUserName">
              <button
                class="btn btn-success"
                style="width: 100%;"
                @click="showConfirmModal = true"
              >
                确认办结
              </button>
            </div>

            <div v-if="workorder.status === 'completed'" class="text-sm text-muted text-center" style="padding: 20px 0;">
              该工单已办结
            </div>
          </div>

          <div class="card" style="background: #f9fafb;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">当前处理信息</h3>
            <div class="text-sm">
              <div class="mb-2">
                <span class="text-muted">当前状态：</span>
                <span class="badge" :class="getBadgeClass(workorder.status)">{{ workorder.status_name }}</span>
              </div>
              <div class="mb-2">
                <span class="text-muted">当前处理人：</span>
                <span>{{ workorder.current_handler || '无' }}</span>
              </div>
              <div class="mb-2">
                <span class="text-muted">处理角色：</span>
                <span>{{ workorder.current_handler_role_name || '无' }}</span>
              </div>
              <div>
                <span class="text-muted">当前节点：</span>
                <span>{{ workorder.current_node }}</span>
              </div>
            </div>
          </div>

          <div v-if="exceptions.length > 0" class="card" style="background: #fef2f2; margin-top: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #991b1b;">异常记录</h3>
            <div v-for="exc in exceptions" :key="exc.id" class="text-sm" style="padding: 8px 0; border-bottom: 1px solid #fecaca;">
              <div style="font-weight: 500;">{{ exc.reason }}</div>
              <div class="text-muted mt-1">
                节点：{{ exc.node }} · 责任人：{{ exc.responsible_person }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 16px;">处理记录</h3>
      <div class="timeline">
        <div v-for="record in records" :key="record.id" class="timeline-item">
          <div class="flex-between">
            <span style="font-weight: 500;">{{ record.action }}</span>
            <span class="text-sm text-muted">{{ formatDate(record.created_at) }}</span>
          </div>
          <div class="text-sm text-muted mt-1">
            {{ record.operator_role_name }} - {{ record.operator }}
          </div>
          <div v-if="record.remark" class="text-sm mt-1" style="color: #374151;">
            备注：{{ record.remark }}
          </div>
          <div v-if="record.evidence?.reject_reason" class="text-sm mt-1 text-danger">
            退回原因：{{ record.evidence.reject_reason }}
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 16px;">审计备注</h3>
      <div class="mb-4">
        <textarea v-model="newNote" class="form-textarea" placeholder="添加备注..." style="margin-bottom: 8px;"></textarea>
        <button class="btn btn-outline btn-sm" @click="addNote">添加备注</button>
      </div>
      <div v-for="note in auditNotes" :key="note.id" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
        <div class="flex-between">
          <span style="font-weight: 500;">{{ note.author }} ({{ note.author_role_name }})</span>
          <span class="text-sm text-muted">{{ formatDate(note.created_at) }}</span>
        </div>
        <div class="text-sm mt-1">{{ note.content }}</div>
      </div>
      <div v-if="auditNotes.length === 0" class="text-sm text-muted text-center" style="padding: 20px 0;">
        暂无备注
      </div>
    </div>

    <div v-if="showScheduleModal" class="modal-overlay" @click.self="showScheduleModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>生产排程</h3>
          <button class="btn btn-outline btn-sm" @click="showScheduleModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">开始日期</label>
            <input v-model="scheduleForm.start_date" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">结束日期</label>
            <input v-model="scheduleForm.end_date" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">车间</label>
            <select v-model="scheduleForm.workshop" class="form-select">
              <option value="第一车间">第一车间</option>
              <option value="第二车间">第二车间</option>
              <option value="第三车间">第三车间</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">生产线</label>
            <select v-model="scheduleForm.line" class="form-select">
              <option value="1号线">1号线</option>
              <option value="2号线">2号线</option>
              <option value="3号线">3号线</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">班次</label>
            <select v-model="scheduleForm.shift" class="form-select">
              <option value="白班">白班</option>
              <option value="夜班">夜班</option>
              <option value="两班倒">两班倒</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea v-model="scheduleForm.remark" class="form-textarea" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showScheduleModal = false">取消</button>
          <button class="btn btn-primary" @click="saveSchedule" :disabled="submitting">
            {{ submitting ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showMaterialModal" class="modal-overlay" @click.self="showMaterialModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>领料确认</h3>
          <button class="btn btn-outline btn-sm" @click="showMaterialModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">领料日期</label>
            <input v-model="materialForm.issue_date" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">仓库</label>
            <select v-model="materialForm.warehouse" class="form-select">
              <option value="原材料库A区">原材料库A区</option>
              <option value="原材料库B区">原材料库B区</option>
              <option value="半成品库">半成品库</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">发料人</label>
            <input v-model="materialForm.issued_by" type="text" class="form-input" placeholder="请输入发料人" />
          </div>
          <div class="form-group">
            <label class="form-label">物料清单</label>
            <div v-for="(m, idx) in materialForm.materials" :key="idx" class="flex gap-2 mb-2">
              <input v-model="m.name" type="text" class="form-input" placeholder="物料名称" style="flex: 2;" />
              <input v-model.number="m.quantity" type="number" class="form-input" placeholder="数量" style="flex: 1;" />
              <input v-model="m.unit" type="text" class="form-input" placeholder="单位" style="flex: 1;" />
              <button class="btn btn-danger btn-sm" @click="materialForm.materials.splice(idx, 1)">×</button>
            </div>
            <button class="btn btn-outline btn-sm mt-2" @click="addMaterial">+ 添加物料</button>
          </div>
          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea v-model="materialForm.remark" class="form-textarea" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showMaterialModal = false">取消</button>
          <button class="btn btn-primary" @click="saveMaterial" :disabled="submitting">
            {{ submitting ? '保存中...' : '确认领料' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCompletionModal" class="modal-overlay" @click.self="showCompletionModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>完工报工</h3>
          <button class="btn btn-outline btn-sm" @click="showCompletionModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">完工日期</label>
            <input v-model="completionForm.completion_date" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">实际产量</label>
            <input v-model.number="completionForm.actual_quantity" type="number" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">合格数量</label>
            <input v-model.number="completionForm.qualified_quantity" type="number" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">不合格数量</label>
            <input v-model.number="completionForm.defective_quantity" type="number" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">检验员</label>
            <input v-model="completionForm.inspector" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea v-model="completionForm.remark" class="form-textarea" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showCompletionModal = false">取消</button>
          <button class="btn btn-primary" @click="saveCompletion" :disabled="submitting">
            {{ submitting ? '保存中...' : '提交报工' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showReviewModal" class="modal-overlay" @click.self="showReviewModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>复核通过</h3>
          <button class="btn btn-outline btn-sm" @click="showReviewModal = false">×</button>
        </div>
        <div class="modal-body">
          <p>确认复核通过该工单？</p>
          <div class="form-group mt-4">
            <label class="form-label">备注</label>
            <textarea v-model="reviewRemark" class="form-textarea" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showReviewModal = false">取消</button>
          <button class="btn btn-success" @click="approveReview" :disabled="submitting">
            {{ submitting ? '处理中...' : '确认通过' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showRejectModal" class="modal-overlay" @click.self="showRejectModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>退回补正</h3>
          <button class="btn btn-outline btn-sm" @click="showRejectModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">退回原因</label>
            <textarea v-model="rejectReason" class="form-textarea" placeholder="请填写退回原因"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showRejectModal = false">取消</button>
          <button class="btn btn-danger" @click="rejectReview" :disabled="submitting">
            {{ submitting ? '处理中...' : '确认退回' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showConfirmModal" class="modal-overlay" @click.self="showConfirmModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>确认办结</h3>
          <button class="btn btn-outline btn-sm" @click="showConfirmModal = false">×</button>
        </div>
        <div class="modal-body">
          <p>确认该工单办结？</p>
          <div class="form-group mt-4">
            <label class="form-label">备注</label>
            <textarea v-model="confirmRemark" class="form-textarea" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showConfirmModal = false">取消</button>
          <button class="btn btn-success" @click="confirmComplete" :disabled="submitting">
            {{ submitting ? '确认中...' : '确认办结' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useAuth } from '~/composables/useAuth'

const { get, post } = useApi()
const { currentRole, currentUserName } = useAuth()
const route = useRoute()
const router = useRouter()

const workorder = ref<any>(null)
const records = ref<any[]>([])
const auditNotes = ref<any[]>([])
const exceptions = ref<any[]>([])
const error = ref('')
const successMsg = ref('')
const submitting = ref(false)
const newNote = ref('')

const showScheduleModal = ref(false)
const showMaterialModal = ref(false)
const showCompletionModal = ref(false)
const showReviewModal = ref(false)
const showRejectModal = ref(false)
const showConfirmModal = ref(false)

const reviewRemark = ref('')
const rejectReason = ref('')
const confirmRemark = ref('')

const scheduleForm = ref({
  start_date: '',
  end_date: '',
  workshop: '第一车间',
  line: '1号线',
  shift: '白班',
  remark: ''
})

const materialForm = ref({
  issue_date: '',
  warehouse: '原材料库A区',
  issued_by: '',
  materials: [
    { name: '', quantity: 0, unit: '' }
  ],
  remark: ''
})

const completionForm = ref({
  completion_date: '',
  actual_quantity: 0,
  qualified_quantity: 0,
  defective_quantity: 0,
  inspector: '',
  remark: ''
})

const canEditSchedule = computed(() => {
  if (!workorder.value) return false
  if (currentRole.value !== 'planner') return false
  if (workorder.value.planner !== currentUserName.value) return false
  return workorder.value.status === 'pending_correction'
})

const canEditMaterial = computed(() => {
  if (!workorder.value) return false
  if (!workorder.value.production_schedule) return false
  if (workorder.value.status !== 'pending_correction') return false
  return true
})

const canEditCompletion = computed(() => {
  if (!workorder.value) return false
  if (!workorder.value.material_issue) return false
  if (workorder.value.status !== 'pending_correction') return false
  return true
})

const canSubmit = computed(() => {
  if (!workorder.value) return false
  return workorder.value.production_schedule
    && workorder.value.material_issue
    && workorder.value.completion_report
})

function getBadgeClass(status: string) {
  return {
    'badge-pending': status === 'pending_correction',
    'badge-review': status === 'under_review',
    'badge-completed': status === 'completed'
  }
}

function getWarningClass(level: string) {
  return {
    'badge-normal': level === 'normal',
    'badge-warning': level === 'warning',
    'badge-overdue': level === 'overdue'
  }
}

function getWarningLabel(level: string) {
  const labels: Record<string, string> = {
    normal: '正常',
    warning: '临期',
    overdue: '逾期'
  }
  return labels[level] || level
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').substring(0, 16)
}

function goBack() {
  router.back()
}

function addMaterial() {
  materialForm.value.materials.push({ name: '', quantity: 0, unit: '' })
}

async function loadDetail() {
  const id = route.params.id as string
  error.value = ''

  const res = await get<any>(`/workorders/${id}`)
  if (res.success && res.data) {
    workorder.value = res.data.workorder
    records.value = res.data.records || []
    auditNotes.value = res.data.auditNotes || []
    exceptions.value = res.data.exceptions || []

    if (workorder.value.production_schedule) {
      scheduleForm.value = {
        ...workorder.value.production_schedule
      }
    }
    if (workorder.value.material_issue) {
      materialForm.value = {
        ...workorder.value.material_issue,
        materials: workorder.value.material_issue.materials || [{ name: '', quantity: 0, unit: '' }]
      }
    }
    if (workorder.value.completion_report) {
      completionForm.value = {
        ...workorder.value.completion_report
      }
    }
  } else {
    error.value = res.error || '加载失败'
  }
}

async function saveSchedule() {
  if (!scheduleForm.value.start_date || !scheduleForm.value.end_date) {
    error.value = '请填写开始和结束日期'
    return
  }

  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/schedule`, {
    version: workorder.value.version,
    schedule_data: scheduleForm.value
  })

  if (res.success && res.data) {
    successMsg.value = '生产排程保存成功'
    showScheduleModal.value = false
    loadDetail()
    setTimeout(() => successMsg.value = '', 3000)
  } else {
    error.value = res.error || '保存失败'
  }

  submitting.value = false
}

async function saveMaterial() {
  if (!materialForm.value.issue_date || !materialForm.value.issued_by) {
    error.value = '请填写领料日期和发料人'
    return
  }

  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/material`, {
    version: workorder.value.version,
    material_data: materialForm.value
  })

  if (res.success && res.data) {
    successMsg.value = '领料确认保存成功'
    showMaterialModal.value = false
    loadDetail()
    setTimeout(() => successMsg.value = '', 3000)
  } else {
    error.value = res.error || '保存失败'
  }

  submitting.value = false
}

async function saveCompletion() {
  if (!completionForm.value.completion_date || !completionForm.value.inspector) {
    error.value = '请填写完工日期和检验员'
    return
  }

  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/completion`, {
    version: workorder.value.version,
    completion_data: completionForm.value
  })

  if (res.success && res.data) {
    successMsg.value = '完工报工保存成功'
    showCompletionModal.value = false
    loadDetail()
    setTimeout(() => successMsg.value = '', 3000)
  } else {
    error.value = res.error || '保存失败'
  }

  submitting.value = false
}

async function submitForReview() {
  if (!canSubmit.value) return

  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/submit`, {
    version: workorder.value.version
  })

  if (res.success && res.data) {
    successMsg.value = '已提交复核'
    loadDetail()
    setTimeout(() => successMsg.value = '', 3000)
  } else {
    error.value = res.error || '提交失败'
  }

  submitting.value = false
}

async function approveReview() {
  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/review/approve`, {
    version: workorder.value.version,
    remark: reviewRemark.value
  })

  if (res.success && res.data) {
    successMsg.value = '复核通过'
    showReviewModal.value = false
    loadDetail()
    setTimeout(() => successMsg.value = '', 3000)
  } else {
    error.value = res.error || '操作失败'
  }

  submitting.value = false
}

async function rejectReview() {
  if (!rejectReason.value.trim()) {
    error.value = '请填写退回原因'
    return
  }

  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/review/reject`, {
    version: workorder.value.version,
    reject_reason: rejectReason.value
  })

  if (res.success && res.data) {
    successMsg.value = '已退回补正'
    showRejectModal.value = false
    loadDetail()
    setTimeout(() => successMsg.value = '', 3000)
  } else {
    error.value = res.error || '操作失败'
  }

  submitting.value = false
}

async function confirmComplete() {
  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/confirm`, {
    version: workorder.value.version,
    remark: confirmRemark.value
  })

  if (res.success && res.data) {
    successMsg.value = '已确认办结'
    showConfirmModal.value = false
    loadDetail()
    setTimeout(() => successMsg.value = '', 3000)
  } else {
    error.value = res.error || '操作失败'
  }

  submitting.value = false
}

async function addNote() {
  if (!newNote.value.trim()) return

  const res = await post(`/workorders/${workorder.value.id}/notes`, {
    content: newNote.value
  })

  if (res.success) {
    newNote.value = ''
    loadDetail()
  } else {
    error.value = res.error || '添加失败'
  }
}

onMounted(() => {
  loadDetail()
})
</script>
