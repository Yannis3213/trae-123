<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <el-icon :size="48" color="#409EFF">
          <OfficeBuilding />
        </el-icon>
        <h1>园区招商中心</h1>
        <p>月底集中处理招商线索单系统</p>
      </div>
      
      <el-form 
        ref="loginForm" 
        :model="form" 
        :rules="rules" 
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input 
            v-model="form.username" 
            placeholder="请输入用户名" 
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input 
            v-model="form.password" 
            type="password" 
            placeholder="请输入密码" 
            size="large"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <el-button 
          type="primary" 
          size="large" 
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          登录系统
        </el-button>
      </el-form>

      <div class="quick-login">
        <p class="quick-title">快速角色切换（演示用）</p>
        <div class="role-buttons">
          <el-button 
            v-for="role in roleList" 
            :key="role.username"
            size="small"
            :type="activeRole === role.username ? 'primary' : 'default'"
            @click="quickLogin(role)"
          >
            {{ role.name }}
          </el-button>
        </div>
        <p class="tip-text">默认密码：123456</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, OfficeBuilding } from '@element-plus/icons-vue';
import { useAuthStore } from '../store/auth';
import { ROLE_LABELS } from '../utils/config';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loginForm = ref(null);
const loading = ref(false);
const activeRole = ref('');

const form = reactive({
  username: '',
  password: ''
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

const roleList = [
  { username: 'registrar1', name: `${ROLE_LABELS.registrar} - 张登记`, role: 'registrar' },
  { username: 'registrar2', name: `${ROLE_LABELS.registrar} - 赵专员`, role: 'registrar' },
  { username: 'auditor1', name: `${ROLE_LABELS.auditor} - 李审核`, role: 'auditor' },
  { username: 'auditor2', name: `${ROLE_LABELS.auditor} - 刘主管`, role: 'auditor' },
  { username: 'reviewer1', name: `${ROLE_LABELS.reviewer} - 王复核`, role: 'reviewer' }
];

async function handleLogin() {
  if (!loginForm.value) return;
  
  try {
    await loginForm.value.validate();
  } catch (e) {
    return;
  }

  loading.value = true;
  try {
    await authStore.login(form.username, form.password);
    const redirect = route.query.redirect || '/clues';
    ElMessage.success('登录成功');
    router.push(redirect);
  } catch (e) {
    console.error('登录失败:', e);
  } finally {
    loading.value = false;
  }
}

async function quickLogin(role) {
  activeRole.value = role.username;
  form.username = role.username;
  form.password = '123456';
  
  loading.value = true;
  try {
    await authStore.login(role.username, '123456');
    const redirect = route.query.redirect || '/clues';
    ElMessage.success(`已切换为 ${role.name}`);
    router.push(redirect);
  } catch (e) {
    console.error('快速登录失败:', e);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-box {
  width: 100%;
  max-width: 450px;
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 15px 0 8px;
  font-weight: 600;
}

.login-header p {
  color: #909399;
  font-size: 14px;
}

.login-form {
  margin-bottom: 25px;
}

.login-btn {
  width: 100%;
  margin-top: 10px;
}

.quick-login {
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.quick-title {
  text-align: center;
  color: #909399;
  font-size: 13px;
  margin-bottom: 12px;
}

.role-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.tip-text {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  margin-top: 12px;
}
</style>
