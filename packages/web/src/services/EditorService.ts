import { createLogger } from '../utils/logger'
import type { PreferenceService } from '@prompt-optimizer/core'
import type { FileOperationsService } from './FileOperationsService'

const logger = createLogger('EditorService')

export interface EditorConfig {
  theme: string
  language: string
  fontSize: number
  tabSize: number
  wordWrap: boolean
  autoSave: boolean
  autoSaveDelay: number
  syntaxHighlighting: boolean
  lineNumbers: boolean
  minimap: boolean
}

export interface EditorState {
  currentFile?: string
  content: string
  isDirty: boolean
  cursor?: {
    line: number
    column: number
  }
  selection?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
}

export interface EditorCommand {
  id: string
  label: string
  keybinding?: string
  handler: () => void | Promise<void>
}

export class EditorService {
  private config: EditorConfig
  private state: EditorState
  private preferenceService: PreferenceService
  private fileOperationsService: FileOperationsService
  private commands: Map<string, EditorCommand>
  private optimizationHandlers: Map<string, (content: string) => Promise<string>>
  private autoSaveTimer?: NodeJS.Timeout
  
  constructor(
    preferenceService: PreferenceService,
    fileOperationsService: FileOperationsService
  ) {
    this.preferenceService = preferenceService
    this.fileOperationsService = fileOperationsService
    this.commands = new Map()
    this.optimizationHandlers = new Map()
    
    // Default configuration
    this.config = {
      theme: 'dark',
      language: 'plaintext',
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      autoSave: true,
      autoSaveDelay: 1000,
      syntaxHighlighting: true,
      lineNumbers: true,
      minimap: true
    }
    
    // Initial state
    this.state = {
      content: '',
      isDirty: false
    }
    
    logger.info('EditorService constructed')
  }
  
  /**
   * Initialize editor with preferences
   */
  async init(): Promise<void> {
    logger.debug('Initializing EditorService')
    
    try {
      // Load preferences - use getAll() method instead of non-existent getPreferences()
      const allPreferences = await this.preferenceService.getAll()
      
      // Extract editor preferences from the flat key-value structure
      const editorPrefs: any = {}
      for (const [key, value] of Object.entries(allPreferences)) {
        if (key.startsWith('editor.')) {
          const editorKey = key.replace('editor.', '')
          try {
            editorPrefs[editorKey] = JSON.parse(value)
          } catch {
            editorPrefs[editorKey] = value
          }
        }
      }
      
      // Apply editor preferences if any exist
      if (Object.keys(editorPrefs).length > 0) {
        this.config = {
          ...this.config,
          ...editorPrefs
        }
        logger.info('Editor preferences loaded', this.config)
      }
      
      // Register default commands
      this.registerDefaultCommands()
      
      // Setup auto-save if enabled
      if (this.config.autoSave) {
        this.setupAutoSave()
      }
      
      logger.info('EditorService initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize EditorService', error)
      throw error
    }
  }
  
  /**
   * Get current editor configuration
   */
  getConfig(): EditorConfig {
    return { ...this.config }
  }
  
  /**
   * Update editor configuration
   */
  async updateConfig(config: Partial<EditorConfig>): Promise<void> {
    logger.debug('Updating editor configuration', config)
    
    this.config = { ...this.config, ...config }
    
    // Save to preferences
    await this.preferenceService.setPreference('editor', this.config)
    
    // Update auto-save if changed
    if ('autoSave' in config || 'autoSaveDelay' in config) {
      this.setupAutoSave()
    }
    
    logger.info('Editor configuration updated')
  }
  
  /**
   * Get current editor state
   */
  getState(): EditorState {
    return { ...this.state }
  }
  
  /**
   * Load file into editor
   */
  async loadFile(path: string): Promise<void> {
    logger.debug('Loading file into editor', { path })
    
    try {
      const fileContent = await this.fileOperationsService.read(path)
      
      this.state = {
        currentFile: path,
        content: fileContent.content,
        isDirty: false,
        cursor: { line: 1, column: 1 }
      }
      
      // Detect language from file extension
      const extension = path.split('.').pop()
      if (extension) {
        this.config.language = this.detectLanguage(extension)
      }
      
      logger.info('File loaded into editor', { path, language: this.config.language })
    } catch (error) {
      logger.error('Failed to load file', { path, error })
      throw error
    }
  }
  
  /**
   * Save current file
   */
  async saveFile(path?: string): Promise<void> {
    const savePath = path || this.state.currentFile
    
    if (!savePath) {
      throw new Error('No file path specified for save')
    }
    
    logger.debug('Saving file', { path: savePath })
    
    try {
      await this.fileOperationsService.write(savePath, this.state.content)
      
      this.state.currentFile = savePath
      this.state.isDirty = false
      
      logger.info('File saved successfully', { path: savePath })
      
      // Task 2.1: Emit 'file-saved' event from EditorService after successful save
      const { storeBus } = await import('../stores/communication')
      storeBus.emit('editor', 'file-saved', { 
        path: savePath,
        timestamp: new Date()
      })
    } catch (error) {
      logger.error('Failed to save file', { path: savePath, error })
      throw error
    }
  }
  
  /**
   * Update editor content
   */
  updateContent(content: string): void {
    if (this.state.content !== content) {
      this.state.content = content
      this.state.isDirty = true
      
      // Reset auto-save timer
      if (this.config.autoSave) {
        this.resetAutoSaveTimer()
      }
    }
  }
  
  /**
   * Get current content
   */
  getContent(): string {
    return this.state.content
  }
  
