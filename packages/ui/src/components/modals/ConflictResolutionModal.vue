<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <!-- Backdrop -->
          <div 
            class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            @click="cancel"
          ></div>

          <!-- Modal -->
          <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                  <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    {{ t('conflictResolution.title') }}
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t('conflictResolution.message', { file: conflict?.path }) }}
                    </p>
                    
                    <div class="mt-4 space-y-2">
                      <div class="text-sm">
                        <span class="font-medium text-gray-700 dark:text-gray-300">
                          {{ t('conflictResolution.yourVersion') }}:
                        </span>
                        <span class="text-gray-500 dark:text-gray-400 ml-2">
                          {{ formatDate(conflict?.local?.lastModified) }}
                        </span>
                      </div>
                      
                      <div class="text-sm">
                        <span class="font-medium text-gray-700 dark:text-gray-300">
                          {{ t('conflictResolution.serverVersion') }}:
                        </span>
                        <span class="text-gray-500 dark:text-gray-400 ml-2">
                          {{ formatDate(conflict?.remote?.lastModified) }}
                        </span>
                      </div>
                    </div>
                    
                    <!-- Preview toggle -->
                    <div v-if="showPreview" class="mt-4">
                      <button
                        @click="togglePreview"
                        class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
                      >
                        {{ previewExpanded ? t('conflictResolution.hidePreview') : t('conflictResolution.showPreview') }}
                      </button>
                      
                      <div v-if="previewExpanded" class="mt-2 grid grid-cols-2 gap-2">
                        <div class="border border-gray-200 dark:border-gray-700 rounded p-2">
                          <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('conflictResolution.yourContent') }}
                          </div>
                          <pre class="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32">{{ conflict?.local?.content }}</pre>
                        </div>
                        <div class="border border-gray-200 dark:border-gray-700 rounded p-2">
                          <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('conflictResolution.serverContent') }}
                          </div>
                          <pre class="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32">{{ conflict?.remote?.content }}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
              <button
                type="button"
                @click="resolve('mine')"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                {{ t('conflictResolution.keepMine') }}
              </button>
              
              <button
                type="button"
                @click="resolve('theirs')"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                {{ t('conflictResolution.keepTheirs') }}
              </button>
              
              <button
                type="button"
                @click="resolve('both')"
                class="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                {{ t('conflictResolution.keepBoth') }}
              </button>
              
              <button
                type="button"
                @click="cancel"
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
              >
                {{ t('common.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface FileConflict {
  path: string
  local: {
    content: string
    lastModified: Date
    size: number
  }
  remote: {
    content: string
    lastModified: Date
    size: number
  }
}

export type ConflictResolution = 'mine' | 'theirs' | 'both' | null

const props = defineProps<{
  modelValue: boolean
  conflict: FileConflict | null
  showPreview?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'resolve': [resolution: ConflictResolution]
}>()

const { t } = useI18n()
const previewExpanded = ref(false)

function resolve(resolution: 'mine' | 'theirs' | 'both') {
  emit('resolve', resolution)
  emit('update:modelValue', false)
  previewExpanded.value = false
}

function cancel() {
  emit('resolve', null)
  emit('update:modelValue', false)
  previewExpanded.value = false
}

function togglePreview() {
  previewExpanded.value = !previewExpanded.value
}

function formatDate(date?: Date): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('default', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(date)
}
</script>