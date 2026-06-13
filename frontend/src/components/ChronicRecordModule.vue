<template>
  <div class="module-container">
    <div class="module-header">
      <h3>慢病档案管理</h3>
      <div class="search-bar">
        <el-input v-model="searchIdCard" placeholder="输入身份证号查询" style="width: 250px">
          <template #append>
            <el-button @click="searchRecord">查询</el-button>
          </template>
        </el-input>
      </div>
    </div>

    <div v-if="record" class="record-card">
      <el-descriptions :column="3" border>
        <el-descriptions-item label="患者姓名">{{ record.patient_name }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ record.patient_id_card }}</el-descriptions-item>
        <el-descriptions-item label="确诊日期">{{ formatDate(record.diagnosis_date) }}</el-descriptions-item>
        <el-descriptions-item label="慢病类型">{{ record.chronic_type }}</el-descriptions-item>
        <el-descriptions-item label="严重程度">
          <el-tag :type="severityType(record.severity)">{{ record.severity }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="并发症">{{ record.complications || '无' }}</el-descriptions-item>
        <el-descriptions-item label="治疗史" :span="3">{{ record.treatment_history || '无' }}</el-descriptions-item>
      </el-descriptions>
      <div class="action-bar">
        <el-button type="primary" @click="editDialog.visible = true">编辑档案</el-button>
      </div>
    </div>

    <el-empty v-else description="请输入身份证号查询或新增慢病档案">
      <el-button type="primary" @click="editDialog.visible = true; isNew = true">新增档案</el-button>
    </el-empty>

    <el-dialog v-model="editDialog.visible" :title="isNew ? '新增慢病档案' : '编辑慢病档案'" width="600px">
      <el-form :model="editForm" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="患者姓名" prop="patient_name">
          <el-input v-model="editForm.patient_name" />
        </el-form-item>
        <el-form-item label="身份证号" prop="patient_id_card">
          <el-input v-model="editForm.patient_id_card" :disabled="!isNew" />
        </el-form-item>
        <el-form-item label="确诊日期" prop="diagnosis_date">
          <el-date-picker v-model="editForm.diagnosis_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="慢病类型" prop="chronic_type">
          <el-select v-model="editForm.chronic_type" style="width: 100%">
            <el-option label="高血压" value="高血压" />
            <el-option label="2型糖尿病" value="2型糖尿病" />
            <el-option label="冠心病" value="冠心病" />
            <el-option label="高血压3级" value="高血压3级" />
          </el-select>
        </el-form-item>
        <el-form-item label="严重程度" prop="severity">
          <el-select v-model="editForm.severity" style="width: 100%">
            <el-option label="轻度" value="轻度" />
            <el-option label="中度" value="中度" />
            <el-option label="重度" value="重度" />
          </el-select>
        </el-form-item>
        <el-form-item label="并发症">
          <el-input v-model="editForm.complications" placeholder="无" />
        </el-form-item>
        <el-form-item label="治疗史">
          <el-input v-model="editForm.treatment_history" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getChronicRecordApi, createChronicRecordApi, updateChronicRecordApi } from '../api/chronicRecord'

const searchIdCard = ref('')
const record = ref(null)
const isNew = ref(false)
const saving = ref(false)
const formRef = ref(null)

const editDialog = reactive({
  visible: false
})

const editForm = reactive({
  id: null,
  patient_name: '',
  patient_id_card: '',
  diagnosis_date: '',
  chronic_type: '',
  severity: '',
  complications: '',
  treatment_history: ''
})

const rules = {
  patient_name: [{ required: true, message: '请输入患者姓名', trigger: 'blur' }],
  patient_id_card: [{ required: true, message: '请输入身份证号', trigger: 'blur' }],
  diagnosis_date: [{ required: true, message: '请选择确诊日期', trigger: 'change' }],
  chronic_type: [{ required: true, message: '请选择慢病类型', trigger: 'change' }],
  severity: [{ required: true, message: '请选择严重程度', trigger: 'change' }]
}

function severityType(severity) {
  const types = { '轻度': 'success', '中度': 'warning', '重度': 'danger' }
  return types[severity] || 'info'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD') : '-'
}

async function searchRecord() {
  if (!searchIdCard.value) {
    ElMessage.warning('请输入身份证号')
    return
  }
  try {
    const res = await getChronicRecordApi(searchIdCard.value)
    record.value = res
    isNew.value = !res
    if (res) {
      Object.assign(editForm, res)
    }
  } catch (err) {
    console.error(err)
  }
}

async function saveRecord() {
  try {
    await formRef.value.validate()
    saving.value = true
    
    if (isNew.value || !editForm.id) {
      await createChronicRecordApi(editForm)
      ElMessage.success('档案创建成功')
    } else {
      await updateChronicRecordApi(editForm.id, editForm)
      ElMessage.success('档案更新成功')
    }
    
    editDialog.visible = false
    searchRecord()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.module-container {
  padding: 16px 0;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.module-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.record-card {
  background: #fafafa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.action-bar {
  margin-top: 16px;
  text-align: right;
}
</style>
