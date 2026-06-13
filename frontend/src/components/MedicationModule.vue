<template>
  <div class="module-container">
    <div class="module-header">
      <h3>用药提醒管理</h3>
      <div class="search-bar">
        <el-input v-model="searchIdCard" placeholder="输入身份证号查询" style="width: 250px">
          <template #append>
            <el-button @click="searchReminders">查询</el-button>
          </template>
        </el-input>
        <el-button type="primary" style="margin-left: 8px" @click="handleAdd">新增提醒</el-button>
      </div>
    </div>

    <el-table :data="reminders" v-loading="loading" border stripe>
      <el-table-column prop="drug_name" label="药品名称" width="180" />
      <el-table-column prop="dosage" label="剂量" width="120" />
      <el-table-column prop="frequency" label="用法" width="120" />
      <el-table-column prop="start_date" label="开始日期" width="120">
        <template #default="{ row }">{{ formatDate(row.start_date) }}</template>
      </el-table-column>
      <el-table-column prop="end_date" label="结束日期" width="120">
        <template #default="{ row }">{{ formatDate(row.end_date) }}</template>
      </el-table-column>
      <el-table-column prop="notes" label="备注" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && reminders.length === 0" description="暂无用药提醒" />

    <el-dialog v-model="editDialog.visible" :title="isNew ? '新增用药提醒' : '编辑用药提醒'" width="600px">
      <el-form :model="editForm" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="患者姓名" prop="patient_name">
          <el-input v-model="editForm.patient_name" />
        </el-form-item>
        <el-form-item label="身份证号" prop="patient_id_card">
          <el-input v-model="editForm.patient_id_card" />
        </el-form-item>
        <el-form-item label="药品名称" prop="drug_name">
          <el-input v-model="editForm.drug_name" />
        </el-form-item>
        <el-form-item label="剂量" prop="dosage">
          <el-input v-model="editForm.dosage" placeholder="如：500mg" />
        </el-form-item>
        <el-form-item label="用法" prop="frequency">
          <el-select v-model="editForm.frequency" style="width: 100%">
            <el-option label="每日1次" value="每日1次" />
            <el-option label="每日2次" value="每日2次" />
            <el-option label="每日3次" value="每日3次" />
            <el-option label="每周1次" value="每周1次" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期" prop="start_date">
          <el-date-picker v-model="editForm.start_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期" prop="end_date">
          <el-date-picker v-model="editForm.end_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.notes" type="textarea" :rows="2" placeholder="如：早餐后服用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveReminder">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { getMedicationRemindersApi, createMedicationReminderApi, updateMedicationReminderApi, deleteMedicationReminderApi } from '../api/medication'

const searchIdCard = ref('')
const reminders = ref([])
const loading = ref(false)
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
  drug_name: '',
  dosage: '',
  frequency: '',
  start_date: '',
  end_date: '',
  notes: ''
})

const rules = {
  patient_name: [{ required: true, message: '请输入患者姓名', trigger: 'blur' }],
  patient_id_card: [{ required: true, message: '请输入身份证号', trigger: 'blur' }],
  drug_name: [{ required: true, message: '请输入药品名称', trigger: 'blur' }],
  dosage: [{ required: true, message: '请输入剂量', trigger: 'blur' }],
  frequency: [{ required: true, message: '请选择用法', trigger: 'change' }],
  start_date: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择结束日期', trigger: 'change' }]
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD') : '-'
}

async function searchReminders() {
  if (!searchIdCard.value) {
    ElMessage.warning('请输入身份证号')
    return
  }
  loading.value = true
  try {
    const res = await getMedicationRemindersApi(searchIdCard.value)
    reminders.value = res
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  isNew.value = true
  Object.assign(editForm, {
    id: null,
    patient_name: '',
    patient_id_card: searchIdCard.value || '',
    drug_name: '',
    dosage: '',
    frequency: '',
    start_date: '',
    end_date: '',
    notes: ''
  })
  editDialog.visible = true
}

function handleEdit(row) {
  isNew.value = false
  Object.assign(editForm, row)
  editDialog.visible = true
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除该用药提醒吗？', '提示', { type: 'warning' })
    await deleteMedicationReminderApi(row.id)
    ElMessage.success('删除成功')
    searchReminders()
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err)
    }
  }
}

async function saveReminder() {
  try {
    await formRef.value.validate()
    saving.value = true
    
    if (isNew.value || !editForm.id) {
      await createMedicationReminderApi(editForm)
      ElMessage.success('创建成功')
    } else {
      await updateMedicationReminderApi(editForm.id, editForm)
      ElMessage.success('更新成功')
    }
    
    editDialog.visible = false
    searchReminders()
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
</style>