  /**
   * Register command
   */
  registerCommand(command: EditorCommand): void {
    logger.debug('Registering editor command', { id: command.id, label: command.label })
    this.commands.set(command.id, command)
  }
  
  /**
   * Execute command
   */
  async executeCommand(commandId: string): Promise<void> {
    const command = this.commands.get(commandId)
    
    if (!command) {
      throw new Error(`Command not found: ${commandId}`)
    }
    
    logger.debug('Executing editor command', { id: commandId })
    await command.handler()
  }
  
  /**
   * Get all registered commands
   */
  getCommands(): EditorCommand[] {
    return Array.from(this.commands.values())
  }
  
  /**
   * Register optimization handler
   */
  registerOptimizationHandler(
    id: string, 
    handler: (content: string) => Promise<string>
  ): void {
    logger.debug('Registering optimization handler', { id })
    this.optimizationHandlers.set(id, handler)
  }
  
  /**
   * Apply optimization to current content
   */
  async applyOptimization(optimizationId: string): Promise<void> {
    const handler = this.optimizationHandlers.get(optimizationId)
    
    if (!handler) {
      throw new Error(`Optimization handler not found: ${optimizationId}`)
    }
    
    logger.debug('Applying optimization', { id: optimizationId })
    
    try {
      const optimizedContent = await handler(this.state.content)
      this.updateContent(optimizedContent)
      logger.info('Optimization applied successfully', { id: optimizationId })
    } catch (error) {
      logger.error('Failed to apply optimization', { id: optimizationId, error })
      throw error
    }
  }
  
  /**
   * Get content for optimization
   */
  getContentForOptimization(): string {
    return this.state.content
  }
  
  /**
   * Apply optimization result
   */
  applyOptimizationResult(optimizedContent: string): void {
    logger.debug('Applying optimization result')
    this.updateContent(optimizedContent)
    logger.info('Optimization result applied')
  }
  
  /**
   * Update cursor position
   */
  updateCursor(line: number, column: number): void {
    this.state.cursor = { line, column }
  }
  
  /**
   * Update selection
   */
  updateSelection(
    start: { line: number; column: number },
    end: { line: number; column: number }
  ): void {
    this.state.selection = { start, end }
  }
  
  /**
   * Get selected text
   */
  getSelectedText(): string {
    if (!this.state.selection) {
      return ''
    }
    
    const lines = this.state.content.split('\n')
    const { start, end } = this.state.selection
    
    if (start.line === end.line) {
      // Single line selection
      return lines[start.line - 1]?.substring(start.column - 1, end.column - 1) || ''
    }
    
    // Multi-line selection
    const selectedLines = []
    for (let i = start.line - 1; i <= end.line - 1; i++) {
      if (i === start.line - 1) {
        selectedLines.push(lines[i]?.substring(start.column - 1) || '')
      } else if (i === end.line - 1) {
        selectedLines.push(lines[i]?.substring(0, end.column - 1) || '')
      } else {
        selectedLines.push(lines[i] || '')
      }
    }
    
    return selectedLines.join('\n')
  }
  
  /**
   * Check editor health
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Check if we can access preferences - use getAll() instead of non-existent getPreferences()
      await this.preferenceService.getAll()
      
      // Check if file operations are available
      await this.fileOperationsService.checkHealth()
      
      logger.debug('Editor health check passed')
      return true
    } catch (error) {
      logger.error('Editor health check failed', error)
      return false
    }
  }
  
  /**
   * Register default commands
   */
  private registerDefaultCommands(): void {
    // Save command
    this.registerCommand({
      id: 'editor.save',
      label: 'Save',
      keybinding: 'Ctrl+S',
      handler: async () => {
        await this.saveFile()
      }
    })
    
    // Save As command
    this.registerCommand({
      id: 'editor.saveAs',
      label: 'Save As...',
      keybinding: 'Ctrl+Shift+S',
      handler: async () => {
        // This would typically open a dialog
        logger.info('Save As command triggered')
      }
    })
    
    // Undo command
    this.registerCommand({
      id: 'editor.undo',
      label: 'Undo',
      keybinding: 'Ctrl+Z',
      handler: () => {
        logger.info('Undo command triggered')
      }
    })
    
    // Redo command
    this.registerCommand({
      id: 'editor.redo',
      label: 'Redo',
      keybinding: 'Ctrl+Y',
      handler: () => {
        logger.info('Redo command triggered')
      }
    })
  }
  
  /**
   * Setup auto-save
   */
  private setupAutoSave(): void {
    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer)
      this.autoSaveTimer = undefined
    }
    
    if (!this.config.autoSave) {
      logger.debug('Auto-save disabled')
      return
    }
    
    logger.debug('Auto-save enabled', { delay: this.config.autoSaveDelay })
  }
  
  /**
   * Reset auto-save timer
   */
  private resetAutoSaveTimer(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer)
    }
    
    if (this.config.autoSave && this.state.currentFile) {
      this.autoSaveTimer = setTimeout(async () => {
        if (this.state.isDirty) {
          try {
            await this.saveFile()
            logger.debug('Auto-save completed')
          } catch (error) {
            logger.error('Auto-save failed', error)
          }
        }
      }, this.config.autoSaveDelay)
    }
  }
  
  /**
   * Detect language from file extension
   */
  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'xml': 'xml',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'mdx': 'markdown',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'ps1': 'powershell',
      'dockerfile': 'dockerfile',
      'makefile': 'makefile',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini'
    }
    
    return languageMap[extension.toLowerCase()] || 'plaintext'
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer)
      this.autoSaveTimer = undefined
    }
    
    logger.info('EditorService cleanup completed')
  }
}