<template>
  <div class="followup-detail" v-loading="loading">
    <div class="detail-header">
      <div class="header-left">
        <el-button @click="router.back()" :icon="ArrowLeft">返回</el-button>
        <h2 class="title">慢病随访单详情</h2>
        <el-tag :type="STATUS_COLORS[detail.form?.status]" effect="dark" size="large">
          {{ detail.form?.statusName }}
        </el-tag>
        <el-tag :type="OVERDUE_COLORS[detail.form?.overdueLevel]" effect="light" size="large">
          {{ OVERDUE_NAMES[detail.form?.overdueLevel] }}
          <span v-if="detail.form?.overdueDays !== undefined">
            ({{ detail.form.overdueDays > 0 ? detail.form.overdueDays + '天' : Math.abs(detail.form.overdueDays) + '天前' }})
          </span>
        </el-tag>
        <el-tag type="info" effect="plain">版本 v{{ detail.form?.version }}</el-tag>
      </div>
      <div class="header-right">
        <el-button v-if="detail.permissions?.canEdit" type="primary" @click="editDialog.visible = true">
          编辑
        </el-button>
        <el-button v-if="detail.permissions?.canSubmit" type="success" @click="handleSubmit">
          提交审核
        </el-button>
        <el-button v-if="detail.permissions?.canResubmit" type="success" @click="handleResubmit">
          重新提交
        </el-button>
        <el-button v-if="detail.permissions?.canProcess" type="primary" @click="processDialog.visible = true">
          处理
        </el-button>
        <el-button v-if="detail.permissions?.canReview" type="primary" @click="reviewDialog.visible = true">
          审核
        </el-button>
        <el-button v-if="detail.permissions?.canComplete" type="success" @click="handleComplete">
          完成
        </el-button>
        <el-button v-if="detail.permissions?.canReturn" type="warning" @click="returnDialog.visible = true">
          退回
        </el-button>
        <el-button v-if="detail.permissions?.canArchive" type="info" @click="handleArchive">
          归档
        </el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card class="info-card">
          <template #header>
            <div class="card-title">
              <el-icon><User /></el-icon>患者基本信息
            </div>
          </template>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="患者姓名">{{ detail.form?.patient_name }}</el-descriptions-item>
            <el-descriptions-item label="身份证号">{{ detail.form?.id_card }}</el-descriptions-item>
            <el-descriptions-item label="性别">{{ detail.form?.gender }}</el-descriptions-item>
            <el-descriptions-item label="年龄">{{ detail.form?.age }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.form?.phone }}</el-descriptions-item>
            <el-descriptions-item label="居住地址">{{ detail.form?.address }}</el-descriptions-item>
            <el-descriptions-item label="慢病类型">{{ detail.form?.chronic_type }}</el-descriptions-item>
            <el-descriptions-item label="随访类型">{{ detail.form?.followup_type }}</el-descriptions-item>
            <el-descriptions-item label="到期日期">{{ formatDate(detail.form?.due_date) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="info-card">
          <template #header>
            <div class="card-title">
              <el-icon><Monitor /></el-icon>随访体征信息
            </div>
          </template>
          <el-descriptions :column="4" border>
            <el-descriptions-item label="血压">{{ detail.form?.blood_pressure || '未填写' }}</el-descriptions-item>
            <el-descriptions-item label="血糖">{{ detail.form?.blood_sugar || '未填写' }}</el-descriptions-item>
            <el-descriptions-item label="心率">{{ detail.form?.heart_rate || '未填写' }}</el-descriptions-item>
            <el-descriptions-item label="体重">{{ detail.form?.weight || '未填写' }}</el-descriptions-item>
          </el-descriptions>
          <el-descriptions :column="1" border style="margin-top: 12px;">
            <el-descriptions-item label="症状描述">{{ detail.form?.symptoms || '无' }}</el-descriptions-item>
            <el-descriptions-item label="生活方式">{{ detail.form?.lifestyle || '未记录' }}</el-descriptions-item>
            <el-descriptions-item label="用药依从性">{{ detail.form?.medication_compliance || '未记录' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="info-card" v-if="detail.form?.diagnosis || detail.form?.treatment_plan || detail.form?.doctor_opinion || detail.form?.director_opinion">
          <template #header>
            <div class="card-title">
              <el-icon><Document /></el-icon>诊疗意见
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="诊断结果" v-if="detail.form?.diagnosis">
              <span class="opinion-text">{{ detail.form.diagnosis }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="治疗方案" v-if="detail.form?.treatment_plan">
              <span class="opinion-text">{{ detail.form.treatment_plan }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="医生意见" v-if="detail.form?.doctor_opinion">
              <span class="opinion-text">{{ detail.form.doctor_opinion }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="主任意见" v-if="detail.form?.director_opinion">
              <span class="opinion-text">{{ detail.form.director_opinion }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="退回原因" v-if="detail.form?.return_reason">
              <el-alert :title="detail.form.return_reason" type="warning" :closable="false" show-icon />
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="info-card">
          <template #header>
            <div class="card-title">
              <el-icon><Paperclip /></el-icon>证据附件
              <el-button type="primary" size="small" style="margin-left: 12px" @click="attachmentDialog.visible = true">
                上传附件
              </el-button>
            </div>
          </template>
          <el-table :data="detail.attachments" border stripe>
            <el-table-column prop="name" label="附件名称" />
            <el-table-column label="类型" width="120">
              <template #default="{ row }">
                <el-tag type="info">{{ EVIDENCE_TYPES[row.type] || row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="uploader_name" label="上传人" width="100" />
            <el-table-column prop="created_at" label="上传时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button type="danger" link size="small" @click="deleteAttachment(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="detail.attachments?.length === 0" description="暂无附件" />
        </el-card>

        <el-card class="info-card">
          <template #header>
            <div class="card-title">
              <el-icon><Clock /></el-icon>处理记录
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(record, index) in detail.processingRecords"
              :key="record.id"
              :timestamp="formatDateTime(record.created_at)"
              :type="index === 0 ? 'primary' : ''"
            >
              <h4>
                <el-tag :type="STATUS_COLORS[record.status]" size="small">{{ record.statusName }}</el-tag>
                <span class="handler">{{ record.user_name }} ({{ record.roleName }})</span>
              </h4>
              <p class="opinion">{{ record.opinion || '无意见' }}</p>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="detail.processingRecords?.length === 0" description="暂无处理记录" />
        </el-card>

        <el-card class="info-card">
          <template #header>
            <div class="card-title">
              <el-icon><Notebook /></el-icon>审计备注
            </div>
          </template>
          <el-table :data="detail.auditLogs" border stripe size="small">
            <el-table-column prop="action" label="操作" width="120" />
            <el-table-column prop="remark" label="备注" />
            <el-table-column label="状态变更" width="180">
              <template #default="{ row }">
                <span v-if="row.extraData?.toStatus">
                  <el-tag :type="STATUS_COLORS[row.extraData.toStatus]" size="small">
                    {{ STATUS_NAMES[row.extraData.toStatus] }}
                  </el-tag>
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="user_name" label="操作人" width="100" />
            <el-table-column prop="created_at" label="时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-if="detail.auditLogs?.length === 0" description="暂无审计记录" />
        </el-card>

        <el-card class="info-card" v-if="detail.exceptions?.length > 0">
          <template #header>
            <div class="card-title">
              <el-icon><WarningFilled /></el-icon>异常原因记录
            </div>
          </template>
          <el-alert
            v-for="exc in detail.exceptions"
            :key="exc.id"
            :title="exc.reason"
            type="error"
            :closable="false"
            show-icon
            style="margin-bottom: 8px;"
          >
            <template #default>
              <div class="exception-meta">
                <span>类型：{{ exc.type }}</span>
                <span>操作人：{{ exc.operator_name }}</span>
                <span>时间：{{ formatDateTime(exc.created_at) }}</span>
              </div>
            </template>
          </el-alert>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="info-card" v-if="detail.chronicRecord">
          <template #header>
            <div class="card-title">
              <el-icon><FolderOpened /></el-icon>慢病档案
              <el-button type="primary" size="small" style="margin-left: 12px" @click="chronicDialog.visible = true">
                补正
              </el-button>
            </div>
          </template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="确诊日期">{{ formatDate(detail.chronicRecord.diagnosis_date) }}</el-descriptions-item>
            <el-descriptions-item label="慢病类型">{{ detail.chronicRecord.chronic_type }}</el-descriptions-item>
            <el-descriptions-item label="严重程度">
              <el-tag :type="detail.chronicRecord.severity === '重度' ? 'danger' : detail.chronicRecord.severity === '中度' ? 'warning' : 'success'" size="small">
                {{ detail.chronicRecord.severity }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="并发症">{{ detail.chronicRecord.complications || '无' }}</el-descriptions-item>
            <el-descriptions-item label="治疗史">{{ detail.chronicRecord.treatment_history || '无' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card class="info-card" v-else>
          <template #header>
            <div class="card-title">
              <el-icon><FolderOpened /></el-icon>慢病档案
            </div>
          </template>
          <el-empty description="暂无慢病档案，可补正">
            <el-button type="primary" @click="chronicDialog.visible = true">补正档案</el-button>
          </el-empty>
        </el-card>

        <el-card class="info-card" style="margin-top: 16px;">
          <template #header>
            <div class="card-title">
              <el-icon><MedicineBox /></el-icon>用药提醒
              <el-button type="primary" size="small" style="margin-left: 12px" @click="medicationDialog.visible = true">
                添加
              </el-button>
            </div>
          </template>
          <el-table :data="detail.medicationReminders" border stripe size="small">
            <el-table-column prop="drug_name" label="药品" />
            <el-table-column prop="dosage" label="剂量" width="80" />
            <el-table-column prop="frequency" label="用法" width="90" />
          </el-table>
          <el-empty v-if="detail.medicationReminders?.length === 0" description="暂无用药提醒" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="editDialog.visible" title="编辑随访单" width="700px">
      <el-form :model="editForm" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="患者姓名">
              <el-input v-model="editForm.patient_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="身份证号">
              <el-input v-model="editForm.id_card" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="性别">
              <el-select v-model="editForm.gender" style="width: 100%">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="年龄">
              <el-input-number v-model="editForm.age" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="慢病类型">
              <el-select v-model="editForm.chronic_type" style="width: 100%">
                <el-option label="高血压" value="高血压" />
                <el-option label="糖尿病" value="糖尿病" />
                <el-option label="高血压、糖尿病" value="高血压、糖尿病" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="到期日期">
              <el-date-picker v-model="editForm.due_date" type="datetime" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="processDialog.visible" title="医生处理" width="500px">
      <el-form :model="processForm" label-width="100px">
        <el-form-item label="诊断结果">
          <el-input v-model="processForm.diagnosis" type="textarea" :rows="2" placeholder="请输入诊断结果" />
        </el-form-item>
        <el-form-item label="治疗方案">
          <el-input v-model="processForm.treatment_plan" type="textarea" :rows="2" placeholder="请输入治疗方案" />
        </el-form-item>
        <el-form-item label="处理意见">
          <el-input v-model="processForm.opinion" type="textarea" :rows="3" placeholder="请输入处理意见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="processDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmProcess">确认处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialog.visible" title="主任审核" width="500px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="审核意见">
          <el-input v-model="reviewForm.opinion" type="textarea" :rows="4" placeholder="请输入审核意见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmReview">确认审核</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="returnDialog.visible" title="退回补正" width="500px">
      <el-form :model="returnForm" label-width="100px">
        <el-form-item label="退回原因" required>
          <el-input v-model="returnForm.reason" type="textarea" :rows="3" placeholder="请输入退回原因" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="returnForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialog.visible = false">取消</el-button>
        <el-button type="warning" :loading="saving" @click="confirmReturn">确认退回</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="attachmentDialog.visible" title="上传附件" width="500px">
      <el-form :model="attachmentForm" label-width="100px">
        <el-form-item label="附件类型" required>
          <el-select v-model="attachmentForm.type" style="width: 100%">
            <el-option v-for="(name, key) in EVIDENCE_TYPES" :key="key" :label="name" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="附件名称" required>
          <el-input v-model="attachmentForm.name" placeholder="请输入附件名称" />
        </el-form-item>
        <el-form-item label="附件URL" required>
          <el-input v-model="attachmentForm.url" placeholder="请输入附件访问地址" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="attachmentDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAttachment">上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="chronicDialog.visible" title="补正慢病档案" width="600px">
      <el-form :model="chronicForm" label-width="100px">
        <el-form-item label="确诊日期" required>
          <el-date-picker v-model="chronicForm.diagnosis_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="慢病类型" required>
          <el-select v-model="chronicForm.chronic_type" style="width: 100%">
            <el-option label="高血压" value="高血压" />
            <el-option label="2型糖尿病" value="2型糖尿病" />
            <el-option label="冠心病" value="冠心病" />
            <el-option label="高血压3级" value="高血压3级" />
          </el-select>
        </el-form-item>
        <el-form-item label="严重程度" required>
          <el-select v-model="chronicForm.severity" style="width: 100%">
            <el-option label="轻度" value="轻度" />
            <el-option label="中度" value="中度" />
            <el-option label="重度" value="重度" />
          </el-select>
        </el-form-item>
        <el-form-item label="并发症">
          <el-input v-model="chronicForm.complications" placeholder="无" />
        </el-form-item>
        <el-form-item label="治疗史">
          <el-input v-model="chronicForm.treatment_history" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="chronicDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveChronic">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="medicationDialog.visible" title="添加用药提醒" width="500px">
      <el-form :model="medicationForm" label-width="100px">
        <el-form-item label="药品名称" required>
          <el-input v-model="medicationForm.drug_name" />
        </el-form-item>
        <el-form-item label="剂量" required>
          <el-input v-model="medicationForm.dosage" placeholder="如：500mg" />
        </el-form-item>
        <el-form-item label="用法" required>
          <el-select v-model="medicationForm.frequency" style="width: 100%">
            <el-option label="每日1次" value="每日1次" />
            <el-option label="每日2次" value="每日2次" />
            <el-option label="每日3次" value="每日3次" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期" required>
          <el-date-picker v-model="medicationForm.start_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期" required>
          <el-date-picker v-model="medicationForm.end_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="medicationForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="medicationDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMedication">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="remarkDialog.visible" title="填写备注" width="400px">
      <el-form :model="remarkForm" label-width="80px">
        <el-form-item label="备注">
          <el-input v-model="remarkForm.remark" type="textarea" :rows="3" placeholder="请输入备注（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="remarkDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmAction">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { useUserStore } from '../stores/user'
import {
  getFollowupDetailApi,
  updateFollowupApi,
  submitFollowupApi,
  resubmitFollowupApi,
  processFollowupApi,
  reviewFollowupApi,
  completeFollowupApi,
  returnFollowupApi,
  archiveFollowupApi,
  uploadAttachmentApi,
  deleteAttachmentApi
} from '../api/followup'
import { createChronicRecordApi } from '../api/chronicRecord'
import { createMedicationReminderApi } from '../api/medication'
import { STATUS_NAMES, STATUS_COLORS, OVERDUE_COLORS, OVERDUE_NAMES, EVIDENCE_TYPES } from '../types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const saving = ref(false)
const detail = ref({
  form: null,
  attachments: [],
  processingRecords: [],
  auditLogs: [],
  exceptions: [],
  chronicRecord: null,
  medicationReminders: [],
  permissions: {}
})

const id = route.params.id

const editDialog = reactive({ visible: false })
const editForm = reactive({})

const processDialog = reactive({ visible: false })
const processForm = reactive({ opinion: '', diagnosis: '', treatment_plan: '' })

const reviewDialog = reactive({ visible: false })
const reviewForm = reactive({ opinion: '' })

const returnDialog = reactive({ visible: false })
const returnForm = reactive({ reason: '', remark: '' })

const attachmentDialog = reactive({ visible: false })
const attachmentForm = reactive({ type: '', name: '', url: '' })

const chronicDialog = reactive({ visible: false })
const chronicForm = reactive({
  patient_name: '',
  patient_id_card: '',
  diagnosis_date: '',
  chronic_type: '',
  severity: '',
  complications: '',
  treatment_history: ''
})

const medicationDialog = reactive({ visible: false })
const medicationForm = reactive({
  patient_name: '',
  patient_id_card: '',
  drug_name: '',
  dosage: '',
  frequency: '',
  start_date: '',
  end_date: '',
  notes: ''
})

const remarkDialog = reactive({ visible: false })
const remarkForm = reactive({ remark: '' })
let pendingAction = null

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD') : '-'
}

function formatDateTime(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function fetchDetail() {
  loading.value = true
  try {
    const res = await getFollowupDetailApi(id)
    detail.value = res
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  pendingAction = async () => {
    await submitFollowupApi(id, { version: detail.value.form.version, remark: remarkForm.remark })
    ElMessage.success('提交成功')
    fetchDetail()
  }
  remarkDialog.visible = true
}

async function handleResubmit() {
  pendingAction = async () => {
    await resubmitFollowupApi(id, { version: detail.value.form.version, remark: remarkForm.remark })
    ElMessage.success('重新提交成功')
    fetchDetail()
  }
  remarkDialog.visible = true
}

async function handleComplete() {
  pendingAction = async () => {
    await completeFollowupApi(id, { version: detail.value.form.version, opinion: remarkForm.remark })
    ElMessage.success('完成成功')
    fetchDetail()
  }
  remarkDialog.visible = true
}

async function handleArchive() {
  try {
    await ElMessageBox.confirm('确定要归档该随访单吗？', '提示', { type: 'warning' })
    await archiveFollowupApi(id, { version: detail.value.form.version })
    ElMessage.success('归档成功')
    fetchDetail()
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err)
    }
  }
}

async function confirmAction() {
  if (pendingAction) {
    saving.value = true
    try {
      await pendingAction()
      remarkDialog.visible = false
      remarkForm.remark = ''
    } catch (err) {
      console.error(err)
    } finally {
      saving.value = false
    }
  }
}

async function saveEdit() {
  saving.value = true
  try {
    await updateFollowupApi(id, { ...editForm, version: detail.value.form.version })
    ElMessage.success('保存成功')
    editDialog.visible = false
    fetchDetail()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function confirmProcess() {
  saving.value = true
  try {
    await processFollowupApi(id, { version: detail.value.form.version, ...processForm })
    ElMessage.success('处理成功')
    processDialog.visible = false
    fetchDetail()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function confirmReview() {
  saving.value = true
  try {
    await reviewFollowupApi(id, { version: detail.value.form.version, ...reviewForm })
    ElMessage.success('审核成功')
    reviewDialog.visible = false
    fetchDetail()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function confirmReturn() {
  if (!returnForm.reason) {
    ElMessage.warning('请填写退回原因')
    return
  }
  saving.value = true
  try {
    await returnFollowupApi(id, { version: detail.value.form.version, ...returnForm })
    ElMessage.success('退回成功')
    returnDialog.visible = false
    fetchDetail()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function saveAttachment() {
  if (!attachmentForm.type || !attachmentForm.name || !attachmentForm.url) {
    ElMessage.warning('请填写完整附件信息')
    return
  }
  saving.value = true
  try {
    await uploadAttachmentApi(id, { ...attachmentForm, size: 0 })
    ElMessage.success('上传成功')
    attachmentDialog.visible = false
    fetchDetail()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function deleteAttachment(row) {
  try {
    await ElMessageBox.confirm('确定要删除该附件吗？', '提示', { type: 'warning' })
    await deleteAttachmentApi(id, row.id)
    ElMessage.success('删除成功')
    fetchDetail()
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err)
    }
  }
}

async function saveChronic() {
  saving.value = true
  try {
    chronicForm.patient_name = detail.value.form.patient_name
    chronicForm.patient_id_card = detail.value.form.id_card
    await createChronicRecordApi(chronicForm)
    ElMessage.success('保存成功')
    chronicDialog.visible = false
    fetchDetail()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function saveMedication() {
  saving.value = true
  try {
    medicationForm.patient_name = detail.value.form.patient_name
    medicationForm.patient_id_card = detail.value.form.id_card
    await createMedicationReminderApi(medicationForm)
    ElMessage.success('保存成功')
    medicationDialog.visible = false
    fetchDetail()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>

<style scoped>
.followup-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  gap: 8px;
}

.info-card {
  margin-bottom: 16px;
  border-radius: 8px;
}

.card-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 15px;
}

.card-title .el-icon {
  margin-right: 6px;
}

.opinion-text {
  color: #606266;
  line-height: 1.6;
}

.handler {
  margin-left: 8px;
  color: #909399;
  font-size: 13px;
  font-weight: normal;
}

.opinion {
  margin: 4px 0 0 0;
  color: #606266;
}

.exception-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
