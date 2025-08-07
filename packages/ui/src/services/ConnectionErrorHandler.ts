import { useToast } from '../composables/useToast'
import { useWebDAVStore } from '../composables/useWebDAVStore'
import { useFileTreeStore } from '../composables/useFileTreeStore'
import { useI18n } from 'vue-i18n'

export class ConnectionErrorHandler {
  private toast = useToast()
  private webdavStore = useWebDAVStore()
  private t: (key: string) => string
  
  constructor() {
    const { t } = useI18n()
    this.t = t
  }

  handleRefreshError(error: Error): void {
    let message = this.t('fileTree.refresh.error')
    const actions: Array<{ label: string; action: () => void }> = []
    
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      message = this.t('webdav.errors.networkError')
      actions.push({
        label: this.t('common.retry'),
        action: () => this.retryRefresh()
      })
    } else if (error.message.includes('timeout')) {
      message = this.t('webdav.errors.connectionTimeout')
      actions.push({
        label: this.t('common.retry'),
        action: () => this.retryRefresh()
      })
    } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
      message = this.t('webdav.errors.authenticationFailed')
      actions.push({
        label: this.t('webdav.status.configure'),
        action: () => this.openConfiguration()
      })
    } else if (error.message.includes('404')) {
      message = this.t('webdav.errors.serverNotFound')
      actions.push({
        label: this.t('webdav.status.configure'),
        action: () => this.openConfiguration()
      })
    }
    
    this.toast.error(message)
  }
  
  handleConnectionError(error: Error): void {
    this.webdavStore.connectionStatus = 'error'
    
    let message = this.t('webdav.status.error')
    if (error.message.includes('network')) {
      message = this.t('webdav.errors.networkError')
    } else if (error.message.includes('timeout')) {
      message = this.t('webdav.errors.connectionTimeout')
    } else if (error.message.includes('unauthorized')) {
      message = this.t('webdav.errors.authenticationFailed')
    }
    
    this.toast.error(message)
  }
  
  private async retryRefresh(): Promise<void> {
    // This will be implemented by the component using the handler
    const fileTreeStore = useFileTreeStore()
    try {
      await fileTreeStore.refresh()
      this.toast.success(this.t('fileTree.refresh.success'))
    } catch (error) {
      console.error('Retry failed:', error)
    }
  }
  
  private openConfiguration(): void {
    // Emit event to open config modal
    // This will be handled by the parent component
    window.dispatchEvent(new CustomEvent('open-webdav-config'))
  }
}

export const connectionErrorHandler = new ConnectionErrorHandler()