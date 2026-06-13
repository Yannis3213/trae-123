<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <div class="header-left">
        <el-icon :size="28" color="#fff"><Document /></el-icon>
        <span class="title">社区卫生服务中心 - 慢病随访单管理系统</span>
      </div>
      <div class="header-right">
        <el-tag :type="roleTagType" effect="dark" class="role-tag">
          {{ userStore.roleName }}
        </el-tag>
        <el-dropdown @command="handleCommand">
          <span class="user-info">
            <el-icon><UserFilled /></el-icon>
            {{ userStore.user?.name }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container>
      <el-aside width="220px" class="layout-aside">
        <el-menu
          :default-active="activeMenu"
          router
          class="side-menu"
        >
          <el-menu-item index="/followup">
            <el-icon><List /></el-icon>
            <span>随访单列表</span>
          </el-menu-item>
          <el-menu-item index="/followup/create" v-if="userStore.isTriageNurse">
            <el-icon><Plus /></el-icon>
            <span>新建随访单</span>
          </el-menu-item>
          <el-menu-item index="/batch-result">
            <el-icon><Tickets /></el-icon>
            <span>批量处理结果</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => route.path)

const roleTagType = computed(() => {
  const types = {
    triage_nurse: 'info',
    general_doctor: 'primary',
    medical_director: 'success'
  }
  return types[userStore.role] || 'info'
})

function handleCommand(command) {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout()
      router.push('/login')
    }).catch(() => {})
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(90deg, #409eff 0%, #667eea 100%);
  padding: 0 30px;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.role-tag {
  font-size: 13px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}

.layout-aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
}

.side-menu {
  border-right: none;
  height: calc(100vh - 60px);
}

.layout-main {
  background: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
