<template>
  <div class="error-boundary">
    <template v-if="!hasError">
      <slot />
    </template>
    <template v-else>
      <div class="error-display">
        <el-result
          icon="error"
          title="Something went wrong"
          :sub-title="errorMessage"
        >
          <template #extra>
            <el-button type="primary" @click="handleReset">
              Try Again
            </el-button>
            <el-button @click="handleReload">
              Reload Page
            </el-button>
          </template>
        </el-result>
        <div v-if="isDevelopment" class="error-details">
          <el-collapse>
            <el-collapse-item title="Error Details" name="1">
              <pre>{{ errorDetails }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, inject } from 'vue'
import { ElResult, ElButton, ElCollapse, ElCollapseItem } from 'element-plus'
import type { Logger } from '../utils/logger'

const logger = inject<Logger>('logger')
const isDevelopment = import.meta.env.DEV

const hasError = ref(false)
const errorMessage = ref('An unexpected error occurred')
const errorDetails = ref('')

// Capture errors from child components
onErrorCaptured((error: Error, instance, info) => {
  hasError.value = true
  errorMessage.value = error.message || 'Unknown error'
  errorDetails.value = `${error.stack || error.toString()}\n\nComponent: ${instance?.$options.name || 'Unknown'}\nInfo: ${info}`
  
  logger?.error('Error boundary caught error', {
    error,
    component: instance?.$options.name,
    info
  })
  
  // Prevent the error from propagating
  return false
})

const handleReset = () => {
  hasError.value = false
  errorMessage.value = ''
  errorDetails.value = ''
}

const handleReload = () => {
  window.location.reload()
}
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}

.error-details {
  width: 100%;
  max-width: 800px;
  margin-top: 20px;
}

.error-details pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>