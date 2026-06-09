<template>
  <div>
    <div class="card">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="num">{{ stats.total || 0 }}</div>
          <div class="label">全部单据</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#409eff;">{{ stats.pending || 0 }}</div>
          <div class="label">待派发</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#e6a23c;">{{ stats.in_progress || 0 }}</div>
          <div class="label">处理中</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#67c23a;">{{ stats.closed || 0 }}</div>
          <div class="label">已关闭</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#67c23a;">{{ stats.warning_normal || 0 }}</div>
          <div class="label">🟢 正常</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#e6a23c;">{{ stats.warning_approaching || 0 }}</div>
          <div class="label">🟡 临期</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#f56c6c;">{{ stats.warning_overdue || 0 }}</div>
          <div class="label">🔴 逾期</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">筛选条件</h3>
      <div class="form-row">
        <div class="form-item">
          <label>状态</label>
          <select v-model="query.status" @change="loadData">
            <option value="">全部</option>
            <option value="待派发">待派发</option>
            <option value="处理中">处理中</option>
            <option value="已关闭">已关闭</option>
          </select>
        </div>
        <div class="form-item">
          <label>到期预警</label>
          <select v-model="query.warning" @change="loadData">
            <option value="">全部</option>
            <option value="正常">🟢 正常</option>
            <option value="临期">🟡 临期</option>
            <option value="逾期">🔴 逾期</option>
          </select>
        </div>
        <div class="form-item">
          <label>关键词</label>
          <input
            v-model="query.keyword"
            placeholder="计划单号 / 老人姓名 / 房间号"
            @keyup.enter="loadData"
          />
        </div>
        <div class="form-item" style="flex: 0 0 auto;">
          <label>&nbsp;</label>
          <div class="flex gap-8">
            <button class="btn btn-primary" @click="loadData">查询</button>
            <button class="btn" @click="resetQuery">重置</button>
            <button class="btn btn-success" @click="showCreate = true">新建计划单</button>
            <button class="btn btn-info" @click="doExport">📤 导出</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex justify-between items-center mb-16">
        <h3 class="section-title" style="margin: 0; border: none; padding: 0;">
          护理计划单队列（按到期时间排序）
        </h3>
        <div class="flex gap-8">
          <span style="font-size:12px;color:#909399;">已选 {{ selectedIds.length }} / {{ plans.length }} 条</span>
          <button
            v-if="auth.currentRole === 'registrar'"
            class="btn btn-primary btn-sm"
            :disabled="selectedIds.length === 0"
            @click="doBatch('dispatch')"
          >批量派发</button>
          <button
            v-if="auth.currentRole === 'supervisor'"
            class="btn btn-primary btn-sm"
            :disabled="selectedIds.length === 0"
            @click="doBatch('submit')"
          >批量提交复核</button>
          <button
            v-if="auth.currentRole === 'director'"
            class="btn btn-success btn-sm"
            :disabled="selectedIds.length === 0"
            @click="doBatch('review')"
          >批量复核归档</button>
        </div>
      </div>

      <div class="tabs mb-16">
        <div
          class="tab"
          :class="{ active: currentTab === 'all' }"
          @click="currentTab = 'all'"
        >全部 ({{ plans.length }})</div>
        <div
          class="tab"
          :class="{ active: currentTab === 'normal' }"
          @click="currentTab = 'normal'"
        >🟢 正常 ({{ normalPlans.length }})</div>
        <div
          class="tab"
          :class="{ active: currentTab === 'approaching' }"
          @click="currentTab = 'approaching'"
        >🟡 临期 ({{ approachingPlans.length }})</div>
        <div
          class="tab"
          :class="{ active: currentTab === 'overdue' }"
          @click="currentTab = 'overdue'"
        >🔴 逾期 ({{ overduePlans.length }})</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px;"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
            <th>计划单号</th>
            <th>老人姓名</th>
            <th>房间号</th>
            <th>入住日期</th>
            <th>状态</th>
            <th>预警</th>
            <th>当前处理人</th>
            <th>责任人</th>
            <th>截止日期</th>
            <th>入住评估</th>
            <th>护理计划</th>
            <th>家属确认</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in displayPlans" :key="p.id">
            <td><input type="checkbox" :value="p.id" v-model="selectedIds" /></td>
            <td><strong>{{ p.plan_no }}</strong></td>
            <td>{{ p.elder_name }}</td>
            <td>{{ p.room_no }}</td>
            <td>{{ p.admission_date }}</td>
            <td>
              <span v-if="p.status === '待派发'" class="tag tag-pending">{{ p.status }}</span>
              <span v-else-if="p.status === '处理中'" class="tag tag-progress">{{ p.status }}</span>
              <span v-else class="tag tag-closed">{{ p.status }}</span>
            </td>
            <td>
              <span v-if="p.warning_level === '正常'" class="tag tag-normal">🟢 {{ p.warning_level }}</span>
              <span v-else-if="p.warning_level === '临期'" class="tag tag-approaching">🟡 {{ p.warning_level }}</span>
              <span v-else-if="p.warning_level === '逾期'" class="tag tag-overdue">🔴 {{ p.warning_level }}</span>
              <span v-else>-</span>
            </td>
            <td>{{ p.current_handler }}</td>
            <td>{{ p.responsible_person }}</td>
            <td>{{ p.deadline }}</td>
            <td>
              <span v-if="p.assessment_done" style="color:#67c23a;">✓ 已完成</span>
              <span v-else style="color:#f56c6c;">✗ 未完成</span>
            </td>
            <td>
              <span v-if="p.plan_done" style="color:#67c23a;">✓ 已完成</span>
              <span v-else style="color:#f56c6c;">✗ 未完成</span>
            </td>
            <td>
              <span v-if="p.family_confirmed" style="color:#67c23a;">✓ 已确认</span>
              <span v-else style="color:#f56c6c;">✗ 未确认</span>
            </td>
            <td>
              <button class="btn btn-primary btn-sm" @click="goDetail(p.id)">详情办理</button>
            </td>
          </tr>
          <tr v-if="displayPlans.length === 0">
            <td colspan="14" style="text-align:center;padding:32px;color:#909399;">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-title">新建护理计划单</div>
        <div class="form-row">
          <div class="form-item">
            <label>老人姓名 *</label>
            <input v-model="createForm.elder_name" />
          </div>
          <div class="form-item">
            <label>身份证号 *</label>
            <input v-model="createForm.elder_id_card" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>房间号 *</label>
            <input v-model="createForm.room_no" />
          </div>
          <div class="form-item">
            <label>入住日期 *</label>
            <input type="date" v-model="createForm.admission_date" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>截止日期 *</label>
            <input type="date" v-model="createForm.deadline" />
          </div>
        </div>
        <div class="flex justify-end gap-8 mt-16">
          <button class="btn" @click="showCreate = false">取消</button>
          <button class="btn btn-primary" @click="doCreate">确认创建</button>
        </div>
      </div>
    </div>

    <div v-if="batchResults.length > 0" class="modal-mask" @click.self="batchResults = []">
      <div class="modal" style="min-width: 700px;">
        <div class="modal-title">批量处理结果</div>
        <table>
          <thead>
            <tr>
              <th>计划单号</th>
              <th>结果</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in batchResults" :key="r.plan_id">
              <td>{{ r.plan_no }}</td>
              <td>
                <span v-if="r.success" class="tag tag-closed">✓ 成功</span>
                <span v-else class="tag tag-overdue">✗ 失败</span>
              </td>
              <td>{{ r.message }}</td>
            </tr>
          </tbody>
        </table>
        <div class="flex justify-end mt-16">
          <button class="btn btn-primary" @click="batchResults = []; loadData()">关闭并刷新</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { api } from '~/composables/api'
