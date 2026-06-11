<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <div class="header-left">
        <el-icon :size="28" color="#fff">
          <OfficeBuilding />
        </el-icon>
        <span class="system-title">园区招商中心-月底集中处理招商线索单系统</span>
      </div>
      
      <div class="header-right">
        <el-dropdown trigger="click" @command="handleRoleSwitch">
          <div class="user-info">
            <el-avatar :size="32" :icon="UserFilled" />
            <span class="user-name">{{ authStore.userName }}</span>
            <el-tag :type="roleTagType" size="small" class="role-tag">
              {{ roleLabel }}
            </el-tag>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item divided>
                <strong>切换角色</strong>
              </el-dropdown-item>
              <el-dropdown-item 
                v-for="role in roleList" 
                :key="role.username"
                :command="role"
                :disabled="role.username === authStore.user?.username"
              >
                <span v-if="role.username === authStore.user?.username" style="color: #409EFF;">
                  ✓ {{ role.name }} (当前)
                </span>
                <span v-else>{{ role.name }}</span>
              </el-dropdown-item>
              <el-dropdown-item divided command="logout" style="color: #F56C6C;">
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container>
      <el-aside width="220px" class="layout-aside">
        <el-menu 
          :default-active="activeMenu" 
          class="side-menu"
          router
        >
          <el-menu-item index="/clues">
            <el-icon><Document /></el-icon>
            <span>招商线索单列表</span>
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
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  OfficeBuilding, UserFilled, ArrowDown, Document 
} from '@element-plus/icons-vue';
import { useAuthStore } from '../store/auth';
import { ROLE_LABELS } from '../utils/config';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeMenu = computed(() => route.path);

const roleLabel = computed(() => ROLE_LABELS[authStore.userRole] || '');

const roleTagType = computed(() => {
  const types = {
    registrar: 'warning',
    auditor: 'primary',
    reviewer: 'success'
  };
  return types[authStore.userRole] || 'info';
});

const roleList = [
  { username: 'registrar1', name: '张登记（登记员）', role: 'registrar' },
  { username: 'registrar2', name: '赵专员（登记员）', role: 'registrar' },
  { username: 'auditor1', name: '李审核（审核主管）', role: 'auditor' },
  { username: 'auditor2', name: '刘主管（审核主管）', role: 'auditor' },
  { username: 'reviewer1', name: '王复核（复核负责人）', role: 'reviewer' }
];

async function handleRoleSwitch(command) {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      });
      await authStore.logout();
      ElMessage.success('已退出登录');
      router.push('/login');
    } catch (e) {
      if (e !== 'cancel') {
        console.error('退出失败:', e);
      }
    }
  } else if (command && command.username) {
    try {
      await ElMessageBox.confirm(
        `确定要切换为 ${command.name} 吗？`,
        '角色切换',
        {
          confirmButtonText: '确定切换',
          cancelButtonText: '取消',
          type: 'info'
        }
      );
      await authStore.switchUser(command.username, '123456');
      ElMessage.success(`已切换为 ${command.name}`);
      router.push('/clues');
    } catch (e) {
      if (e !== 'cancel') {
        console.error('角色切换失败:', e);
      }
    }
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.layout-header {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.system-title {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.15);
  transition: all 0.3s;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.25);
}

.user-name {
  color: #fff;
  font-size: 14px;
}

.role-tag {
  margin-left: 4px;
}

.layout-aside {
  background: #fff;
  border-right: 1px solid #ebeef5;
}

.side-menu {
  border-right: none;
  height: 100%;
}

.layout-main {
  background: #f5f7fa;
  padding: 20px;
  overflow: auto;
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
