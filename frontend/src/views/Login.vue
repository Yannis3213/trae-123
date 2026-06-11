<template>
  <div class="login-wrap">
    <div class="login-card">
      <h1 class="login-title">客服呼叫中心</h1>
      <p class="login-subtitle">月底集中处理客服工单系统</p>

      <div class="form-group">
        <label>账号</label>
        <select v-model="username">
          <option value="">请选择演示账号</option>
          <option value="registrar">registrar - 客服登记员</option>
          <option value="supervisor">supervisor - 客服审核主管</option>
          <option value="reviewer">reviewer - 复核负责人</option>
          <option value="agent">agent - 客服坐席</option>
          <option value="qa_supervisor">qa_supervisor - 质检主管</option>
          <option value="cs_manager">cs_manager - 客服经理</option>
        </select>
      </div>

      <div class="form-group">
        <label>密码</label>
        <input type="password" v-model="password" placeholder="默认 123456" />
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <button class="btn btn-primary btn-block" @click="onLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登 录' }}
      </button>

      <div class="demo-users">
        <strong>演示账号说明 (密码均为 123456)：</strong>
        <ul>
          <li><code>registrar</code> 客服登记员</li>
          <li><code>agent</code> 客服坐席</li>
          <li><code>supervisor</code> 审核主管</li>
          <li><code>qa_supervisor</code> 质检主管</li>
          <li><code>reviewer</code> 复核负责人</li>
          <li><code>cs_manager</code> 客服经理</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/index.js'
import { setCurrentUser } from '../stores/auth.js'

const router = useRouter()
const username = ref('')
const password = ref('123456')
const loading = ref(false)
const error = ref('')

async function onLogin() {
  if (!username.value) {
    error.value = '请选择账号'
    return
  }
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const resp = await api.login(username.value, password.value)
    setCurrentUser(resp.user)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
