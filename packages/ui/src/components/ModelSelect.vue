<template>
  <div class="relative">
    <button
      @click.stop="toggleDropdown"
      class="theme-template-select-button"
      :disabled="disabled"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <!-- Provider icon -->
          <span v-if="modelValue && getSelectedModel" class="flex-shrink-0">
            <svg v-if="getProviderIcon(modelValue) === 'openai'" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.975 5.975 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
            <svg v-else-if="getProviderIcon(modelValue) === 'anthropic'" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
            <svg v-else-if="getProviderIcon(modelValue) === 'google'" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </span>
          <span v-if="modelValue && getSelectedModel && getSelectedModel.enabled" class="theme-text text-sm">
            {{ getSelectedModel.name }}
          </span>
          <span v-else class="theme-placeholder">
            {{ !enabledModels.length ? t('model.select.noModels') : t('model.select.placeholder') }}
          </span>
        </div>
        <span class="theme-text text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </span>
      </div>
    </button>

    <div v-if="isOpen" 
         class="theme-dropdown"
         :style="dropdownStyle"
         @click.stop
         v-click-outside="() => isOpen = false"
    >
      <div class="p-2 max-h-64 overflow-y-auto">
        <div v-if="!enabledModels.length" class="theme-dropdown-empty">
          {{ t('model.select.noAvailableModels') }}
        </div>
        <div v-else v-for="model in enabledModels" 
             :key="model.key"
             @click="selectModel(model)"
             class="theme-dropdown-item"
             :class="[
               modelValue === model.key
                 ? 'theme-dropdown-item-active'
                 : 'theme-dropdown-item-inactive'
             ]"
        >
          <div class="flex items-center justify-between">
            <span class="theme-text text-sm">{{ model.name }}</span>
          </div>
        </div>
      </div>
      <div class="theme-dropdown-section">
        <button
          @click="$emit('config')"
          class="theme-dropdown-config-button"
        >
          <span>⚙️</span>
          <span>{{ t('model.select.configure') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { clickOutside } from '../directives/clickOutside'
import type { AppServices } from '../types/services'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
  // modelManager现在通过inject获取，不再需要props
})

const emit = defineEmits(['update:modelValue', 'config'])

const isOpen = ref(false)
const refreshTrigger = ref(0)
const vClickOutside = clickOutside

// 统一使用inject获取services
const services = inject<Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[ModelSelect] services未正确注入，请确保在App组件中正确provide了services')
}

const getModelManager = computed(() => {
  const servicesValue = services.value
  if (!servicesValue) {
    throw new Error('[ModelSelect] services未初始化，请确保应用已正确启动')
  }

  const manager = servicesValue.modelManager
  if (!manager) {
    throw new Error('[ModelSelect] modelManager未初始化，请确保服务已正确配置')
  }

  return manager
})

// 响应式数据存储
const allModels = ref([])
const enabledModels = ref([])

// 加载模型数据
const loadModels = async () => {
  try {
    const manager = getModelManager.value
    if (!manager) {
      throw new Error('ModelManager not available')
    }
    
    allModels.value = await manager.getAllModels()
    enabledModels.value = await manager.getEnabledModels()
  } catch (error) {
    console.error('Failed to load models:', error)
    allModels.value = []
    enabledModels.value = []
  }
}

// 获取选中的模型
const getSelectedModel = computed(() => {
  refreshTrigger.value // 触发响应式更新
  return allModels.value.find(m => m.key === props.modelValue)
})

// 判断是否为默认模型
const isDefaultModel = (key) => {
  const model = allModels.value.find(m => m.key === key)
  return model?.isDefault ?? false
}

// 切换下拉框
const toggleDropdown = async () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await loadModels()
    refreshTrigger.value++
  }
}

// 选择模型
const selectModel = (model) => {
  emit('update:modelValue', model.key)
  isOpen.value = false
  refreshTrigger.value++
}

// 添加刷新方法
const refresh = async () => {
  await loadModels()
  refreshTrigger.value++
}

// 暴露方法给父组件
defineExpose({
  refresh
})

// 监听模型数据变化，确保选中的模型仍然可用
watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue && !enabledModels.value.find(m => m.key === newValue)) {
      await loadModels()
      if (!enabledModels.value.find(m => m.key === newValue)) {
        emit('update:modelValue', enabledModels.value[0]?.key || '')
      }
    }
  }
)

// 初始化时加载模型
onMounted(async () => {
  await loadModels()
})

// 计算下拉框样式
const dropdownStyle = computed(() => ({
  minWidth: '100%'
}))

// Get provider icon based on model key
const getProviderIcon = (modelKey: string) => {
  if (modelKey.includes('gpt')) return 'openai'
  if (modelKey.includes('claude')) return 'anthropic'
  if (modelKey.includes('gemini')) return 'google'
  return 'default'
}
</script>

<style scoped>
.theme-template-select-button {
  position: relative;
}
</style> 