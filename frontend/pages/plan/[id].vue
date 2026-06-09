<template>
  <div>
    <div class="flex justify-between items-center mb-16">
      <div class="flex gap-8">
        <button class="btn" @click="goBack">← 返回列表</button>
        <button class="btn btn-info" @click="loadDetail">🔄 刷新队列</button>
      </div>
      <div class="flex gap-8" v-if="plan">
        <span v-if="isReadOnly" class="tag tag-info">👁️ 只读模式</span>
        <span v-else class="tag tag-progress">📝 可办理模式</span>
        <span v-if="plan.status === '待派发'" class="tag tag-pending">待派发</span>
        <span v-else-if="plan.status === '处理中'" class="tag tag-progress">处理中</span>
        <span v-else class="tag tag-closed">已关闭</span>
        <span v-if="plan.warning_level === '正常'" class="tag tag-normal">🟢 正常</span>
        <span v-else-if="plan.warning_level === '临期'" class="tag tag-approaching">🟡 临期</span>
        <span v-else-if="plan.warning_level === '逾期'" class="tag tag-overdue">🔴 逾期</span>
      </div>
    </div>

    <div v-if="plan" class="card">
      <h3 class="section-title">📋 护理计划单基本信息</h3>
      <div class="form-row">
        <div class="form-item"><label>计划单号</label><input :value="plan.plan_no" disabled /></div>
        <div class="form-item"><label>老人姓名</label><input :value="plan.elder_name" disabled /></div>
        <div class="form-item"><label>身份证号</label><input :value="plan.elder_id_card" disabled /></div>
        <div class="form-item"><label>房间号</label><input :value="plan.room_no" disabled /></div>
      </div>
      <div class="form-row">
        <div class="form-item"><label>入住日期</label><input :value="plan.admission_date" disabled /></div>
        <div class="form-item"><label>截止日期</label><input :value="plan.deadline" disabled /></div>
        <div class="form-item"><label>当前处理人</label><input :value="plan.current_handler" disabled /></div>
        <div class="form-item"><label>责任人</label><input :value="plan.responsible_person" disabled /></div>
      </div>
      <div class="form-row">
        <div class="form-item"><label>版本号</label><input :value="plan.version" disabled /></div>
        <div class="form-item"><label>创建时间</label><input :value="plan.created_at" disabled /></div>
        <div class="form-item"><label>更新时间</label><input :value="plan.updated_at" disabled /></div>
      </div>
    </div>

    <div v-if="plan" class="card">
      <h3 class="section-title">📝 办理操作</h3>
      <div v-if="isReadOnly" style="background:#ecf5ff;border:1px solid #b3d8ff;border-radius:4px;padding:12px;margin-bottom:16px;">
        <div style="color:#409eff;font-weight:bold;">👁️ 当前为只读浏览模式</div>
        <div style="font-size:12px;color:#606266;margin-top:4px;">
          {{ readonlyReason }}
        </div>
      </div>
      <template v-else>
        <div class="form-row">
          <div class="form-item" style="flex: 1;">
            <label>处理意见 / 备注</label>
            <textarea v-model="remark" placeholder="请输入处理意见或备注..."></textarea>
          </div>
        </div>
        <div class="flex gap-8 justify-end">
          <button
            v-if="auth.currentRole === 'registrar' && plan.status === '待派发'"
            class="btn btn-primary"
            @click="doDispatch"
          >📤 派发至审核主管</button>

          <button
            v-if="auth.currentRole === 'registrar' && plan.status === '处理中'"
            class="btn btn-info"
            @click="doUpdate"
          >💾 保存补正信息</button>

          <button
            v-if="auth.currentRole === 'supervisor' && plan.status === '处理中'"
            class="btn btn-info"
            @click="doUpdate"
          >💾 保存办理信息</button>
          <button
            v-if="auth.currentRole === 'supervisor' && plan.status === '处理中'"
            class="btn btn-warning"
            @click="showReturn = true"
          >↩️ 退回登记员补正</button>
          <button
            v-if="auth.currentRole === 'supervisor' && plan.status === '处理中'"
            class="btn btn-primary"
            @click="doSubmit"
          >📤 提交院区主任复核</button>

          <button
            v-if="auth.currentRole === 'director' && plan.status === '处理中'"
            class="btn btn-warning"
            @click="showReturn = true"
          >↩️ 退回主管补正</button>
          <button
            v-if="auth.currentRole === 'director' && plan.status === '处理中'"
            class="btn btn-success"
            @click="doReview"
          >✅ 复核通过并归档</button>
        </div>
      </template>
    </div>

    <div v-if="plan" class="card">
      <h3 class="section-title">🧩 三大主流程模块</h3>
      <div class="tabs">
        <div class="tab" :class="{ active: moduleTab === 'assessment' }" @click="moduleTab = 'assessment'">
          1. 入住评估
          <span :style="plan.assessment_done ? 'color:#67c23a;' : 'color:#f56c6c;'">
            {{ plan.assessment_done ? '✓' : '✗' }}
          </span>
        </div>
        <div class="tab" :class="{ active: moduleTab === 'plan' }" @click="moduleTab = 'plan'">
          2. 护理计划
          <span :style="plan.plan_done ? 'color:#67c23a;' : 'color:#f56c6c;'">
            {{ plan.plan_done ? '✓' : '✗' }}
          </span>
        </div>
        <div class="tab" :class="{ active: moduleTab === 'family' }" @click="moduleTab = 'family'">
          3. 家属确认
          <span :style="plan.family_confirmed ? 'color:#67c23a;' : 'color:#f56c6c;'">
            {{ plan.family_confirmed ? '✓' : '✗' }}
          </span>
        </div>
      </div>

      <div v-if="moduleTab === 'assessment'">
        <div class="form-row">
          <div class="form-item">
            <label>入住评估已完成</label>
            <select v-model="form.assessment_done" :disabled="!canEdit">
              <option :value="false">未完成</option>
              <option :value="true">已完成</option>
            </select>
          </div>
          <div class="form-item" style="flex:0 0 auto;">
            <label>&nbsp;</label>
            <button class="btn btn-sm" :disabled="!canEdit" @click="quickUpload('入住评估表')">📎 上传入住评估表</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>评估说明</label>
            <textarea v-model="form.assessment_note" placeholder="ADL评分、护理等级等" :disabled="!canEdit"></textarea>
          </div>
        </div>
      </div>

      <div v-if="moduleTab === 'plan'">
        <div class="form-row">
          <div class="form-item">
            <label>护理计划已制定</label>
            <select v-model="form.plan_done" :disabled="!canEdit">
              <option :value="false">未制定</option>
              <option :value="true">已制定</option>
            </select>
          </div>
          <div class="form-item" style="flex:0 0 auto;">
            <label>&nbsp;</label>
            <button class="btn btn-sm" :disabled="!canEdit" @click="quickUpload('护理方案')">📎 上传护理方案</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>护理计划说明</label>
            <textarea v-model="form.plan_note" placeholder="日常护理、医疗护理、康复计划等" :disabled="!canEdit"></textarea>
          </div>
        </div>
      </div>

      <div v-if="moduleTab === 'family'">
        <div class="form-row">
          <div class="form-item">
            <label>家属已签字确认</label>
            <select v-model="form.family_confirmed" :disabled="!canEdit">
              <option :value="false">未确认</option>
              <option :value="true">已确认</option>
            </select>
          </div>
          <div class="form-item" style="flex:0 0 auto;">
            <label>&nbsp;</label>
            <button class="btn btn-sm btn-success" :disabled="!canEdit" @click="quickUploadFamilySignature">✍️ 上传家属签字确认单</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>家属确认说明</label>
            <textarea v-model="form.family_note" placeholder="家属签字情况、联系方式等" :disabled="!canEdit"></textarea>
          </div>
        </div>
        <p style="color:#e6a23c;font-size:12px;">
          ⚠️ 勾选"已确认"需确保已上传家属签字确认单附件。当前已有
          <strong>{{ familySignatureCount }}</strong> 份家属签字附件。
        </p>
      </div>
    </div>

    <div class="card" v-if="plan">
      <div class="flex justify-between items-center mb-16">
        <h3 class="section-title" style="margin:0;border:none;padding:0;">📎 附件清单（共 {{ attachments.length }} 份）</h3>
      </div>

      <div class="card" style="background:#fafafa; border:1px dashed #dcdfe6;">
        <h4 style="margin:0 0 12px 0;font-size:13px;color:#606266;">📤 上传新附件</h4>
        <div class="form-row">
          <div class="form-item">
            <label>文件名 *</label>
            <input v-model="uploadForm.file_name" placeholder="如：家属签字确认单-XXX.pdf" :disabled="!canUpload" />
          </div>
          <div class="form-item">
            <label>附件类型 *</label>
            <select v-model="uploadForm.file_type" :disabled="!canUpload">
              <option value="">请选择类型</option>
              <option value="assessment">入住评估表</option>
              <option value="care_plan">护理方案</option>
              <option value="family_signature">家属签字确认单</option>
              <option value="medical">医疗记录</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="form-item" style="flex:0 0 auto;">
            <label>&nbsp;</label>
            <button class="btn btn-primary" :disabled="!canUpload || !uploadForm.file_name || !uploadForm.file_type" @click="doUploadAttachment">
              📤 上传附件
            </button>
          </div>
        </div>
        <div style="font-size:12px;color:#909399;">
          快捷上传：
          <button class="btn btn-sm" style="margin:0 4px;" :disabled="!canUpload" @click="quickUpload('入住评估表')">入住评估表</button>
          <button class="btn btn-sm" style="margin:0 4px;" :disabled="!canUpload" @click="quickUpload('护理方案')">护理方案</button>
          <button class="btn btn-sm btn-success" style="margin:0 4px;" :disabled="!canUpload" @click="quickUploadFamilySignature">家属签字确认单</button>
        </div>
      </div>

      <table v-if="attachments.length > 0" class="mt-16">
        <thead>
          <tr><th>文件名</th><th>类型</th><th>上传人</th><th>上传时间</th><th>证据状态</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in attachments" :key="a.id">
            <td>📎 {{ a.file_name }}</td>
            <td>
              <span v-if="a.file_type === 'family_signature'" class="tag tag-closed">家属签字</span>
              <span v-else-if="a.file_type === 'assessment'" class="tag tag-normal">评估表</span>
              <span v-else-if="a.file_type === 'care_plan'" class="tag tag-progress">护理方案</span>
              <span v-else-if="a.file_type === 'medical'" class="tag tag-info">医疗记录</span>
              <span v-else class="tag">{{ a.file_type }}</span>
            </td>
            <td>{{ a.uploaded_by }}</td>
            <td style="font-size:12px;">{{ a.uploaded_at }}</td>
            <td>
              <span v-if="a.file_type === 'family_signature'" class="tag tag-closed">✓ 关键证据</span>
              <span v-else class="tag tag-normal">辅助材料</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else style="color:#909399;margin-top:8px;">暂无附件，建议先上传家属签字确认单。</p>
    </div>

    <div class="card" v-if="plan">
      <div class="tabs">
        <div class="tab" :class="{ active: recordTab === 'records' }" @click="recordTab = 'records'">🔄 处理记录</div>
        <div class="tab" :class="{ active: recordTab === 'audit' }" @click="recordTab = 'audit'">📜 审计轨迹</div>
        <div class="tab" :class="{ active: recordTab === 'exceptions' }" @click="recordTab = 'exceptions'">
          ⚠️ 异常原因
          <span v-if="unresolvedExceptions > 0" class="tag tag-overdue" style="margin-left:4px;">
            {{ unresolvedExceptions }}
          </span>
        </div>
      </div>

      <div v-if="recordTab === 'records'" class="timeline">
        <div v-for="r in records" :key="r.id" class="timeline-item">
          <div class="time">{{ r.created_at }}</div>
          <div class="action">{{ r.action }}</div>
          <div class="meta">{{ r.operator }}（{{ r.operator_role }}） · {{ r.prev_status }} → {{ r.new_status }}</div>
          <div v-if="r.remark" class="remark">💬 {{ r.remark }}</div>
        </div>
        <p v-if="records.length === 0" style="color:#909399;">暂无处理记录</p>
      </div>

      <div v-if="recordTab === 'audit'">
        <table v-if="auditNotes.length > 0">
          <thead>
            <tr>
              <th>时间</th><th>操作人</th><th>角色</th><th>操作</th>
              <th>状态变化</th><th>结果</th><th>失败原因</th><th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in auditNotes" :key="a.id" :style="!a.success ? 'background:#fef0f0;' : ''">
              <td style="font-size:12px;">{{ a.created_at }}</td>
              <td>{{ a.operator }}</td>
              <td style="font-size:12px;">{{ a.operator_role }}</td>
              <td>{{ a.action }}</td>
              <td style="font-size:12px;">{{ a.prev_status }} → {{ a.new_status }}</td>
              <td>
                <span v-if="a.success" class="tag tag-closed">成功</span>
                <span v-else class="tag tag-overdue">失败</span>
              </td>
              <td style="color:#f56c6c;font-size:12px;">{{ a.failure_reason || '-' }}</td>
              <td style="font-size:12px;">{{ a.remark || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else style="color:#909399;">暂无审计记录</p>
      </div>

      <div v-if="recordTab === 'exceptions'">
        <table v-if="exceptions.length > 0">
          <thead>
            <tr><th>时间</th><th>类型</th><th>描述</th><th>操作人</th><th>状态</th><th>解决时间</th></tr>
          </thead>
          <tbody>
            <tr v-for="e in exceptions" :key="e.id" :style="!e.resolved ? 'background:#fdf6ec;' : ''">
              <td style="font-size:12px;">{{ e.created_at }}</td>
              <td><span class="tag tag-overdue">{{ e.exception_type }}</span></td>
              <td>{{ e.description }}</td>
              <td>{{ e.operator }}</td>
              <td>
                <span v-if="e.resolved" class="tag tag-closed">已解决</span>
                <span v-else class="tag tag-approaching">未解决</span>
              </td>
              <td style="font-size:12px;">{{ e.resolved_at || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else style="color:#909399;">暂无异常记录</p>
      </div>
    </div>

    <div v-if="showReturn" class="modal-mask" @click.self="showReturn = false">
      <div class="modal">
        <div class="modal-title">退回补正</div>
        <div class="form-row">
          <div class="form-item">
            <label>退回原因 *</label>
            <textarea v-model="returnRemark" placeholder="请详细说明需要补正的内容..."></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-8 mt-16">
          <button class="btn" @click="showReturn = false">取消</button>
          <button class="btn btn-warning" @click="doReturn">确认退回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { api } from '~/composables/api'
import type {
  CarePlan, Attachment, ProcessingRecord, AuditNote, ExceptionReason, UpdatePlanRequest,
} from '~/types'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const plan = ref<CarePlan | null>(null)
const attachments = ref<Attachment[]>([])
const records = ref<ProcessingRecord[]>([])
const auditNotes = ref<AuditNote[]>([])
const exceptions = ref<ExceptionReason[]>([])
const moduleTab = ref('family')
const recordTab = ref('records')
const remark = ref('')
const showReturn = ref(false)
const returnRemark = ref('')

const uploadForm = reactive({
  file_name: '',
  file_type: '',
})

const form = reactive({
  assessment_done: false,
  assessment_note: '' as string | null,
  plan_done: false,
  plan_note: '' as string | null,
  family_confirmed: false,
  family_note: '' as string | null,
})

const canHandle = computed(() => {
  if (!plan.value) return false
  if (plan.value.status === '已关闭') return false
  if (auth.currentRole === 'registrar') {
    if (!['待派发', '处理中'].includes(plan.value.status)) return false
  }
  if (auth.currentRole === 'supervisor') {
    if (plan.value.status !== '处理中') return false
  }
  if (auth.currentRole === 'director') {
    if (plan.value.status !== '处理中') return false
  }
  if (plan.value.current_handler !== auth.displayName) return false
  return true
})

const isReadOnly = computed(() => !canHandle.value)

const readonlyReason = computed(() => {
  if (!plan.value) return ''
  if (plan.value.status === '已关闭') return '该护理计划单已归档关闭，仅支持历史数据浏览。'
  if (plan.value.current_handler !== auth.displayName) return `当前处理人为「${plan.value.current_handler}」，非本人单据仅支持只读浏览。`
  if (auth.currentRole === 'registrar' && !['待派发', '处理中'].includes(plan.value.status)) return `登记员仅可操作「待派发/处理中」状态单据，当前为「${plan.value.status}」。`
  if ((auth.currentRole === 'supervisor' || auth.currentRole === 'director') && plan.value.status !== '处理中') return `${auth.roleLabel}仅可操作「处理中」状态单据，当前为「${plan.value.status}」。`
  return '当前状态仅支持只读浏览。'
})

const canEdit = computed(() => {
  if (!canHandle.value) return false
  if (auth.currentRole === 'director') return false
  return true
})

const canUpload = computed(() => {
  if (!plan.value) return false
  if (plan.value.status === '已关闭') return false
  if (plan.value.current_handler !== auth.displayName && auth.currentRole !== 'director') return false
  return true
})

const familySignatureCount = computed(() =>
  attachments.value.filter(a => a.file_type === 'family_signature' || a.file_name.includes('家属') || a.file_name.includes('签字')).length
)

const unresolvedExceptions = computed(() => exceptions.value.filter(e => !e.resolved).length)

watch(() => plan.value, (p) => {
  if (p) {
    form.assessment_done = p.assessment_done
    form.assessment_note = p.assessment_note || ''
    form.plan_done = p.plan_done
    form.plan_note = p.plan_note || ''
    form.family_confirmed = p.family_confirmed
    form.family_note = p.family_note || ''
  }
})

async function loadDetail() {
  const id = route.params.id as string
  const [planRes, attRes, recRes, audRes, excRes] = await Promise.all([
    api.getPlan(id),
    api.getAttachments(id),
    api.getRecords(id),
    api.getAudit(id),
    api.getExceptions(id),
  ])
  if (planRes.success && planRes.data) plan.value = planRes.data
  else if (!planRes.success) alert('加载失败：' + planRes.message)
  if (attRes.success && attRes.data) attachments.value = attRes.data
  if (recRes.success && recRes.data) records.value = recRes.data
  if (audRes.success && audRes.data) auditNotes.value = audRes.data
  if (excRes.success && excRes.data) exceptions.value = excRes.data
}

function goBack() {
  router.push('/')
}

function getBaseVersion(): number {
  return plan.value ? plan.value.version : 1
}

async function quickUpload(baseName: string) {
  if (!plan.value) return
  const fname = `${baseName}-${plan.value.elder_name}-${new Date().toISOString().slice(0, 10)}.pdf`
  const ftype = baseName.includes('评估') ? 'assessment' : (baseName.includes('护理') ? 'care_plan' : 'other')
  const res = await api.uploadAttachment(plan.value.id, fname, ftype)
  if (res.success) {
    alert(`已登记${baseName}附件：${fname}`)
    loadDetail()
  } else {
    alert('上传失败：' + res.message)
  }
}

async function quickUploadFamilySignature() {
  if (!plan.value) return
  const fname = `家属签字确认单-${plan.value.elder_name}.pdf`
  const res = await api.uploadAttachment(plan.value.id, fname, 'family_signature')
  if (res.success) {
    alert('✅ 家属签字确认单证据已登记！可继续勾选"已确认"状态。')
    form.family_confirmed = true
    loadDetail()
  } else {
    alert('上传失败：' + res.message)
  }
}

async function doUploadAttachment() {
  if (!plan.value) return
  if (!uploadForm.file_name || !uploadForm.file_type) {
    alert('请填写文件名和类型')
    return
  }
  const res = await api.uploadAttachment(plan.value.id, uploadForm.file_name, uploadForm.file_type)
  if (res.success) {
    alert('附件上传成功')
    uploadForm.file_name = ''
    uploadForm.file_type = ''
    loadDetail()
  } else {
    alert('上传失败：' + res.message)
  }
}

async function doDispatch() {
  if (!plan.value) return
  const res = await api.dispatchPlan(plan.value.id, { remark: remark.value || undefined, version: getBaseVersion() })
  if (res.success) {
    alert('派发成功')
    remark.value = ''
    loadDetail()
  } else {
    alert('派发失败：' + res.message)
    loadDetail()
  }
}

async function doUpdate() {
  if (!plan.value) return
  const req: UpdatePlanRequest = {
    assessment_done: form.assessment_done,
    assessment_note: form.assessment_note || undefined,
    plan_done: form.plan_done,
    plan_note: form.plan_note || undefined,
    family_confirmed: form.family_confirmed,
    family_note: form.family_note || undefined,
    remark: remark.value || undefined,
    version: getBaseVersion(),
  }
  const res = await api.updatePlan(plan.value.id, req)
  if (res.success) {
    alert('保存成功')
    remark.value = ''
    loadDetail()
  } else {
    alert('保存失败：' + res.message)
    loadDetail()
  }
}

async function doSubmit() {
  if (!plan.value) return
  const res = await api.submitPlan(plan.value.id, { remark: remark.value || undefined, version: getBaseVersion() })
  if (res.success) {
    alert('提交复核成功')
    remark.value = ''
    loadDetail()
  } else {
    alert('提交失败：' + res.message)
    loadDetail()
  }
}

async function doReview() {
  if (!plan.value) return
  const res = await api.reviewPlan(plan.value.id, { remark: remark.value || undefined, version: getBaseVersion() })
  if (res.success) {
    alert('复核归档成功')
    remark.value = ''
    loadDetail()
  } else {
    alert('复核失败：' + res.message)
    loadDetail()
  }
}

async function doReturn() {
  if (!plan.value) return
  if (!returnRemark.value.trim()) {
    alert('请填写退回原因')
    return
  }
  const res = await api.returnPlan(plan.value.id, { remark: returnRemark.value.trim(), version: getBaseVersion() })
  if (res.success) {
    alert('退回成功')
    showReturn.value = false
    returnRemark.value = ''
    loadDetail()
  } else {
    alert('退回失败：' + res.message)
    loadDetail()
  }
}

onMounted(() => loadDetail())
watch(() => auth.currentRole, () => loadDetail())
</script>
