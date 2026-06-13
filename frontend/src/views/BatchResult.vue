<template>
  <div class="batch-result">
    <div class="result-header">
      <el-button @click="router.back()" :icon="ArrowLeft">返回</el-button>
      <h2 class="title">批量处理结果</h2>
    </div>

    <el-card class="stats-card">
      <el-row :gutter="24">
        <el-col :span="8">
          <div class="stat-item success">
            <div class="stat-number">{{ successCount }}</div>
            <div class="stat-label">成功</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item danger">
            <div class="stat-number">{{ failCount }}</div>
            <div class="stat-label">失败</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item info">
            <div class="stat-number">{{ results.length }}</div>
            <div class="stat-label">总计</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">处理结果明细</span>
          <el-button-group>
            <el-button @click="filterType = 'all'" :type="filterType === 'all' ? 'primary' : ''">全部</el-button>
            <el-button @click="filterType = 'success'" :type="filterType === 'success' ? 'primary' : ''">成功</el-button>
            <el-button @click="filterType = 'fail'" :type="filterType === 'fail' ? 'primary' : ''">失败</el-button>
          </el-button-group>
        </div>
      </template>

      <el-table :data="filteredResults" border stripe>
        <el-table-column prop="id" label="单据号" width="100" />
        <el-table-column label="处理结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" effect="dark">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" v-if="showStatus">
          <template #default="{ row }">
            <el-tag v-if="row.status" :type="STATUS_COLORS[row.status]">
              {{ row.statusName }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="失败原因">
          <template #default="{ row }">
            <span v-if="!row.success" class="fail-reason">{{ row.reason }}</span>
            <span v-else class="success-text">处理成功</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="filteredResults.length === 0" description="暂无记录" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { STATUS_COLORS } from '../types'

const router = useRouter()

const results = ref([])
const filterType = ref('all')

const successCount = computed(() => results.value.filter(r => r.success).length)
const failCount = computed(() => results.value.filter(r => !r.success).length)
const showStatus = computed(() => results.value.some(r => r.status))

const filteredResults = computed(() => {
  if (filterType.value === 'success') {
    return results.value.filter(r => r.success)
  } else if (filterType.value === 'fail') {
    return results.value.filter(r => !r.success)
  }
  return results.value
})

function goToDetail(id) {
  router.push(`/followup/${id}`)
}

onMounted(() => {
  const stored = sessionStorage.getItem('batchResults')
  if (stored) {
    results.value = JSON.parse(stored)
  }
})
</script>

<style scoped>
.batch-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-header {
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

.stats-card {
  border-radius: 8px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
}

.stat-item.success {
  background: linear-gradient(135deg, #67c23a15 0%, #67c23a25 100%);
}

.stat-item.danger {
  background: linear-gradient(135deg, #f56c6c15 0%, #f56c6c25 100%);
}

.stat-item.info {
  background: linear-gradient(135deg, #409eff15 0%, #409eff25 100%);
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-item.success .stat-number {
  color: #67c23a;
}

.stat-item.danger .stat-number {
  color: #f56c6c;
}

.stat-item.info .stat-number {
  color: #409eff;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.list-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.fail-reason {
  color: #f56c6c;
}

.success-text {
  color: #67c23a;
}
</style>
