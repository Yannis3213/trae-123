<template>
  <div>
    <div class="flex-between mb-4">
      <button class="btn btn-outline" @click="goBack">← 返回列表</button>
      <div class="flex gap-2">
        <span v-if="workorder?.warning_level === 'overdue'" class="badge badge-overdue" style="font-size: 13px;">
          ⚠ 已逾期
        </span>
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
            · 创建时间：{{ formatDate(workorder.created_at) }}
          </div>
        </div>
      </div>

      <div class="process-timeline mb-4">
        <div
          v-for="(step, idx) in processSteps"
          :key="step.key"
          class="process-step"
          :class="{
            'step-completed': step.status === 'completed',
            'step-active': step.status === 'active',
            'step-pending': step.status === 'pending',
            'step-overdue': step.status === 'active' && workorder.warning_level === 'overdue'
          }"
        >
          <div class="step-number">
            <span v-if="step.status === 'completed'">✓</span>
            <span v-else>{{ idx + 1 }}</span>
          </div>
          <div class="step-content">
            <div class="step-title">{{ step.title }}</div>
            <div class="step-desc">{{ step.description }}</div>
            <div class="step-responsible" v-if="step.responsible">
              责任人：{{ step.responsible }}
            </div>
          </div>
          <div class="step-action">
            <button
              v-if="step.status === 'active' && step.canEdit"
              class="btn btn-primary btn-sm"
              @click="openStepModal(step.key)"
            >
              {{ step.actionText }}
            </button>
            <button
              v-else-if="step.status === 'active' && step.canSubmit"
              class="btn btn-success btn-sm"
              @click="openStepModal(step.key)"
            >
              {{ step.actionText }}
            </button>
            <span v-else-if="step.status === 'completed'" class="text-success text-sm">已完成</span>
            <span v-else-if="step.status === 'pending'" class="text-muted text-sm">待处理</span>
          </div>
          <div v-if="idx < processSteps.length - 1" class="step-line" :class="{ 'line-completed': step.status === 'completed' }"></div>
        </div>
      </div>

      <div v-if="currentStepHint" class="alert" :class="workorder.warning_level === 'overdue' ? 'alert-error' : 'alert-warning'" style="margin-bottom: 20px;">
        <strong>当前办理步骤：</strong>{{ currentStepHint }}
        <span v-if="workorder.warning_level === 'overdue'" class="text-danger" style="margin-left: 12px;">
          （已逾期，请尽快处理）
        </span>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <div>
          <div class="card" style="background: #f9fafb; margin-bottom: 16px;">
            <div class="flex-between mb-3">
              <h3 style="font-size: 15px; font-weight: 600;">基本信息</h3>
              <span v-if="workorder.warning_level === 'overdue'" class="badge badge-overdue">已逾期</span>
              <span v-else-if="workorder.warning_level === 'warning'" class="badge badge-warning">临期</span>
            </div>
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
                <span class="text-muted">当前节点：</span>
                <span>{{ workorder.current_node }}</span>
              </div>
              <div>
                <span class="text-muted">生产计划员：</span>
                <span>{{ workorder.planner }}</span>
              </div>
              <div>
                <span class="text-muted">车间主任：</span>
                <span>{{ workorder.workshop_director }}</span>
              </div>
              <div>
                <span class="text-muted">厂务经理：</span>
                <span>{{ workorder.factory_manager }}</span>
              </div>
            </div>
          </div>

          <div
            v-for="step in processSteps"
            :key="step.key + '_card'"
            class="card"
            :class="{ 'card-highlight': step.status === 'active', 'card-completed': step.status === 'completed' }"
            style="margin-bottom: 16px;"
          >
            <div class="flex-between" style="margin-bottom: 12px;">
              <h3 style="font-size: 15px; font-weight: 600;">
                <span v-if="step.status === 'completed'" class="text-success">✓ </span>
                {{ step.title }}
              </h3>
              <button
                v-if="step.status === 'active' && step.canEdit"
                class="btn btn-primary btn-sm"
                @click="openStepModal(step.key)"
              >
                {{ step.actionText }}
              </button>
            </div>
            <div v-if="step.data" class="text-sm">
              <template v-if="step.key === 'schedule'">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div><span class="text-muted">开始日期：</span>{{ step.data.start_date }}</div>
                  <div><span class="text-muted">结束日期：</span>{{ step.data.end_date }}</div>
                  <div><span class="text-muted">车间：</span>{{ step.data.workshop }}</div>
                  <div><span class="text-muted">生产线：</span>{{ step.data.line }}</div>
                  <div><span class="text-muted">班次：</span>{{ step.data.shift }}</div>
                  <div><span class="text-muted">排程人：</span>{{ step.data.scheduled_by }}</div>
                </div>
                <div v-if="step.data.remark" class="mt-2">
                  <span class="text-muted">备注：</span>{{ step.data.remark }}
                </div>
              </template>
              <template v-else-if="step.key === 'material'">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div><span class="text-muted">领料日期：</span>{{ step.data.issue_date }}</div>
                  <div><span class="text-muted">仓库：</span>{{ step.data.warehouse }}</div>
                  <div><span class="text-muted">发料人：</span>{{ step.data.issued_by }}</div>
                  <div><span class="text-muted">收料人：</span>{{ step.data.received_by }}</div>
                </div>
                <div v-if="step.data.materials?.length > 0" class="mt-2">
                  <div class="text-muted">物料清单：</div>
                  <ul style="padding-left: 20px; margin-top: 4px;">
                    <li v-for="(m, idx) in step.data.materials" :key="idx">
                      {{ m.name }} - {{ m.quantity }} {{ m.unit }}
                    </li>
                  </ul>
                </div>
                <div v-if="step.data.remark" class="mt-2">
                  <span class="text-muted">备注：</span>{{ step.data.remark }}
                </div>
              </template>
              <template v-else-if="step.key === 'completion'">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div><span class="text-muted">完工日期：</span>{{ step.data.completion_date }}</div>
                  <div><span class="text-muted">实际产量：</span>{{ step.data.actual_quantity }}</div>
                  <div><span class="text-muted">合格数量：</span><span class="text-success">{{ step.data.qualified_quantity }}</span></div>
                  <div><span class="text-muted">不合格数量：</span><span class="text-danger">{{ step.data.defective_quantity }}</span></div>
                  <div><span class="text-muted">检验员：</span>{{ step.data.inspector }}</div>
                  <div><span class="text-muted">报工人：</span>{{ step.data.report_by }}</div>
                </div>
                <div v-if="step.data.remark" class="mt-2">
                  <span class="text-muted">备注：</span>{{ step.data.remark }}
                </div>
              </template>
            </div>
            <div v-else-if="step.status === 'active'" class="text-sm text-muted">
              <template v-if="step.key === 'schedule'">尚未安排生产排程</template>
              <template v-else-if="step.key === 'material'">尚未办理领料确认</template>
              <template v-else-if="step.key === 'completion'">尚未提交完工报工</template>
            </div>
            <div v-else-if="step.status === 'pending'" class="text-sm text-muted">
              请先完成前面的步骤
            </div>
          </div>
        </div>

        <div>
          <div class="card" style="background: #f9fafb; margin-bottom: 16px;">
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
                <span class="text-muted">版本号：</span>
                <span>v{{ workorder.version }}</span>
              </div>
            </div>
          </div>

          <div v-if="canSubmitForReview" class="card" style="background: #dcfce7; margin-bottom: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #166534;">提交复核</h3>
            <p class="text-sm" style="margin-bottom: 12px;">
              生产排程、领料确认、完工报工均已完成，可以提交复核。
            </p>
            <button
              class="btn btn-success"
              style="width: 100%;"
              @click="openStepModal('submit')"
              :disabled="submitting"
            >
              {{ submitting ? '提交中...' : '提交复核' }}
            </button>
          </div>

          <div v-if="canReview" class="card" style="background: #dbeafe; margin-bottom: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #1e40af;">车间复核</h3>
            <p class="text-sm" style="margin-bottom: 12px;">
              请审核该工单的生产信息，确认无误后通过。
            </p>
            <div class="flex gap-2">
              <button
                class="btn btn-success"
                style="flex: 1;"
                @click="openStepModal('review_approve')"
                :disabled="submitting"
              >
                复核通过
              </button>
              <button
                class="btn btn-danger"
                style="flex: 1;"
                @click="openStepModal('review_reject')"
                :disabled="submitting"
              >
                退回补正
              </button>
            </div>
          </div>

          <div v-if="canConfirm" class="card" style="background: #dcfce7; margin-bottom: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #166534;">厂务确认</h3>
            <p class="text-sm" style="margin-bottom: 12px;">
              车间主任已复核通过，请最终确认办结。
            </p>
            <button
              class="btn btn-success"
              style="width: 100%;"
              @click="openStepModal('confirm')"
              :disabled="submitting"
            >
              {{ submitting ? '确认中...' : '确认办结' }}
            </button>
          </div>

          <div v-if="workorder.status === 'completed'" class="card" style="background: #f0fdf4; margin-bottom: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #166534;">✓ 已办结</h3>
            <p class="text-sm">
              办结时间：{{ formatDate(workorder.completed_at) }}
            </p>
          </div>

          <div v-if="exceptions.length > 0" class="card" style="background: #fef2f2; margin-top: 16px;">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #991b1b;">⚠ 异常记录</h3>
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
            <span v-if="record.version_before && record.version_after" style="margin-left: 8px;">
              (版本 v{{ record.version_before }} → v{{ record.version_after }})
            </span>
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
            {{ submitting ? '保存中...' : '保存并下一步' }}
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
            {{ submitting ? '保存中...' : '保存并下一步' }}
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
            {{ submitting ? '保存中...' : '保存并提交复核' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSubmitModal" class="modal-overlay" @click.self="showSubmitModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>提交复核</h3>
          <button class="btn btn-outline btn-sm" @click="showSubmitModal = false">×</button>
        </div>
        <div class="modal-body">
          <p>确认提交该工单给车间主任复核？</p>
          <div v-if="workorder.warning_level === 'overdue'" class="alert alert-warning mt-4">
            ⚠ 该工单已逾期，提交前请确认已完成所有补正
          </div>
          <div class="form-group mt-4">
            <label class="form-label">备注</label>
            <textarea v-model="submitRemark" class="form-textarea" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showSubmitModal = false">取消</button>
          <button class="btn btn-success" @click="submitForReview" :disabled="submitting">
            {{ submitting ? '提交中...' : '确认提交' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showReviewApproveModal" class="modal-overlay" @click.self="showReviewApproveModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>复核通过</h3>
          <button class="btn btn-outline btn-sm" @click="showReviewApproveModal = false">×</button>
        </div>
        <div class="modal-body">
          <p>确认复核通过，提交给厂务经理确认？</p>
          <div class="form-group mt-4">
            <label class="form-label">备注</label>
            <textarea v-model="reviewRemark" class="form-textarea" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showReviewApproveModal = false">取消</button>
          <button class="btn btn-success" @click="approveReview" :disabled="submitting">
            {{ submitting ? '处理中...' : '确认通过' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showReviewRejectModal" class="modal-overlay" @click.self="showReviewRejectModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>退回补正</h3>
          <button class="btn btn-outline btn-sm" @click="showReviewRejectModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">退回原因（必填）</label>
            <textarea v-model="rejectReason" class="form-textarea" placeholder="请详细说明需要补正的内容"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showReviewRejectModal = false">取消</button>
          <button class="btn btn-danger" @click="rejectReview" :disabled="submitting || !rejectReason.trim()">
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
const { baseRole, currentUserName } = useAuth()
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
const showSubmitModal = ref(false)
const showReviewApproveModal = ref(false)
const showReviewRejectModal = ref(false)
const showConfirmModal = ref(false)

const submitRemark = ref('')
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

const processSteps = computed(() => {
  if (!workorder.value) return []

  const isPlanner = baseRole.value === 'planner' && workorder.value.planner === currentUserName.value
  const isWorkshopDirector = baseRole.value === 'workshop_director' && workorder.value.workshop_director === currentUserName.value
  const isFactoryManager = baseRole.value === 'factory_manager' && workorder.value.factory_manager === currentUserName.value

  const isPending = workorder.value.status === 'pending_correction'
  const isUnderReview = workorder.value.status === 'under_review'

  const hasSchedule = !!workorder.value.production_schedule
  const hasMaterial = !!workorder.value.material_issue
  const hasCompletion = !!workorder.value.completion_report

  const scheduleActive = isPending && !hasSchedule && isPlanner
  const materialActive = isPending && hasSchedule && !hasMaterial
  const completionActive = isPending && hasMaterial && !hasCompletion
  const allReady = hasSchedule && hasMaterial && hasCompletion

  const reviewActive = isUnderReview && isWorkshopDirector && workorder.value.current_handler_role === 'workshop_director'
  const confirmActive = isUnderReview && isFactoryManager && workorder.value.current_handler_role === 'factory_manager'

  return [
    {
      key: 'schedule',
      title: '生产排程',
      description: '安排生产时间、车间和生产线',
      responsible: workorder.value.planner,
      status: hasSchedule ? 'completed' : scheduleActive ? 'active' : 'pending',
      canEdit: scheduleActive,
      canSubmit: false,
      actionText: '去排程',
      data: workorder.value.production_schedule
    },
    {
      key: 'material',
      title: '领料确认',
      description: '确认原材料领用情况',
      responsible: workorder.value.workshop_director,
      status: hasMaterial ? 'completed' : materialActive ? 'active' : 'pending',
      canEdit: materialActive && (isPlanner || isWorkshopDirector),
      canSubmit: false,
      actionText: '去领料',
      data: workorder.value.material_issue
    },
    {
      key: 'completion',
      title: '完工报工',
      description: '报告生产完成情况和质检结果',
      responsible: workorder.value.workshop_director,
      status: hasCompletion ? 'completed' : completionActive ? 'active' : 'pending',
      canEdit: completionActive && (isPlanner || isWorkshopDirector),
      canSubmit: false,
      actionText: '去报工',
      data: workorder.value.completion_report
    },
    {
      key: 'review',
      title: '车间复核',
      description: '车间主任审核生产信息',
      responsible: workorder.value.workshop_director,
      status: workorder.value.status === 'completed' ? 'completed'
              : reviewActive ? 'active'
              : (isUnderReview && workorder.value.current_handler_role === 'workshop_director') ? 'active'
              : allReady ? 'pending' : 'pending',
      canEdit: false,
      canSubmit: reviewActive,
      actionText: '去复核',
      data: null
    },
    {
      key: 'confirm',
      title: '厂务办结',
      description: '厂务经理最终确认',
      responsible: workorder.value.factory_manager,
      status: workorder.value.status === 'completed' ? 'completed'
              : confirmActive ? 'active'
              : (isUnderReview && workorder.value.current_handler_role === 'factory_manager') ? 'active'
              : 'pending',
      canEdit: false,
      canSubmit: confirmActive,
      actionText: '去办结',
      data: null
    }
  ]
})

const currentStepHint = computed(() => {
  const activeStep = processSteps.value.find(s => s.status === 'active')
  if (activeStep) {
    return `${activeStep.title} - ${activeStep.description}（责任人：${activeStep.responsible}）`
  }
  if (workorder.value?.status === 'completed') {
    return '该工单已办结'
  }
  return '等待处理'
})

const canSubmitForReview = computed(() => {
  if (!workorder.value) return false
  if (workorder.value.status !== 'pending_correction') return false
  if (baseRole.value !== 'planner') return false
  if (workorder.value.planner !== currentUserName.value) return false
  return workorder.value.production_schedule
    && workorder.value.material_issue
    && workorder.value.completion_report
})

const canReview = computed(() => {
  if (!workorder.value) return false
  if (workorder.value.status !== 'under_review') return false
  if (baseRole.value !== 'workshop_director') return false
  return workorder.value.workshop_director === currentUserName.value
})

const canConfirm = computed(() => {
  if (!workorder.value) return false
  if (workorder.value.status !== 'under_review') return false
  if (baseRole.value !== 'factory_manager') return false
  return workorder.value.factory_manager === currentUserName.value
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

function openStepModal(key: string) {
  switch (key) {
    case 'schedule':
      showScheduleModal.value = true
      break
    case 'material':
      showMaterialModal.value = true
      break
    case 'completion':
      showCompletionModal.value = true
      break
    case 'submit':
      showSubmitModal.value = true
      break
    case 'review_approve':
      showReviewApproveModal.value = true
      break
    case 'review_reject':
      showReviewRejectModal.value = true
      break
    case 'confirm':
      showConfirmModal.value = true
      break
  }
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
      scheduleForm.value = { ...workorder.value.production_schedule }
    }
    if (workorder.value.material_issue) {
      materialForm.value = {
        ...workorder.value.material_issue,
        materials: workorder.value.material_issue.materials || [{ name: '', quantity: 0, unit: '' }]
      }
    }
    if (workorder.value.completion_report) {
      completionForm.value = { ...workorder.value.completion_report }
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
    successMsg.value = '生产排程保存成功，正在进入领料确认...'
    showScheduleModal.value = false
    await loadDetail()
    setTimeout(() => {
      successMsg.value = ''
      if (!workorder.value.material_issue) {
        showMaterialModal.value = true
      }
    }, 500)
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
    successMsg.value = '领料确认保存成功，正在进入完工报工...'
    showMaterialModal.value = false
    await loadDetail()
    setTimeout(() => {
      successMsg.value = ''
      if (!workorder.value.completion_report) {
        showCompletionModal.value = true
      }
    }, 500)
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
    successMsg.value = '完工报工保存成功，可以提交复核'
    showCompletionModal.value = false
    await loadDetail()
    setTimeout(() => {
      successMsg.value = ''
      if (canSubmitForReview.value) {
        showSubmitModal.value = true
      }
    }, 500)
  } else {
    error.value = res.error || '保存失败'
  }

  submitting.value = false
}

async function submitForReview() {
  submitting.value = true
  error.value = ''

  const res = await post(`/workorders/${workorder.value.id}/submit`, {
    version: workorder.value.version,
    remark: submitRemark.value
  })

  if (res.success && res.data) {
    successMsg.value = '已提交复核'
    showSubmitModal.value = false
    submitRemark.value = ''
    await loadDetail()
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
    successMsg.value = '复核通过，已提交厂务经理确认'
    showReviewApproveModal.value = false
    reviewRemark.value = ''
    await loadDetail()
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
    showReviewRejectModal.value = false
    rejectReason.value = ''
    await loadDetail()
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
    confirmRemark.value = ''
    await loadDetail()
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
    await loadDetail()
  } else {
    error.value = res.error || '添加失败'
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.process-timeline {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 20px;
}

.process-step {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border-radius: 8px;
  background: white;
  border: 2px solid #e5e7eb;
  text-align: center;
  min-height: 120px;
}

.step-completed {
  border-color: #16a34a;
  background: #f0fdf4;
}

.step-active {
  border-color: #2563eb;
  background: #eff6ff;
}

.step-overdue {
  border-color: #dc2626;
  background: #fef2f2;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.step-pending {
  opacity: 0.6;
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 8px;
  color: #6b7280;
}

.step-completed .step-number {
  background: #16a34a;
  color: white;
}

.step-active .step-number {
  background: #2563eb;
  color: white;
}

.step-overdue .step-number {
  background: #dc2626;
  color: white;
}

.step-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}

.step-desc {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 6px;
}

.step-responsible {
  font-size: 11px;
  color: #374151;
  margin-bottom: 8px;
}

.step-action {
  margin-top: auto;
}

.step-line {
  position: absolute;
  top: 30px;
  right: -4px;
  width: 8px;
  height: 2px;
  background: #e5e7eb;
}

.line-completed {
  background: #16a34a;
}

.card-highlight {
  border-left: 4px solid #2563eb;
}

.card-completed {
  border-left: 4px solid #16a34a;
  opacity: 0.8;
}
</style>
