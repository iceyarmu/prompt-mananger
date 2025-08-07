<template>
  <Modal v-model="isOpen">
    <template #title>{{ $t('webdav.config.title') }}</template>
    
    <div class="space-y-6">
      <!-- Profile Selection -->
      <div v-if="profiles.length > 0" class="space-y-3">
        <label class="theme-label text-sm">{{ $t('webdav.config.selectProfile') }}</label>
        <div class="space-y-2 max-h-32 overflow-y-auto">
          <div
            v-for="profile in sortedProfiles"
            :key="profile.id"
            class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
            :class="{
              'theme-manager-bg-active theme-manager-border-active': selectedProfileId === profile.id,
              'theme-manager-border hover:theme-manager-bg-active': selectedProfileId !== profile.id
            }"
            @click="selectProfile(profile)"
          >
            <div class="flex-1">
              <div class="font-medium theme-manager-text">{{ profile.name }}</div>
              <div class="text-sm theme-manager-text-secondary">{{ profile.url }}</div>
            </div>
            <div class="flex items-center space-x-2">
              <span v-if="profile.id === activeProfileId" class="text-xs px-2 py-1 rounded-full bg-green-500 text-white">
                {{ $t('webdav.config.active') }}
              </span>
              <button
                @click.stop="deleteProfile(profile.id)"
                class="p-1 text-red-500 hover:text-red-700"
                :title="$t('webdav.config.deleteProfile')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Fields -->
      <div class="space-y-4">
        <!-- Profile Name -->
        <div>
          <label class="theme-label text-sm">{{ $t('webdav.config.profileName') }}</label>
          <input
            v-model="config.name"
            type="text"
            class="theme-manager-input mt-1"
            :placeholder="$t('webdav.config.profileNamePlaceholder')"
            :class="{ 'border-red-500': errors.name }"
            @blur="validateField('name')"
          />
          <p v-if="errors.name" class="text-red-500 text-xs mt-1">{{ errors.name }}</p>
        </div>

        <!-- Server URL -->
        <div>
          <label class="theme-label text-sm">{{ $t('webdav.config.serverUrl') }} *</label>
          <input
            v-model="config.url"
            type="url"
            class="theme-manager-input mt-1"
            :placeholder="$t('webdav.config.urlPlaceholder')"
            :class="{ 'border-red-500': errors.url }"
            @blur="validateField('url')"
          />
          <p v-if="errors.url" class="text-red-500 text-xs mt-1">{{ errors.url }}</p>
          <p class="text-xs theme-manager-text-secondary mt-1">{{ $t('webdav.config.urlHint') }}</p>
        </div>

        <!-- Username -->
        <div>
          <label class="theme-label text-sm">{{ $t('webdav.config.username') }}</label>
          <input
            v-model="config.username"
            type="text"
            class="theme-manager-input mt-1"
            :placeholder="$t('webdav.config.usernamePlaceholder')"
            :class="{ 'border-red-500': errors.username }"
          />
          <p v-if="errors.username" class="text-red-500 text-xs mt-1">{{ errors.username }}</p>
        </div>

        <!-- Password -->
        <div>
          <label class="theme-label text-sm">{{ $t('webdav.config.password') }}</label>
          <div class="relative mt-1">
            <input
              v-model="config.password"
              :type="showPassword ? 'text' : 'password'"
              class="theme-manager-input pr-10"
              :placeholder="$t('webdav.config.passwordPlaceholder')"
              :class="{ 'border-red-500': errors.password }"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
              @click="showPassword = !showPassword"
            >
              <svg v-if="!showPassword" class="w-4 h-4 theme-manager-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-4 h-4 theme-manager-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656l1.415 1.415m-1.415-1.415l1.414-1.414" />
              </svg>
            </button>
          </div>
          <p v-if="errors.password" class="text-red-500 text-xs mt-1">{{ errors.password }}</p>
        </div>
      </div>

      <!-- Test Connection -->
      <div class="pt-4 border-t theme-manager-border">
        <button
          @click="testConnection"
          :disabled="!isValid || isTestingConnection"
          class="theme-manager-button-test flex items-center space-x-2"
        >
          <svg
            v-if="isTestingConnection"
            class="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>
            {{ isTestingConnection ? $t('webdav.config.testing') : $t('webdav.config.testConnection') }}
          </span>
        </button>
      </div>
    </div>

    <template #footer>
      <button @click="cancel" class="theme-button-secondary">
        {{ $t('common.cancel') }}
      </button>
      <button
        @click="save"
        :disabled="!isValid"
        class="theme-button-primary"
      >
        {{ $t('common.save') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from './Modal.vue'
import { useToast } from '@/composables/useToast'
import { useWebDAVStore, type WebDAVProfile } from '@/composables/useWebDAVStore'

const { t } = useI18n()
const toast = useToast()
const webdavStore = useWebDAVStore()

// Props
const props = defineProps<{
  modelValue: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Reactive data
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const config = reactive({
  name: '',
  url: '',
  username: '',
  password: ''
})

const errors = reactive({
  name: '',
  url: '',
  username: '',
  password: ''
})

const showPassword = ref(false)
const isTestingConnection = ref(false)
const selectedProfileId = ref<string | null>(null)

// Computed
const profiles = computed(() => webdavStore.profiles)
const activeProfileId = computed(() => webdavStore.activeProfile?.id ?? null)

const sortedProfiles = computed(() => {
  return [...profiles.value].sort((a, b) => {
    // Active profile first
    if (a.id === activeProfileId.value) return -1
    if (b.id === activeProfileId.value) return 1
    // Then by last used (most recent first)
    return (b.lastUsed?.getTime() ?? 0) - (a.lastUsed?.getTime() ?? 0)
  })
})

const isValid = computed(() => {
  return config.url && 
         config.name &&
         !errors.url && 
         !errors.name && 
         !errors.username && 
         !errors.password
})

// Methods
const validateField = (field: keyof typeof errors) => {
  errors[field] = ''

  switch (field) {
    case 'name':
      if (!config.name.trim()) {
        errors.name = t('webdav.errors.nameRequired')
      }
      break
    case 'url':
      if (!config.url) {
        errors.url = t('webdav.errors.urlRequired')
      } else {
        try {
          const url = new URL(config.url)
          if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            errors.url = t('webdav.errors.invalidProtocol')
          }
        } catch {
          errors.url = t('webdav.errors.invalidUrl')
        }
      }
      break
  }
}

const validateAll = () => {
  validateField('name')
  validateField('url')
  validateField('username')
  validateField('password')
}

const selectProfile = (profile: WebDAVProfile) => {
  selectedProfileId.value = profile.id
  config.name = profile.name
  config.url = profile.url
  config.username = profile.username || ''
  config.password = '' // Don't populate password for security
}

const deleteProfile = async (profileId: string) => {
  if (confirm(t('webdav.config.confirmDeleteProfile'))) {
    try {
      await webdavStore.deleteProfile(profileId)
      toast.success(t('webdav.config.profileDeleted'))
      
      // Clear selection if deleted profile was selected
      if (selectedProfileId.value === profileId) {
        selectedProfileId.value = null
        resetForm()
      }
    } catch (error) {
      toast.error(t('webdav.errors.failedToDeleteProfile'))
    }
  }
}

const testConnection = async () => {
  validateAll()
  if (!isValid.value) return

  isTestingConnection.value = true
  try {
    const testResult = await webdavStore.testConnection({
      url: config.url,
      username: config.username || undefined,
      password: config.password || undefined
    })

    if (testResult.success) {
      toast.success(t('webdav.config.connectionSuccessful', { time: testResult.responseTime }))
    } else {
      toast.error(t('webdav.config.connectionFailed', { error: testResult.error }))
    }
  } catch (error) {
    toast.error(t('webdav.config.connectionFailed', { error: error.message }))
  } finally {
    isTestingConnection.value = false
  }
}

const save = async () => {
  validateAll()
  if (!isValid.value) return

  try {
    const profile: Omit<WebDAVProfile, 'id' | 'createdAt' | 'lastUsed'> = {
      name: config.name.trim(),
      url: config.url,
      username: config.username || undefined,
      password: config.password || undefined
    }

    if (selectedProfileId.value) {
      // Update existing profile
      await webdavStore.updateProfile(selectedProfileId.value, profile)
      toast.success(t('webdav.config.profileUpdated'))
    } else {
      // Create new profile
      await webdavStore.saveProfile(profile)
      toast.success(t('webdav.config.profileSaved'))
    }

    isOpen.value = false
  } catch (error) {
    toast.error(t('webdav.errors.failedToSaveProfile'))
  }
}

const cancel = () => {
  isOpen.value = false
}

const resetForm = () => {
  config.name = ''
  config.url = ''
  config.username = ''
  config.password = ''
  
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  selectedProfileId.value = null
}

// Watch for modal close to reset form
watch(() => isOpen.value, (newValue) => {
  if (!newValue) {
    resetForm()
  }
})
</script>