import { ref, computed, watch, onUnmounted } from 'vue';
import { useServices } from './useServices';
import { useTheme } from './useTheme';
import { useI18n } from 'vue-i18n';
import { showNotification } from '../utils/notification';
import { useEditorStore } from './editorStore';
import type { FileInfo } from '../types';

export interface EditorConfig {
  theme: 'light' | 'dark';
  language: string;
  toolbars: string[];
  codeTheme: string;
  previewTheme: string;
}

export const defaultToolbarConfig = [
  'bold', 'italic', 'strikeThrough', '|',
  'title', 'sub', 'sup', 'quote', 'unorderedList', 'orderedList', 'task', '|',
  'codeRow', 'code', 'link', 'image', 'table', 'mermaid', '|',
  'revoke', 'next', 'save', '|',
  '=',
  'pageFullscreen', 'fullscreen', 'preview', 'htmlPreview', 'catalog'
];

export const editorPerformanceConfig = {
  // Large file handling
  maxFileSize: 10 * 1024 * 1024, // 10MB
  chunkSize: 64 * 1024, // 64KB chunks for progressive loading
  
  // Rendering optimization
  enableVirtualization: true,
  virtualThreshold: 1000, // lines
  
  // Change detection
  debounceDelay: 300, // ms
  throttleDelay: 16, // ~60fps
  
  // Syntax highlighting
  enableWorkerHighlighting: true,
  highlightingTimeout: 5000, // ms
  
  // History management
  maxHistorySize: 100,
  historyMergeDelay: 1000, // ms
  
  // Memory management
  maxContentCache: 5 * 1024 * 1024, // 5MB max cached content
  cleanupThreshold: 100000, // 100KB triggers cleanup
  
  // Lazy loading
  lazyLoadDelay: 200, // ms delay before loading components
  lazyLoadTimeout: 10000, // ms timeout for component loading
};

export const editorThemeConfig = {
  light: {
    theme: 'light',
    codeTheme: 'github',
    previewTheme: 'default'
  },
  dark: {
    theme: 'dark', 
    codeTheme: 'github-dark',
    previewTheme: 'dark'
  }
};

export const supportedLanguages = [
  'javascript', 'typescript', 'python', 'java', 'csharp',
  'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
  'sql', 'html', 'css', 'scss', 'sass', 'json', 'yaml',
  'xml', 'bash', 'powershell', 'dockerfile', 'markdown'
];

export const languageMap: Record<string, string> = {
  '.js': 'javascript',
  '.ts': 'typescript',  
  '.py': 'python',
  '.java': 'java',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.sql': 'sql',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.xml': 'xml',
  '.sh': 'bash',
  '.ps1': 'powershell'
};

let changeTimer: ReturnType<typeof setTimeout> | null = null;

// File validation configuration
const FILE_VALIDATION_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB max file size
  allowedExtensions: ['.md', '.markdown', '.txt', '.text', '.rst'], // Allowed file extensions
  maxPathLength: 1000 // Maximum path length
};

// Loading states enum
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  ERROR = 'error',
  SUCCESS = 'success'
}

// Security: Path validation to prevent directory traversal attacks
export function validateFilePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid file path: path must be a non-empty string');
  }
  
  // Normalize the path to handle various formats
  const normalizedPath = path.replace(/\\/g, '/');
  
  // Check path length
  if (normalizedPath.length > FILE_VALIDATION_CONFIG.maxPathLength) {
    throw new Error('Invalid file path: path too long');
  }
  
  // Check for path traversal patterns
  if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
    throw new Error('Invalid file path: path traversal detected');
  }
  
  // Check for absolute paths that try to access system files
  if (normalizedPath.startsWith('/etc/') || 
      normalizedPath.startsWith('/proc/') || 
      normalizedPath.startsWith('/sys/') ||
      normalizedPath.match(/^[a-zA-Z]:\\/)) {
    throw new Error('Invalid file path: access to system directories not allowed');
  }
  
  // Check for null bytes (used in some attacks)
  if (normalizedPath.includes('\0')) {
    throw new Error('Invalid file path: null bytes not allowed');
  }
  
  return true;
}

