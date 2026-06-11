<template>
  <div class="clue-detail-container" v-loading="loading">
    <div class="detail-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" text @click="goBack">
          返回列表
        </el-button>
        <h2 class="detail-title">
          {{ detail?.clue_no }} - {{ detail?.title }}
        </h2>
      </div>
      <div class="header-right">
        <el-tag 
          :style="{ background: STATUS_COLORS[detail?.status] + '20', color: STATUS_COLORS[detail?.status], borderColor: STATUS_COLORS[detail?.status] }"
          size="large"
        >
          {{ STATUS_LABELS[detail?.status] }}
        </el-tag>
        <el-tag 
          :type="detail?.priority === 'high' ? 'danger' : detail?.priority === 'medium' ? 'warning' : 'success'"
          size="large"
        >
          {{ PRIORITY_LABELS[detail?.priority] }}优先级
        </el-tag>
        <el-tag 
          size="large"
          :type="detail?.expiry_status === 'overdue' ? 'danger' : detail?.expiry_status === 'urgent' ? 'warning' : 'success'"
        >
          {{ EXPIRY_LABELS[detail?.expiry_status] }}
          <span v-if="detail?.days_left !== null">
            ({{ detail.days_left > 0 ? detail.days_left + '天' : Math.abs(detail.days_left) + '天前' }})
          </span>
        </el-tag>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card class="info-card">
          <template #header>
            <span class="card-title">
              <el-icon><Document /></el-icon>
              基本信息
            </span>
          </template>
          
          <el-descriptions :column="2" border>
            <el-descriptions-item label="线索单号">
              <strong>{{ detail?.clue_no }}</strong>
            </el-descriptions-item>
            <el-descriptions-item label="线索类型">
              {{ CLUE_TYPE_LABELS[detail?.clue_type] }}
            </el-descriptions-item>
            <el-descriptions-item label="企业名称">
              <strong>{{ detail?.enterprise_name }}</strong>
            </el-descriptions-item>
            <el-descriptions-item label="投资金额">
              <span style="color: #F56C6C; font-weight: 600;">
                {{ formatAmount(detail?.amount) }} 万元
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="联系人">
              {{ detail?.contact_person }}
            </el-descriptions-item>
            <el-descriptions-item label="联系电话">
              {{ detail?.contact_phone }}
            </el-descriptions-item>
            <el-descriptions-item label="责任人">
              <el-tag size="small" type="primary">{{ detail?.responsible_person_name }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前处理人">
              <el-tag size="small" type="warning">{{ detail?.current_handler_name || '待分配' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建人">
              {{ detail?.created_by_name }}
            </el-descriptions-item>
            <el-descriptions-item label="当前版本">
              v{{ detail?.version }}
            </el-descriptions-item>
            <el-descriptions-item label="截止时间">
              <span :style="{ color: EXPIRY_COLORS[detail?.expiry_status] }">
                {{ formatDate(detail?.deadline) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ formatDate(detail?.created_at) }}
            </el-descriptions-item>
            <el-descriptions-item label="异常标签" :span="2">
              <div class="abnormal-tags">
                <el-tag 
                  v-for="tag in detail?.abnormal_tags" 
                  :key="tag" 
                  size="small" 
                  type="danger" 
                  effect="plain"
                >
                  {{ ABNORMAL_LABELS[tag] }}
                </el-tag>
                <span v-if="detail?.abnormal_tags?.length === 0" style="color: #c0c4cc;">无异常</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="项目描述" :span="2">
              {{ detail?.description || '无' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="info-card" v-if="detail?.return_reason">
          <template #header>
            <span class="card-title" style="color: #F56C6C;">
              <el-icon><Warning /></el-icon>
              退回原因
            </span>
          </template>
          <el-alert 
            :title="detail.return_reason" 
            type="error" 
            :closable="false"
            show-icon
          />
        </el-card>

        <el-card class="info-card" v-if="detail?.audit_remark">
          <template #header>
            <span class="card-title">
              <el-icon><EditPen /></el-icon>
              审核备注
            </span>
          </template>
          <div class="remark-content">{{ detail.audit_remark }}</div>
        </el-card>

        <el-card class="info-card">
          <template #header>
            <div class="card-header-with-action">
              <span class="card-title">
                <el-icon><Paperclip /></el-icon>
                附件资料
                <el-tag size="small" type="info" style="margin-left: 8px;">
                  {{ detail?.attachments?.length || 0 }} 个
                </el-tag>
                <el-tag
                  v-if="missingAttachmentTypes.length > 0"
                  size="small"
                  type="danger"
                  effect="plain"
                  style="margin-left: 8px;"
                >
                  缺：{{ missingAttachmentTypes.join('、') }}
                </el-tag>
                <el-tag
                  v-else-if="requiredAttachmentTypes.length > 0"
                  size="small"
                  type="success"
                  effect="plain"
                  style="margin-left: 8px;"
                >
                  必填已齐
                </el-tag>
              </span>
              <el-button
                v-if="canUploadAttachment"
                type="primary"
                size="small"
                :icon="Upload"
                @click="openAttachmentDialog"
              >
                补充附件
              </el-button>
            </div>
          </template>
          
          <el-table :data="detail?.attachments || []" size="small">
            <el-table-column prop="file_name" label="文件名" min-width="200">
              <template #default="{ row }">
                <el-link type="primary">
                  <el-icon><Document /></el-icon>
                  {{ row.file_name }}
                </el-link>
              </template>
            </el-table-column>
            <el-table-column prop="attachment_type" label="类型" width="120">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :type="requiredAttachmentKey(row.attachment_type) ? 'primary' : 'info'"
                  effect="plain"
                >
                  {{ ATTACHMENT_TYPE_LABELS[row.attachment_type] || '其他' }}
                  {{ requiredAttachmentKey(row.attachment_type) ? '(必填)' : '' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="file_size" label="大小" width="100">
              <template #default="{ row }">
                {{ formatFileSize(row.file_size) }}
              </template>
            </el-table-column>
            <el-table-column prop="uploaded_by_name" label="上传人" width="100" />
            <el-table-column prop="created_at" label="上传时间" width="160">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="canDeleteAttachment(row)"
                  type="danger"
                  size="small"
                  link
                  @click="handleDeleteAttachment(row)"
                >
                  删除
                </el-button>
                <span v-else style="color: #c0c4cc;">-</span>
              </template>
            </el-table-column>
          </el-table>

          <el-empty 
            v-if="!detail?.attachments?.length" 
            description="暂无附件" 
            :image-size="80"
          />
        </el-card>

        <el-card class="info-card">
          <template #header>
            <div class="card-header-with-action">
              <span class="card-title">
                <el-icon><Tickets /></el-icon>
                处理记录
              </span>
            </div>
          </template>
          
          <el-timeline>
            <el-timeline-item 
              v-for="(record, index) in detail?.processing_records || []" 
              :key="record.id"
              :timestamp="formatDate(record.created_at)"
              :type="record.result === 'success' ? 'success' : 'danger'"
              :icon="record.result === 'success' ? CircleCheck : CircleClose"
            >
              <div class="timeline-content">
                <div class="timeline-header">
                  <strong>{{ record.action }}</strong>
                  <el-tag size="small" :style="{ marginLeft: '8px' }">
                    {{ STATUS_LABELS[record.from_status] }} → {{ STATUS_LABELS[record.to_status] }}
                  </el-tag>
                </div>
                <p v-if="record.remark" class="timeline-remark">
                  {{ record.remark }}
                </p>
                <div class="timeline-footer">
                  操作人：{{ record.operator_name || '系统' }}
                </div>
              </div>
            </el-timeline-item>
            <el-timeline-item 
              v-if="!detail?.processing_records?.length"
              type="primary"
              :icon="Clock"
            >
              <span style="color: #909399;">暂无处理记录</span>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card class="info-card" v-if="authStore.isAuditor || authStore.isReviewer">
          <template #header>
            <span class="card-title">
              <el-icon><ChatDotRound /></el-icon>
              审计备注
              <el-tag size="small" type="info" style="margin-left: 8px;">
                {{ detail?.audit_notes?.length || 0 }} 条
              </el-tag>
            </span>
          </template>

          <div class="audit-notes">
            <div 
              v-for="note in detail?.audit_notes || []" 
              :key="note.id"
              class="audit-note-item"
            >
              <div class="note-header">
                <el-avatar :size="24" :icon="UserFilled" />
                <span class="note-author">{{ note.auditor_name }}</span>
                <span class="note-time">{{ formatDate(note.created_at) }}</span>
              </div>
              <div class="note-content">{{ note.note }}</div>
            </div>
          </div>

          <el-empty 
            v-if="!detail?.audit_notes?.length" 
            description="暂无审计备注" 
            :image-size="60"
          />

          <div class="add-note-section" v-if="canAddAuditNote">
            <el-divider />
            <el-input 
              v-model="newAuditNote" 
              type="textarea" 
              :rows="2" 
              placeholder="添加审计备注（仅审核和复核人员可见）"
              maxlength="500"
              show-word-limit
            />
            <div style="text-align: right; margin-top: 8px;">
              <el-button 
                type="primary" 
                size="small"
                :disabled="!newAuditNote.trim()"
                :loading="submittingNote"
                @click="submitAuditNote"
              >
                添加备注
              </el-button>
            </div>
          </div>
        </el-card>

        <el-card class="info-card">
          <template #header>
            <span class="card-title">
              <el-icon><Warning /></el-icon>
              异常日志（仅作为证据）
              <el-tag size="small" type="danger" style="margin-left: 8px;">
                {{ detail?.abnormal_logs?.length || 0 }} 条
              </el-tag>
            </span>
          </template>

          <el-alert 
            title="异常日志仅作为审计证据，不能替代详情页的真实处理结果" 
            type="info" 
            :closable="false"
            show-icon
            style="margin-bottom: 12px;"
          />

          <el-table :data="detail?.abnormal_logs || []" size="small">
            <el-table-column prop="abnormal_type" label="异常类型" width="120">
              <template #default="{ row }">
                <el-tag size="small" type="danger" effect="plain">
                  {{ ABNORMAL_LABELS[row.abnormal_type] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="异常描述" min-width="250" show-overflow-tooltip />
            <el-table-column prop="operator_name" label="操作人" width="100">
              <template #default="{ row }">
                {{ row.operator_name || '系统' }}
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="记录时间" width="160">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>

          <el-empty 
            v-if="!detail?.abnormal_logs?.length" 
            description="暂无异常记录" 
            :image-size="60"
          />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="action-card">
          <template #header>
            <span class="card-title">
              <el-icon><Operation /></el-icon>
              办理操作
            </span>
          </template>

          <el-alert 
            v-if="detail?.expiry_status === 'overdue'"
            title="该线索单已逾期，请尽快处理" 
            type="error" 
            :closable="false"
            show-icon
            style="margin-bottom: 16px;"
          />
          <el-alert 
            v-else-if="detail?.expiry_status === 'urgent'"
            title="该线索单即将到期，请尽快处理" 
            type="warning" 
            :closable="false"
            show-icon
            style="margin-bottom: 16px;"
          />
          <el-alert 
            v-if="detail?.status === STATUS.RETURNED"
            title="该线索单已被退回，请补充材料后重新提交" 
            type="error" 
            :closable="false"
            show-icon
            style="margin-bottom: 16px;"
          >
            <template #default>
              <p v-if="detail?.return_reason"><strong>退回原因：</strong>{{ detail.return_reason }}</p>
              <p>请在下方「补正材料」操作区补充缺失附件后重新提交。</p>
            </template>
          </el-alert>

          <div v-if="availableActions.length > 0">
            <div 
              v-for="action in availableActions" 
              :key="action.value"
              class="action-item"
            >
              <el-button 
                :type="action.type" 
                size="large"
                style="width: 100%;"
                @click="openProcessDialog(action)"
              >
                <el-icon><component :is="action.icon" /></el-icon>
                {{ action.label }}
              </el-button>
              <div class="action-desc">{{ action.desc }}</div>
            </div>
          </div>

          <el-empty 
            v-else
            description="当前状态下暂无可用操作" 
            :image-size="80"
          />

          <el-divider />
          
          <div class="info-block">
            <h4>队列核对规则</h4>
            <ul>
              <li>✓ 当前角色：{{ ROLE_LABELS[authStore.userRole] }}</li>
              <li>✓ 当前状态：{{ STATUS_LABELS[detail?.status] }}</li>
              <li>✓ 当前处理人：{{ detail?.current_handler_name || '待分配' }}</li>
              <li>✓ 当前版本：v{{ detail?.version }}</li>
              <li v-if="detail?.abnormal_tags?.length" style="color: #F56C6C;">
                ⚠ 异常标签：{{ detail.abnormal_tags.map(t => ABNORMAL_LABELS[t]).join('、') }}
              </li>
              <li v-else>✓ 异常标签：无</li>
              <li v-if="requiredAttachmentTypes.length > 0">
                ⚠ 必填附件：{{ requiredAttachmentTypes.join('、') }}
                <span v-if="missingAttachmentTypes.length > 0" style="color: #F56C6C;">
                  （缺：{{ missingAttachmentTypes.join('、') }}）
                </span>
                <span v-else style="color: #67C23A;">（已齐）</span>
              </li>
            </ul>
          </div>
        </el-card>

        <el-card class="info-card" style="margin-top: 16px;">
          <template #header>
            <span class="card-title">
              <el-icon><InfoFilled /></el-icon>
              状态流转说明
            </span>
          </template>
          <el-steps :active="currentStepIndex" finish-status="success" direction="vertical">
            <el-step 
              v-for="step in statusFlow" 
              :key="step.value" 
              :title="step.label" 
              :description="step.desc"
            />
          </el-steps>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog 
      v-model="processDialogVisible" 
      :title="currentAction?.label"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="processForm" label-width="100px">
        <el-form-item label="当前状态">
          <el-tag>{{ STATUS_LABELS[detail?.status] }}</el-tag>
          <span style="margin: 0 8px;">→</span>
          <el-tag type="primary">{{ STATUS_LABELS[currentAction?.target_status] }}</el-tag>
        </el-form-item>
        
        <el-form-item label="当前版本">
          v{{ detail?.version }}
          <span style="color: #909399; margin-left: 8px;">
            (提交后将自动升级为 v{{ detail?.version + 1 }})
          </span>
        </el-form-item>

        <el-form-item v-if="missingAttachmentTypes.length > 0 && [STATUS.PENDING_AUDIT, STATUS.PENDING_REVIEW, STATUS.RESUBMITTED, STATUS.APPROVED].includes(processForm.target_status)">
          <el-alert
            title="必填附件未齐，提交将被拦截"
            :description="`缺：${missingAttachmentTypes.join('、')}，请先在附件资料中补充后再操作`"
            type="error"
            :closable="false"
            show-icon
          />
        </el-form-item>

        <el-form-item 
          v-if="processForm.target_status === STATUS.RETURNED"
          label="退回原因"
          prop="return_reason"
        >
          <el-input 
            v-model="processForm.return_reason" 
            type="textarea" 
            :rows="3" 
            placeholder="请详细填写退回原因，便于登记员补正"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="处理备注">
          <el-input 
            v-model="processForm.remark" 
            type="textarea" 
            :rows="2" 
            placeholder="请填写处理备注（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="processDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          :loading="processing"
          :disabled="!canSubmitProcess"
          @click="submitProcess"
        >
          确认提交
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="attachmentDialogVisible"
      title="补充附件"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="attachmentForm" label-width="100px">
        <el-alert
          v-if="detail?.status === STATUS.RETURNED"
          title="退回补正提示"
          :description="detail?.return_reason ? `退回原因：${detail.return_reason}` : '请补充缺失的附件后重新提交'"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        />
        <el-form-item label="附件名称" required>
          <el-input
            v-model="attachmentForm.file_name"
            placeholder="请输入附件名称（如：营业执照扫描件）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="附件类型" required>
          <el-select v-model="attachmentForm.attachment_type" style="width: 100%;">
            <el-option
              v-for="opt in ATTACHMENT_TYPE_OPTIONS"
              :key="opt.value"
              :label="opt.label + (opt.required ? '（必填）' : '')"
              :value="opt.value"
              :disabled="opt.required && hasAttachmentType(opt.value)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文件大小">
          <el-input-number
            v-model="attachmentForm.file_size"
            :min="1"
            :max="102400"
            :step="100"
          />
          <span style="margin-left: 8px; color: #909399;">KB（模拟）</span>
        </el-form-item>
        <el-form-item v-if="missingAttachmentTypes.length > 0">
          <el-alert
            title="待补充附件"
            :description="`尚缺：${missingAttachmentTypes.join('、')}`"
            type="error"
            :closable="false"
            show-icon
          />
        </el-form-item>
        <el-form-item v-else-if="requiredAttachmentTypes.length > 0">
          <el-alert
            title="必填附件已齐全"
            type="success"
            :closable="false"
            show-icon
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="attachmentDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="uploadingAttachment"
          :disabled="!canSubmitAttachment"
          @click="submitAttachment"
        >
          上传附件
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  ArrowLeft, Document, Warning, EditPen, Paperclip, 
  Tickets, CircleCheck, CircleClose, Clock, ChatDotRound,
  UserFilled, Operation, InfoFilled, Check, RefreshLeft,
  Delete, Select, View, Upload
} from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import { getClueDetail, processClue, addAuditNote, addAttachment, deleteAttachment } from '../api/clues';
import { useAuthStore } from '../store/auth';
import {
  STATUS, STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS,
  CLUE_TYPE_LABELS,
  ABNORMAL_LABELS,
  EXPIRY_LABELS, EXPIRY_COLORS,
  ROLE_LABELS,
  ATTACHMENT_TYPE_LABELS,
  ROLES
} from '../utils/config';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loading = ref(false);
const processing = ref(false);
const submittingNote = ref(false);
const detail = ref(null);
const newAuditNote = ref('');

const processDialogVisible = ref(false);
const currentAction = ref(null);
const processForm = reactive({
  target_status: '',
  action: '',
  return_reason: '',
  remark: '',
  version: 0
});

const clueId = computed(() => parseInt(route.params.id));

const statusFlow = computed(() => [
  { value: 'draft', label: '草稿', desc: '登记员创建' },
  { value: 'pending_submit', label: '待提交', desc: '登记员提交' },
  { value: 'pending_audit', label: '待审核', desc: '审核主管处理' },
  { value: 'returned', label: '已退回', desc: '需登记员补正' },
  { value: 'resubmitted', label: '重新提交', desc: '登记员补正后提交' },
  { value: 'pending_review', label: '待复核', desc: '复核负责人处理' },
  { value: 'approved', label: '审核通过', desc: '复核通过' },
  { value: 'archived', label: '已归档', desc: '流程结束' }
]);

const currentStepIndex = computed(() => {
  const status = detail.value?.status;
  const index = statusFlow.value.findIndex(s => s.value === status);
  return index >= 0 ? index : 0;
});

const availableActions = computed(() => {
  if (!detail.value) return [];
  
  const role = authStore.userRole;
  const currentStatus = detail.value.status;
  const actions = [];

  if (role === ROLES.REGISTRAR) {
    if (currentStatus === STATUS.PENDING_SUBMIT) {
      actions.push({
        value: 'submit',
        label: '提交审核',
        desc: '提交给审核主管进行审核',
        target_status: STATUS.PENDING_AUDIT,
        action: '提交审核',
        type: 'primary',
        icon: Check
      });
    }
    if (currentStatus === STATUS.RETURNED) {
      actions.push({
        value: 'resubmit',
        label: '重新提交',
        desc: '补正材料后重新提交审核',
        target_status: STATUS.RESUBMITTED,
        action: '重新提交',
        type: 'warning',
        icon: RefreshLeft
      });
    }
  } else if (role === ROLES.AUDITOR) {
    if ([STATUS.PENDING_AUDIT, STATUS.RESUBMITTED].includes(currentStatus)) {
      actions.push({
        value: 'audit_pass',
        label: '审核通过',
        desc: '审核通过，提交给复核负责人',
        target_status: STATUS.PENDING_REVIEW,
        action: '审核通过',
        type: 'success',
        icon: Check
      });
      actions.push({
        value: 'audit_return',
        label: '退回补正',
        desc: '材料不全，退回给登记员补正',
        target_status: STATUS.RETURNED,
        action: '退回补正',
        type: 'danger',
        icon: Delete
      });
    }
  } else if (role === ROLES.REVIEWER) {
    if (currentStatus === STATUS.PENDING_REVIEW) {
      actions.push({
        value: 'review_pass',
        label: '复核通过',
        desc: '复核通过，可以签约入驻',
        target_status: STATUS.APPROVED,
        action: '复核通过',
        type: 'success',
        icon: Check
      });
      actions.push({
        value: 'review_reject',
        label: '复核拒绝',
        desc: '复核拒绝，不予入驻',
        target_status: STATUS.REJECTED,
        action: '复核拒绝',
        type: 'danger',
        icon: Delete
      });
    }
    if ([STATUS.APPROVED, STATUS.REJECTED].includes(currentStatus)) {
      actions.push({
        value: 'archive',
        label: '归档',
        desc: '流程结束，归档处理',
        target_status: STATUS.ARCHIVED,
        action: '归档',
        type: 'info',
        icon: Select
      });
    }
  }

  return actions;
});

const canAddAuditNote = computed(() => {
  return (authStore.isAuditor || authStore.isReviewer) && 
         detail.value?.status !== STATUS.ARCHIVED;
});

const REQUIRED_ATTACHMENTS = {
  pending_audit: ['enterprise_info'],
  pending_review: ['enterprise_info', 'visit_record'],
  approved: ['enterprise_info', 'visit_record', 'signing_contract']
};

const ATTACHMENT_LABELS = {
  enterprise_info: '企业资料',
  visit_record: '拜访记录',
  signing_contract: '签约合同'
};

const ATTACHMENT_TYPE_OPTIONS = computed(() => {
  const required = REQUIRED_ATTACHMENTS[detail.value?.status] || [];
  return [
    { value: 'enterprise_info', label: ATTACHMENT_LABELS.enterprise_info, required: required.includes('enterprise_info') },
    { value: 'visit_record', label: ATTACHMENT_LABELS.visit_record, required: required.includes('visit_record') },
    { value: 'signing_contract', label: ATTACHMENT_LABELS.signing_contract, required: required.includes('signing_contract') },
    { value: 'other', label: '其他材料', required: false }
  ];
});

const requiredAttachmentTypes = computed(() => {
  const status = detail.value?.status;
  if (!status || !REQUIRED_ATTACHMENTS[status]) return [];
  return REQUIRED_ATTACHMENTS[status].map(t => ATTACHMENT_LABELS[t] || t);
});

const missingAttachmentTypes = computed(() => {
  const status = detail.value?.status;
  if (!status || !REQUIRED_ATTACHMENTS[status]) return [];
  const existing = (detail.value?.attachments || []).map(a => a.attachment_type);
  return REQUIRED_ATTACHMENTS[status]
    .filter(t => !existing.includes(t))
    .map(t => ATTACHMENT_LABELS[t] || t);
});

function requiredAttachmentKey(type) {
  const status = detail.value?.status;
  if (!status || !REQUIRED_ATTACHMENTS[status]) return false;
  return REQUIRED_ATTACHMENTS[status].includes(type);
}

function hasAttachmentType(type) {
  return (detail.value?.attachments || []).some(a => a.attachment_type === type);
}

const canSubmitProcess = computed(() => {
  if (!currentAction.value) return false;
  if (processForm.target_status === STATUS.RETURNED && !processForm.return_reason.trim()) return false;
  return true;
});

function formatDate(date) {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

function formatAmount(amount) {
  if (!amount) return '0';
  return (amount / 10000).toLocaleString('zh-CN');
}

function formatFileSize(bytes) {
  if (!bytes) return '未知';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function goBack() {
  router.push('/clues');
}

async function loadDetail() {
  loading.value = true;
  try {
    const res = await getClueDetail(clueId.value);
    detail.value = res.data;
  } catch (e) {
    console.error('加载详情失败:', e);
  } finally {
    loading.value = false;
  }
}

function openProcessDialog(action) {
  currentAction.value = action;
  processForm.target_status = action.target_status;
  processForm.action = action.action;
  processForm.return_reason = '';
  processForm.remark = '';
  processForm.version = detail.value.version;
  processDialogVisible.value = true;
}

async function submitProcess() {
  if (processForm.target_status === STATUS.RETURNED && !processForm.return_reason.trim()) {
    ElMessage.warning('请填写退回原因');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要执行"${currentAction.value.label}"操作吗？`,
      '确认操作',
      { type: 'warning' }
    );
  } catch (e) {
    return;
  }

  processing.value = true;
  try {
    const data = {
      target_status: processForm.target_status,
      action: processForm.action,
      return_reason: processForm.return_reason,
      remark: processForm.remark,
      version: processForm.version
    };

    await processClue(clueId.value, data);
    ElMessage.success('操作成功');
    processDialogVisible.value = false;
    loadDetail();
  } catch (e) {
    console.error('处理失败:', e);
  } finally {
    processing.value = false;
  }
}

async function submitAuditNote() {
  if (!newAuditNote.value.trim()) return;

  submittingNote.value = true;
  try {
    await addAuditNote(clueId.value, newAuditNote.value.trim());
    ElMessage.success('备注添加成功');
    newAuditNote.value = '';
    loadDetail();
  } catch (e) {
    console.error('添加备注失败:', e);
  } finally {
    submittingNote.value = false;
  }
}

const canUploadAttachment = computed(() => {
  if (!detail.value) return false;
  const role = authStore.userRole;
  const status = detail.value.status;

  if (status === STATUS.ARCHIVED) return false;

  if (role === ROLES.REGISTRAR) {
    return detail.value.created_by === authStore.userId &&
           [STATUS.PENDING_SUBMIT, STATUS.RETURNED].includes(status);
  }
  if (role === ROLES.AUDITOR) {
    return [STATUS.PENDING_AUDIT, STATUS.RESUBMITTED].includes(status);
  }
  if (role === ROLES.REVIEWER) {
    return [STATUS.PENDING_REVIEW, STATUS.APPROVED, STATUS.REJECTED].includes(status);
  }
  return false;
});

function canDeleteAttachment(row) {
  if (!canUploadAttachment.value) return false;
  return row.uploaded_by === authStore.userId;
}

const attachmentDialogVisible = ref(false);
const uploadingAttachment = ref(false);
const attachmentForm = reactive({
  file_name: '',
  file_size: 100,
  attachment_type: 'enterprise_info',
  file_url: ''
});

const canSubmitAttachment = computed(() => {
  return attachmentForm.file_name.trim() && attachmentForm.attachment_type;
});

function openAttachmentDialog() {
  const missingKeys = Object.keys(ATTACHMENT_LABELS).filter(t => {
    const status = detail.value?.status;
    const req = REQUIRED_ATTACHMENTS[status] || [];
    return req.includes(t) && !hasAttachmentType(t);
  });
  attachmentForm.attachment_type = missingKeys[0] || 'other';
  attachmentForm.file_name = '';
  attachmentForm.file_size = 100;
  attachmentForm.file_url = '';
  attachmentDialogVisible.value = true;
}

async function submitAttachment() {
  if (!canSubmitAttachment.value) return;

  uploadingAttachment.value = true;
  try {
    const res = await addAttachment(clueId.value, { ...attachmentForm });
    if (res.data?.abnormal_tags_updated) {
      const { before, after } = res.data.abnormal_tags_updated;
      if (before.includes('missing_material') && !after.includes('missing_material')) {
        ElMessage.success('附件上传成功，缺材料异常已解除！');
      } else {
        ElMessage.success('附件上传成功');
      }
    } else {
      ElMessage.success('附件上传成功');
    }
    attachmentDialogVisible.value = false;
    loadDetail();
  } catch (e) {
    console.error('附件上传失败:', e);
  } finally {
    uploadingAttachment.value = false;
  }
}

async function handleDeleteAttachment(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除附件「${row.file_name}」吗？删除后可能导致缺材料异常。`,
      '删除附件',
      { type: 'warning' }
    );
  } catch (e) {
    return;
  }

  try {
    await deleteAttachment(clueId.value, row.id);
    ElMessage.success('附件已删除');
    loadDetail();
  } catch (e) {
    console.error('删除附件失败:', e);
  }
}

onMounted(() => {
  loadDetail();
});
</script>

<style scoped>
.clue-detail-container {
  padding: 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-title {
  margin: 0;
  font-size: 18px;
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
  gap: 6px;
  font-weight: 600;
}

.card-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.abnormal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.remark-content {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  line-height: 1.6;
}

.timeline-content {
  padding: 8px 0;
}

.timeline-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-remark {
  color: #606266;
  margin: 4px 0;
  line-height: 1.5;
}

.timeline-footer {
  color: #909399;
  font-size: 12px;
}

.audit-notes {
  max-height: 300px;
  overflow-y: auto;
}

.audit-note-item {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 8px;
}

.note-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.note-author {
  font-weight: 600;
  color: #303133;
}

.note-time {
  color: #909399;
  font-size: 12px;
}

.note-content {
  line-height: 1.6;
  color: #606266;
}

.add-note-section {
  margin-top: 12px;
}

.action-card {
  border-radius: 8px;
}

.action-item {
  margin-bottom: 16px;
}

.action-item:last-child {
  margin-bottom: 0;
}

.action-desc {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
  padding-left: 4px;
}

.info-block {
  margin-top: 8px;
}

.info-block h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #303133;
}

.info-block ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.info-block li {
  padding: 6px 0;
  color: #606266;
  font-size: 13px;
}

:deep(.el-descriptions__label) {
  width: 110px;
}
</style>