import type { CarePlan, BatchResult, CreatePlanRequest } from '~/types'

const auth = useAuthStore()
const router = useRouter()

const plans = ref<CarePlan[]>([])
const stats = ref<any>({})
const selectedIds = ref<string[]>([])
const currentTab = ref('all')
const showCreate = ref(false)
const batchResults = ref<BatchResult[]>([])

const query = reactive({
  status: '' as string,
  warning: '' as string,
  keyword: '' as string,
})

const createForm = reactive<CreatePlanRequest>({
  elder_name: '',
  elder_id_card: '',
  room_no: '',
  admission_date: new Date().toISOString().slice(0, 10),
  deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
})

const normalPlans = computed(() => plans.value.filter(p => p.warning_level === '正常'))
const approachingPlans = computed(() => plans.value.filter(p => p.warning_level === '临期'))
const overduePlans = computed(() => plans.value.filter(p => p.warning_level === '逾期'))

const displayPlans = computed(() => {
  switch (currentTab.value) {
    case 'normal': return normalPlans.value
    case 'approaching': return approachingPlans.value
    case 'overdue': return overduePlans.value
    default: return plans.value
  }
})

const allSelected = computed({
  get: () => displayPlans.value.length > 0 && displayPlans.value.every(p => selectedIds.value.includes(p.id)),
  set: (v: boolean) => {
    if (v) {
      selectedIds.value = displayPlans.value.map(p => p.id)
    } else {
      selectedIds.value = []
    }
  },
})

watch(() => auth.currentRole, () => loadData())

async function loadData() {
  const [planRes, statsRes] = await Promise.all([
    api.listPlans(query),
    api.getStats(),
  ])
  if (planRes.success && planRes.data) plans.value = planRes.data
  if (statsRes.success && statsRes.data) stats.value = statsRes.data
  selectedIds.value = []
}

function resetQuery() {
  query.status = ''
  query.warning = ''
  query.keyword = ''
  loadData()
}

function goDetail(id: string) {
  router.push(`/plan/${id}`)
}

async function doCreate() {
  if (!createForm.elder_name || !createForm.elder_id_card || !createForm.room_no) {
    alert('请填写必填项')
    return
  }
  const res = await api.createPlan({ ...createForm })
  if (res.success) {
    showCreate.value = false
    createForm.elder_name = ''
    createForm.elder_id_card = ''
    createForm.room_no = ''
    loadData()
    alert('创建成功')
  } else {
    alert('创建失败：' + res.message)
  }
}

async function doBatch(action: string) {
  if (selectedIds.value.length === 0) return
  const res = await api.batchAction({ plan_ids: selectedIds.value, action })
  if (res.success && res.data) {
    batchResults.value = res.data
  } else {
    alert('批量操作失败：' + res.message)
  }
}

async function doExport() {
  await api.exportPlans(query)
}

onMounted(() => loadData())
</script>
