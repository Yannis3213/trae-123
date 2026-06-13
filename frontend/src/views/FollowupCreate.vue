<template>
  <div class="followup-create">
    <div class="create-header">
      <el-button @click="router.back()" :icon="ArrowLeft">返回</el-button>
      <h2 class="title">新建慢病随访单</h2>
    </div>

    <el-card class="form-card">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <h3 class="section-title">基本信息</h3>
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="患者姓名" prop="patient_name">
              <el-input v-model="form.patient_name" placeholder="请输入患者姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="身份证号" prop="id_card">
              <el-input v-model="form.id_card" placeholder="请输入身份证号" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="性别" prop="gender">
              <el-select v-model="form.gender" placeholder="请选择性别" style="width: 100%">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="年龄" prop="age">
              <el-input-number v-model="form.age" :min="0" :max="150" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="居住地址">
              <el-input v-model="form.address" placeholder="请输入居住地址" />
            </el-form-item>
          </el-col>
        </el-row>

        <h3 class="section-title">随访信息</h3>
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="慢病类型" prop="chronic_type">
              <el-select v-model="form.chronic_type" placeholder="请选择慢病类型" style="width: 100%">
                <el-option label="高血压" value="高血压" />
                <el-option label="糖尿病" value="糖尿病" />
                <el-option label="高血压、糖尿病" value="高血压、糖尿病" />
                <el-option label="冠心病" value="冠心病" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="随访类型" prop="followup_type">
              <el-select v-model="form.followup_type" placeholder="请选择随访类型" style="width: 100%">
                <el-option label="常规随访" value="常规随访" />
                <el-option label="重点随访" value="重点随访" />
                <el-option label="首次随访" value="首次随访" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="到期日期" prop="due_date">
              <el-date-picker v-model="form.due_date" type="datetime" placeholder="请选择到期日期" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <h3 class="section-title">体征信息</h3>
        <el-row :gutter="24">
          <el-col :span="6">
            <el-form-item label="血压">
              <el-input v-model="form.blood_pressure" placeholder="如：130/85" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="血糖">
              <el-input v-model="form.blood_sugar" placeholder="如：6.5" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="心率">
              <el-input v-model="form.heart_rate" placeholder="如：78" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="体重(kg)">
              <el-input v-model="form.weight" placeholder="如：75" />
            </el-form-item>
          </el-col>
        </el-row>

        <h3 class="section-title">其他信息</h3>
        <el-form-item label="症状描述">
          <el-input v-model="form.symptoms" type="textarea" :rows="2" placeholder="请描述患者症状" />
        </el-form-item>
        <el-form-item label="生活方式">
          <el-input v-model="form.lifestyle" type="textarea" :rows="2" placeholder="请描述患者生活方式" />
        </el-form-item>
        <el-form-item label="用药依从性">
          <el-select v-model="form.medication_compliance" placeholder="请选择" style="width: 300px">
            <el-option label="良好" value="良好" />
            <el-option label="一般" value="一般" />
            <el-option label="差" value="差" />
          </el-select>
        </el-form-item>

        <div class="form-actions">
          <el-button @click="router.back()">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存草稿</el-button>
          <el-button type="success" :loading="saving" @click="handleSaveAndSubmit">保存并提交</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { createFollowupApi, submitFollowupApi, uploadAttachmentApi } from '../api/followup'

const router = useRouter()
const formRef = ref(null)
const saving = ref(false)

const form = reactive({
  patient_name: '',
  id_card: '',
  gender: '',
  age: null,
  phone: '',
  address: '',
  chronic_type: '',
  followup_type: '',
  due_date: dayjs().add(7, 'day').toDate(),
  blood_pressure: '',
  blood_sugar: '',
  heart_rate: '',
  weight: '',
  symptoms: '',
  lifestyle: '',
  medication_compliance: ''
})

const rules = {
  patient_name: [{ required: true, message: '请输入患者姓名', trigger: 'blur' }],
  id_card: [{ required: true, message: '请输入身份证号', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  chronic_type: [{ required: true, message: '请选择慢病类型', trigger: 'change' }],
  followup_type: [{ required: true, message: '请选择随访类型', trigger: 'change' }],
  due_date: [{ required: true, message: '请选择到期日期', trigger: 'change' }]
}

async function handleSave() {
  try {
    await formRef.value.validate()
    saving.value = true
    const res = await createFollowupApi({
      ...form,
      due_date: form.due_date ? form.due_date.toISOString() : null
    })
    ElMessage.success('保存成功')
    router.push(`/followup/${res.id}`)
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

async function handleSaveAndSubmit() {
  try {
    await formRef.value.validate()
    saving.value = true
    const res = await createFollowupApi({
      ...form,
      due_date: form.due_date ? form.due_date.toISOString() : null
    })
    
    await uploadAttachmentApi(res.id, {
      type: 'followup_form',
      name: `随访单_${form.patient_name}.pdf`,
      url: `/files/followup_${res.id}.pdf`,
      size: 0
    })
    
    await submitFollowupApi(res.id, { version: 1, remark: '新建并提交' })
    
    ElMessage.success('提交成功')
    router.push(`/followup/${res.id}`)
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.followup-create {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.form-card {
  border-radius: 8px;
}

.section-title {
  margin: 20px 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  padding-left: 12px;
  border-left: 4px solid #409eff;
}

.form-actions {
  margin-top: 24px;
  text-align: right;
}

.form-actions .el-button {
  margin-left: 12px;
}
</style>
