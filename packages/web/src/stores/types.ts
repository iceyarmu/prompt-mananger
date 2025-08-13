import type { FileInfo } from '@prompt-optimizer/webdav'

// Store event types for type-safe communication
export type StoreEventMap = {
  // WebDAV events
  'webdav:connected': { profile: any }
  'webdav:disconnected': void
  'webdav:profile-changed': { profile: any }
  
  // File tree events
  'filetree:file-selected': { file: TreeNode }
  'filetree:load-error': { error: any }
  
  // Editor events
  'editor:unsaved-changes-warning': { currentFile: FileInfo; newFile: TreeNode }
  'editor:file-saved': void
  'editor:file-created': { path: string }
  'editor:file-deleted': { path: string }
  
  // Preferences events
  'preferences:autosave-enabled': { interval: number }
  'preferences:autosave-disabled': void
  'preferences:theme-changed': { theme: string }
  'preferences:editor-preferences-changed': any
  'preferences:imported': void
  
  // Optimization events
  'optimization:completed': { prompt: string; result: any }
  'optimization:suggest-editor-update': { result: any }
  'optimization:error': { error: string | null }
  
  // Global events
  'global:preferences-reloaded': void
  '*:error': { message?: string }
  '*:loading-start': { store?: string }
  '*:loading-end': { store?: string }
}

export type StoreEventName = keyof StoreEventMap
export type StoreEventPayload<T extends StoreEventName> = StoreEventMap[T]

export interface StoreRegistry {
  app: ReturnType<typeof import('./app').useAppStore>
  fileTree: ReturnType<typeof import('./fileTree').useFileTreeStore>
  editor: ReturnType<typeof import('./editor').useEditorStore>
  webdav: ReturnType<typeof import('./webdav').useWebDAVStore>
  preferences: ReturnType<typeof import('./preferences').usePreferenceStore>
  optimization: ReturnType<typeof import('./optimization').useOptimizationStore>
}

export interface TreeNode {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: TreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
  error?: string | null
  fileInfo?: FileInfo
}

export interface EditorState {
  currentFile: FileInfo | null
  content: string
  originalContent: string
  viewMode: 'edit' | 'preview' | 'split'
  isLoading: boolean
  modifiedFiles: Set<string>
  cursorPosition?: { line: number; column: number }
  scrollPosition?: { top: number; left: number }
}

export interface WebDAVConnectionState {
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  url: string | null
  username: string | null
  retryCount: number
  maxRetries: number
}

export interface PreferenceState {
  theme: 'light' | 'dark' | 'auto'
  language: string
  autoSave: boolean
  autoSaveInterval: number
  editorFontSize: number
  editorWordWrap: boolean
  showLineNumbers: boolean
}

export interface OptimizationState {
  currentOptimization: {
    id: string | null
    prompt: string
    result: string | null
    status: 'idle' | 'processing' | 'completed' | 'error'
    error: string | null
  }
  history: Array<{
    id: string
    prompt: string
    result: string
    timestamp: number
    model?: string
    template?: string
  }>
  templates: Array<{
    id: string
    name: string
    content: string
    type: 'system' | 'user'
  }>
}