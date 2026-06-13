<template>
  <div class="module-container">
    <div class="module-header">
      <h3>慢病随访单登记</h3>
      <el-button type="primary" @click="router.push('/followup/create')" v-if="userStore.isTriageNurse">
        <el-icon><Plus /></el-icon>新建随访单
      </el-button>
    </div>

    <div class="quick-stats">
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="quick-stat-item">
            <div class="stat-value">{{ recentCount }}</div>
            <div class="stat-label">本月登记</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="quick-stat-item">
            <div class="stat-value">{{ pendingCount }}</div>
            <div class="stat-label">待处理</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="quick-stat-item">
            <div class="stat-value">{{ completedCount }}</div>
            <div class="stat-label">已完成</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-alert
      title="登记说明"
      type="info"
      :closable="false"
      show-icon
      class="info-alert"
    >
      <template #default>
        <ul>
          <li>导诊护士负责新建随访单，填写患者基本信息和随访内容</li>
          <li>提交后流转到全科医生处理，需要上传随访单作为证据</li>
          <li>状态变更时系统自动记录版本和审计轨迹，确保可追溯</li>
          <li>慢病档案或用药提醒缺项时，可从详情页快速补正</li>
        </ul>
      </template>
    </el-alert>

    <el-table :data="recentList" v-loading="loading" border stripe size="small">
      <el-table-column prop="id" label="单据号" width="80" />
      <el-table-column prop="patient_name" label="患者姓名" width="100" />
      <el-table-column prop="chronic_type" label="慢病类型" width="120" />
      <el-table-column prop="followup_type" label="随访类型" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="STATUS_COLORS[row.status]" size="small">{{ row.statusName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="creator_name" label="登记人" width="100" />
      <el-table-column prop="created_at" label="登记时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && recentList.length === 0" description="暂无登记记录" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useUserStore } from '../stores/user'
import { getFollowupListApi } from '../api/followup'
import { STATUS_NAMES, STATUS_COLORS } from '../types'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const recentList = ref([])
const recentCount = ref(0)
const pendingCount = ref(0)
const completedCount = ref(0)

function formatDateTime(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}

async function fetchRecent() {
  loading.value = true
  try {
    const res = await getFollowupListApi({ pageSize: 10, page: 1 })
    recentList.value = res.list.map(item => ({
      ...item,
      statusName: STATUS_NAMES[item.status]
    }))
    recentCount.value = res.total
    pendingCount.value = res.list.filter(r => ['pending_submit', 'resubmitted', 'doctor_processing'].includes(r.status)).length
    completedCount.value = res.list.filter(r => ['completed', 'archived'].includes(r.status)).length
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchRecent()
})
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

.quick-stats {
  margin-bottom: 16px;
}

.quick-stat-item {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #ebeef5;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

.info-alert {
  margin-bottom: 16px;
}

.info-alert ul {
  margin: 0;
  padding-left: 20px;
  color: #606266;
  font-size: 13px;
}

.info-alert li {
  margin: 4px 0;
}
</style>
