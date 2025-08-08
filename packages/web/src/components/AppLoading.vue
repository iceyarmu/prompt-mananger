<template>
  <div class="app-loading">
    <div class="loading-content">
      <el-icon v-if="!error" class="loading-spinner" :size="48">
        <Loading />
      </el-icon>
      <el-icon v-else class="error-icon" :size="48" color="#F56C6C">
        <CircleCloseFilled />
      </el-icon>
      
      <h2 class="loading-title">
        {{ error ? 'Initialization Failed' : 'Prompt Optimizer' }}
      </h2>
      
      <p class="loading-status">{{ status }}</p>
      
      <div v-if="error" class="error-content">
        <el-alert
          :title="error.message"
          type="error"
          :closable="false"
          show-icon
        />
        <el-button 
          type="primary" 
          @click="handleReload"
          style="margin-top: 20px"
        >
          Reload Application
        </el-button>
      </div>
      
      <el-progress 
        v-if="!error"
        :percentage="progressPercentage" 
        :stroke-width="2"
        style="width: 300px; margin-top: 20px"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElIcon, ElAlert, ElButton, ElProgress } from 'element-plus'
import { Loading, CircleCloseFilled } from '@element-plus/icons-vue'

interface Props {
  status: string
  error?: Error | null
}

const props = defineProps<Props>()

// Calculate progress based on status
const progressPercentage = computed(() => {
  const statusMap: Record<string, number> = {
    'Starting application...': 10,
    'Verifying services...': 30,
    'Running health checks...': 60,
    'Loading preferences...': 80,
    'Ready': 100,
    'Initialization failed': 0
  }
  return statusMap[props.status] || 0
})

const handleReload = () => {
  window.location.reload()
}
</script>

<style scoped>
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.loading-content {
  text-align: center;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-width: 400px;
}

.loading-spinner {
  animation: spin 1s linear infinite;
  color: #667eea;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.loading-title {
  margin: 20px 0 10px;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.loading-status {
  color: #666;
  font-size: 14px;
  margin: 10px 0;
}

.error-content {
  margin-top: 20px;
  text-align: left;
}
</style>