// File validation function
export function validateFile(file: FileInfo): void {
  // Validate path first
  validateFilePath(file.path);
  
  // Check file size if provided
  if (file.size !== undefined && file.size > FILE_VALIDATION_CONFIG.maxFileSize) {
    const maxMB = FILE_VALIDATION_CONFIG.maxFileSize / (1024 * 1024);
    throw new Error(`File exceeds maximum size of ${maxMB}MB`);
  }
  
  // Check file extension
  const fileName = file.name || file.path.split('/').pop() || '';
  const extension = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
  
  if (extension && !FILE_VALIDATION_CONFIG.allowedExtensions.includes(extension)) {
    const allowedList = FILE_VALIDATION_CONFIG.allowedExtensions.join(', ');
    throw new Error(`Unsupported file type '${extension}'. Supported types: ${allowedList}`);
  }
  
  // Additional file name validation
  if (fileName.length === 0) {
    throw new Error('File name cannot be empty');
  }
  
  // Check for suspicious characters in filename
  const suspiciousChars = /[<>:"|?*\x00-\x1F]/;
  if (suspiciousChars.test(fileName)) {
    throw new Error('File name contains invalid characters');
  }
}

export async function loadLargeFile(
  filePath: string, 
  webdavService: any,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Security: Validate file path before loading
  validateFilePath(filePath);
  
  // Check if the service supports range requests
  if (!webdavService.getFileRange) {
    // Fallback to loading entire file if getFileRange is not available
    const content = await webdavService.getFile(filePath);
    onProgress?.(1);
    return content;
  }
  
  try {
    // Get file info to determine size
    const fileInfo = await webdavService.getFileInfo(filePath);
    const fileSize = fileInfo.size;
    
    // If file is small enough, load it all at once
    if (fileSize <= FILE_VALIDATION_CONFIG.maxFileSize / 10) { // 1MB threshold for chunking
      const content = await webdavService.getFile(filePath);
      onProgress?.(1);
      return content;
    }
    
    // Load file in chunks for large files
    const chunkSize = 64 * 1024; // 64KB chunks
    const chunks: string[] = [];
    let loaded = 0;
    
    for (let start = 0; start < fileSize; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, fileSize - 1);
      
      // Load chunk using range request
      const chunk = await webdavService.getFileRange(filePath, start, end);
      chunks.push(chunk);
      
      // Update progress
      loaded = Math.min(end + 1, fileSize);
      const progress = loaded / fileSize;
      onProgress?.(progress);
      
      // Add a small delay to prevent overwhelming the server
      if (start + chunkSize < fileSize) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    // Combine all chunks
    return chunks.join('');
    
  } catch (error) {
    // If range requests fail, fallback to loading entire file
    console.warn('Failed to load file in chunks, falling back to full load:', error);
    const content = await webdavService.getFile(filePath);
    onProgress?.(1);
    return content;
  }
}

// Create error handler factory that takes t function for i18n
export function createEditorErrorHandler(t: (key: string) => string) {
  return {
    handleLoadError: (error: Error, filePath: string, webdavService: any, onSuccess?: (content: string) => void) => {
      let message = t('editor.notifications.loadError');
      
      if (error.name === 'NetworkError') {
        message = t('editor.notifications.networkError');
      } else if (error.name === 'PermissionError') {
        message = t('editor.notifications.permissionError');
      } else if (error.message.includes('too large')) {
        message = t('editor.notifications.fileTooLarge');
      } else if (error.message.includes('path traversal') || error.message.includes('Invalid file path')) {
        message = t('editor.notifications.pathTraversalError');
      }
      
      showNotification(message, 'error', 0, [{
        label: t('common.retry', 'Retry'),
        action: async () => {
          try {
            const content = await retryLoadFile(filePath, webdavService);
            onSuccess?.(content);
            showNotification(t('editor.notifications.fileLoadedSuccessfully'), 'success');
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            showNotification(t('editor.notifications.allRetriesFailed'), 'error');
          }
        }
      }]);
    },
    
    handleSaveError: (error: Error, filePath: string, content: string, webdavService: any, onSuccess?: () => void) => {
      showNotification(t('editor.notifications.saveError'), 'error', 0, [{
        label: t('common.retry', 'Retry'),
        action: async () => {
          try {
            await retrySaveFile(filePath, content, webdavService);
            onSuccess?.();
            showNotification(t('editor.notifications.fileSavedSuccessfully'), 'success');
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            showNotification(t('editor.notifications.allRetriesFailed'), 'error');
          }
        }
      }]);
    }
  };
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 8000   // 8 seconds max
};

// Exponential backoff retry utility
async function withRetry<T>(
  operation: () => Promise<T>,
  retryName: string,
  maxRetries: number = RETRY_CONFIG.maxRetries,
  t?: (key: string, params?: any) => string
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt > maxRetries) {
        break;
      }
      
      // Calculate exponential backoff delay
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay
      );
      
      console.warn(`${retryName} failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delay}ms...`, error);
      
      const notificationMsg = t 
        ? t('editor.notifications.retryingIn', { seconds: delay / 1000 })
        : `${retryName} failed, retrying in ${delay / 1000}s...`;
      showNotification(notificationMsg, 'warning', delay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Actual retry functions with exponential backoff
async function retryLoadFile(filePath: string, webdavService: any): Promise<string> {
  return withRetry(
    async () => {
      validateFilePath(filePath);
      return await webdavService.getFile(filePath);
    },
    'File load',
    RETRY_CONFIG.maxRetries
  );
}

async function retrySaveFile(filePath: string, content: string, webdavService: any): Promise<void> {
  return withRetry(
    async () => {
      validateFilePath(filePath);
      await webdavService.putFile({ path: filePath, content });
    },
    'File save',
    RETRY_CONFIG.maxRetries
  );
}

export function useMarkdownEditor() {
  const { services } = useServices();
  const { currentTheme } = useTheme();
  const { t, locale } = useI18n();
  const editorStore = useEditorStore();
  
  // Local state only for UI-specific things
  const loadProgress = ref(0);
  
  // View modes configuration
  const viewModes = [
    { value: 'edit', label: t('editor.viewModes.edit'), icon: 'edit' },
    { value: 'preview', label: t('editor.viewModes.preview'), icon: 'eye' },
    { value: 'split', label: t('editor.viewModes.split'), icon: 'split' }
  ];
  
  // Computed properties that derive from store
  const content = computed({
    get: () => editorStore.content,
    set: (val) => editorStore.setContent(val)
  });
  
  const originalContent = computed(() => editorStore.originalContent);
  const currentFile = computed(() => editorStore.currentFile);
  const currentViewMode = computed(() => editorStore.viewMode);
  const loading = computed(() => editorStore.isLoading);
  const hasUnsavedChanges = computed(() => editorStore.hasUnsavedChanges);
  
  const editorTheme = computed(() => {
    return currentTheme.value === 'dark' ? 'dark' : 'light';
  });
  
  const codeTheme = computed(() => {
    const themeConfig = currentTheme.value === 'dark' 
      ? editorThemeConfig.dark 
      : editorThemeConfig.light;
    return themeConfig.codeTheme;
  });
  
  const currentFileName = computed(() => {
    return editorStore.currentFile?.name || t('editor.untitled');
  });
  
  const currentLocale = computed(() => {
    // Map i18n locale to md-editor-v3 supported language
    const localeMap: Record<string, string> = {
      'en': 'en-US',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR'
    };
    return localeMap[locale.value] || 'en-US';
  });
  
  const toolbarConfig = ref(defaultToolbarConfig);
  
  // Create error handler with i18n support
  const editorErrorHandler = createEditorErrorHandler(t);
  
  // File operations
  const loadFile = async (file: FileInfo) => {
    editorStore.setLoading(true);
    loadProgress.value = 0;
    
    try {
      // Comprehensive file validation (path, size, extension)
      validateFile(file);
      
      let fileContent: string;
      
      // Check if file is large and use progressive loading
      if (file.size && file.size > 1024 * 1024) { // > 1MB
        // Use progressive loading with progress updates
        fileContent = await loadLargeFile(
          file.path,
          services.value?.webdavService,
          (progress) => {
            loadProgress.value = Math.round(progress * 100);
          }
        );
      } else {
        // Load the file content normally for small files
        fileContent = await services.value?.webdavService.getFile(file.path) || '';
        loadProgress.value = 100;
      }
      
      editorStore.setCurrentFile(file);
      editorStore.setContent(fileContent);
      editorStore.setOriginalContent(fileContent);
    } catch (error) {
      console.error('Failed to load file:', error);
      editorErrorHandler.handleLoadError(
        error as Error, 
        file.path,
        services.value?.webdavService,
        (retryContent) => {
          editorStore.setCurrentFile(file);
          editorStore.setContent(retryContent);
          editorStore.setOriginalContent(retryContent);
        }
      );
    } finally {
      editorStore.setLoading(false);
      loadProgress.value = 0;
    }
  };
  
  const saveFile = async () => {
    if (!editorStore.currentFile || !editorStore.hasUnsavedChanges) return;
    
    try {
      // Comprehensive file validation before saving
      validateFile(editorStore.currentFile);
      
      await services.value?.webdavService.putFile({
        path: editorStore.currentFile.path,
        content: editorStore.content
      });
      editorStore.markFileSaved(editorStore.currentFile.path);
      showNotification(t('editor.saved'), 'success');
    } catch (error) {
      console.error('Failed to save file:', error);
      editorErrorHandler.handleSaveError(
        error as Error, 
        editorStore.currentFile.path,
        editorStore.content,
        services.value?.webdavService,
        () => {
          editorStore.markFileSaved(editorStore.currentFile!.path);
        }
      );
    }
  };
  
  // Handler functions
  const handleContentChange = (value: string) => {
    // Debounce change detection
    if (changeTimer) {
      clearTimeout(changeTimer);
    }
    
    changeTimer = setTimeout(() => {
      editorStore.setContent(value);
    }, editorPerformanceConfig.debounceDelay);
  };
  
  const handleSave = () => {
    saveFile();
  };
  
  const handleImageUpload = async (files: File[], callback: (urls: string[]) => void) => {
    // TODO: Implement image upload functionality
    console.log('Image upload not yet implemented', files);
    callback([]);
  };
  
  const setViewMode = (mode: 'edit' | 'preview' | 'split') => {
    editorStore.setViewMode(mode);
  };
  
  const confirmUnsavedChanges = async (): Promise<boolean> => {
    // TODO: Implement confirmation dialog
    return confirm('You have unsaved changes. Do you want to save them?');
  };

  // Cleanup timers and large file content on component unmount
  onUnmounted(() => {
    // Clear debounce timer to prevent memory leaks
    if (changeTimer) {
      clearTimeout(changeTimer);
      changeTimer = null;
    }
    
    // Clear large file content from memory
    if (editorStore.content.length > 100000) { // >100KB
      editorStore.setContent('');
      editorStore.setOriginalContent('');
    }
    
    // Clear file reference
    editorStore.setCurrentFile(null);
  });
  
  return {
    // State
    content,
    originalContent,
    currentFile,
    currentViewMode,
    loading,
    loadProgress,
    
    // Computed
    hasUnsavedChanges,
    editorTheme,
    codeTheme,
    currentFileName,
    currentLocale,
    
    // Config
    toolbarConfig,
    viewModes,
    
    // Methods
    loadFile,
    saveFile,
    handleContentChange,
    handleSave,
    handleImageUpload,
    setViewMode,
    confirmUnsavedChanges
  };
}