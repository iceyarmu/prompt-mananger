<template>
  <div class="editor-error-boundary">
    <!-- Show error state if an error occurred -->
    <div v-if="hasError" class="error-state p-8 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="mb-4">
        <Icon name="alert-circle" class="w-12 h-12 text-red-500 mx-auto mb-2" />
        <h2 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          {{ $t('editor.errorBoundary.title', 'Editor Error') }}
        </h2>
        <p class="text-red-700 dark:text-red-300 mb-4">
          {{ $t('editor.errorBoundary.description', 'An unexpected error occurred in the editor. Please try reloading or contact support if the issue persists.') }}
        </p>
      </div>
      
      <!-- Error details (only in development) -->
      <details v-if="isDevelopment && errorDetails" class="text-left bg-red-100 dark:bg-red-900/40 p-4 rounded text-sm mb-4">
        <summary class="cursor-pointer font-medium text-red-800 dark:text-red-200 mb-2">
          {{ $t('editor.errorBoundary.showDetails', 'Show Error Details') }}
        </summary>
        <pre class="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">{{ errorDetails }}</pre>
      </details>
      
      <!-- Action buttons -->
      <div class="flex gap-3 justify-center">
        <Button 
          variant="default" 
          @click="reloadEditor"
          class="bg-red-600 hover:bg-red-700 text-white"
        >
          <Icon name="refresh" class="w-4 h-4 mr-2" />
          {{ $t('editor.errorBoundary.reload', 'Reload Editor') }}
        </Button>
        
        <Button 
          variant="outline" 
          @click="reportError"
          class="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/20"
        >
          <Icon name="bug" class="w-4 h-4 mr-2" />
          {{ $t('editor.errorBoundary.report', 'Report Issue') }}
        </Button>
        
        <Button 
          variant="ghost" 
          @click="dismissError"
          class="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {{ $t('editor.errorBoundary.dismiss', 'Dismiss') }}
        </Button>
      </div>
    </div>
    
    <!-- Render children when no error -->
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, getCurrentInstance } from 'vue';
import { showNotification } from '../utils/notification';

interface ErrorInfo {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: Date;
}

const hasError = ref(false);
const errorDetails = ref<string>('');
const isDevelopment = ref(process.env.NODE_ENV === 'development');

// Error reporting configuration
const ERROR_REPORTING_CONFIG = {
  maxErrorLength: 2000,
  includeUserAgent: true,
  includeTimestamp: true,
  reportEndpoint: '/api/errors' // Configure this based on your backend
};

// Capture errors from child components
onErrorCaptured((error: Error, instance, info: string) => {
  console.error('EditorErrorBoundary caught error:', error, info);
  
  // Set error state
  hasError.value = true;
  
  // Format error details for debugging
  const errorInfo: ErrorInfo = {
    message: error.message,
    stack: error.stack,
    componentStack: info,
    timestamp: new Date()
  };
  
  errorDetails.value = formatErrorDetails(errorInfo);
  
  // Log error for monitoring/analytics
  logErrorToMonitoring(error, info);
  
  // Show notification
  showNotification(
    'Editor encountered an error and has been reset',
    'error',
    5000
  );
  
  // Prevent the error from propagating further up
  return false;
});

// Format error details for display
function formatErrorDetails(errorInfo: ErrorInfo): string {
  const details = [
    `Timestamp: ${errorInfo.timestamp.toISOString()}`,
    `Message: ${errorInfo.message}`,
    `Component: ${errorInfo.componentStack}`,
    `Stack Trace: ${errorInfo.stack}`
  ];
  
  if (ERROR_REPORTING_CONFIG.includeUserAgent) {
    details.push(`User Agent: ${navigator.userAgent}`);
  }
  
  return details.join('\n\n');
}

// Log error to monitoring service
function logErrorToMonitoring(error: Error, componentInfo: string) {
  // In a real application, you would send this to your monitoring service
  // e.g., Sentry, LogRocket, or custom analytics
  try {
    const errorPayload = {
      message: error.message,
      stack: error.stack,
      componentInfo,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userId: getCurrentInstance()?.appContext.config.globalProperties.$user?.id
    };
    
    // Example: Send to monitoring service
    console.warn('Error would be reported to monitoring service:', errorPayload);
    
    // Uncomment and configure based on your monitoring service:
    // fetch(ERROR_REPORTING_CONFIG.reportEndpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorPayload)
    // }).catch(reportingError => {
    //   console.error('Failed to report error:', reportingError);
    // });
    
  } catch (loggingError) {
    console.error('Failed to log error to monitoring:', loggingError);
  }
}

// Action handlers
const reloadEditor = () => {
  hasError.value = false;
  errorDetails.value = '';
  
  // Force re-render by remounting the component
  // The parent component will need to handle this
  showNotification('Editor reloaded', 'success');
};

const reportError = () => {
  // Open issue tracker or support system
  const issueUrl = 'https://github.com/your-org/prompt-manager/issues/new';
  const errorReport = encodeURIComponent(errorDetails.value.substring(0, ERROR_REPORTING_CONFIG.maxErrorLength));
  
  const fullUrl = `${issueUrl}?template=bug_report&title=Editor%20Error&body=${errorReport}`;
  window.open(fullUrl, '_blank');
  
  showNotification('Issue reporting page opened', 'info');
};

const dismissError = () => {
  hasError.value = false;
  errorDetails.value = '';
  
  showNotification('Error dismissed - editor may still be unstable', 'warning');
};

// Global error handlers for unhandled promises and errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in editor:', event.reason);
    logErrorToMonitoring(new Error(event.reason), 'unhandledrejection');
  });
  
  window.addEventListener('error', (event) => {
    console.error('Global error in editor:', event.error);
    if (event.error) {
      logErrorToMonitoring(event.error, 'global-error');
    }
  });
}

// Expose methods for parent component access
defineExpose({
  hasError,
  reloadEditor,
  dismissError
});
</script>

<style scoped>
.error-state {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

details summary {
  list-style: none;
}

details summary::-webkit-details-marker {
  display: none;
}

details[open] summary::before {
  content: '▼ ';
}

details summary::before {
  content: '▶ ';
  margin-right: 0.5rem;
}
</style>