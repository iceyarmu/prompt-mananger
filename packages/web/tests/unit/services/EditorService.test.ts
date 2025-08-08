import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EditorService } from '../../../src/services/EditorService'
import type { PreferenceService } from '@prompt-optimizer/core'
import type { FileOperationsService } from '../../../src/services/FileOperationsService'

describe('EditorService', () => {
  let service: EditorService
  let mockPreferenceService: PreferenceService
  let mockFileOperationsService: FileOperationsService
  
  beforeEach(() => {
    // Mock PreferenceService
    mockPreferenceService = {
      getPreferences: vi.fn().mockResolvedValue({
        editor: {
          theme: 'dark',
          fontSize: 14,
          tabSize: 4,
          wordWrap: true,
          autoSave: false,
          autoSaveDelay: 2000
        }
      }),
      setPreference: vi.fn().mockResolvedValue(undefined)
    } as any
    
    // Mock FileOperationsService
    mockFileOperationsService = {
      read: vi.fn(),
      write: vi.fn(),
      checkHealth: vi.fn().mockResolvedValue(true)
    } as any
    
    service = new EditorService(mockPreferenceService, mockFileOperationsService)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
    service.cleanup()
  })
  
  describe('init', () => {
    it('should initialize with preferences', async () => {
      await service.init()
      
      expect(mockPreferenceService.getPreferences).toHaveBeenCalled()
      
      const config = service.getConfig()
      expect(config.theme).toBe('dark')
      expect(config.fontSize).toBe(14)
      expect(config.tabSize).toBe(4)
    })
    
    it('should work with default config when no preferences', async () => {
      mockPreferenceService.getPreferences = vi.fn().mockResolvedValue({})
      
      await service.init()
      
      const config = service.getConfig()
      expect(config.theme).toBe('dark')
      expect(config.language).toBe('plaintext')
      expect(config.fontSize).toBe(14)
    })
    
    it('should register default commands', async () => {
      await service.init()
      
      const commands = service.getCommands()
      expect(commands.length).toBeGreaterThan(0)
      
      const saveCommand = commands.find(c => c.id === 'editor.save')
      expect(saveCommand).toBeDefined()
      expect(saveCommand?.keybinding).toBe('Ctrl+S')
    })
  })
  
  describe('config management', () => {
    it('should update configuration', async () => {
      await service.init()
      
      await service.updateConfig({
        theme: 'light',
        fontSize: 16
      })
      
      const config = service.getConfig()
      expect(config.theme).toBe('light')
      expect(config.fontSize).toBe(16)
      
      expect(mockPreferenceService.setPreference).toHaveBeenCalledWith(
        'editor',
        expect.objectContaining({
          theme: 'light',
          fontSize: 16
        })
      )
    })
  })
  
  describe('file operations', () => {
    beforeEach(async () => {
      await service.init()
    })
    
    it('should load file', async () => {
      const fileContent = 'test content'
      mockFileOperationsService.read = vi.fn().mockResolvedValue({
        path: '/test.js',
        content: fileContent,
        metadata: {
          name: 'test.js',
          path: '/test.js',
          size: fileContent.length,
          lastModified: new Date(),
          isDirectory: false
        }
      })
      
      await service.loadFile('/test.js')
      
      const state = service.getState()
      expect(state.currentFile).toBe('/test.js')
      expect(state.content).toBe(fileContent)
      expect(state.isDirty).toBe(false)
      
      const config = service.getConfig()
      expect(config.language).toBe('javascript')
    })
    
    it('should detect language from extension', async () => {
      const extensions = [
        { ext: 'test.ts', lang: 'typescript' },
        { ext: 'test.py', lang: 'python' },
        { ext: 'test.rs', lang: 'rust' },
        { ext: 'test.md', lang: 'markdown' },
        { ext: 'test.json', lang: 'json' },
        { ext: 'test.unknown', lang: 'plaintext' }
      ]
      
      for (const { ext, lang } of extensions) {
        mockFileOperationsService.read = vi.fn().mockResolvedValue({
          path: `/${ext}`,
          content: 'content',
          metadata: {
            name: ext,
            path: `/${ext}`,
            size: 7,
            lastModified: new Date(),
            isDirectory: false
          }
        })
        
        await service.loadFile(`/${ext}`)
        const config = service.getConfig()
        expect(config.language).toBe(lang)
      }
    })
    
    it('should save file', async () => {
      mockFileOperationsService.write = vi.fn().mockResolvedValue({
        success: true,
        message: 'Written'
      })
      
      service.updateContent('new content')
      await service.saveFile('/test.txt')
      
      expect(mockFileOperationsService.write).toHaveBeenCalledWith('/test.txt', 'new content')
      
      const state = service.getState()
      expect(state.isDirty).toBe(false)
      expect(state.currentFile).toBe('/test.txt')
    })
    
    it('should throw error when saving without path', async () => {
      await expect(service.saveFile()).rejects.toThrow('No file path specified')
    })
  })
  
  describe('content management', () => {
    beforeEach(async () => {
      await service.init()
    })
    
    it('should update content and mark as dirty', () => {
      service.updateContent('new content')
      
      expect(service.getContent()).toBe('new content')
      expect(service.getState().isDirty).toBe(true)
    })
    
    it('should not mark as dirty if content unchanged', () => {
      service.updateContent('content')
      const state1 = service.getState()
      expect(state1.isDirty).toBe(true)
      
      // Update with same content
      service.updateContent('content')
      const state2 = service.getState()
      expect(state2.isDirty).toBe(true) // Should remain dirty
    })
  })
  
  describe('cursor and selection', () => {
    beforeEach(async () => {
      await service.init()
      service.updateContent('Line 1\nLine 2\nLine 3')
    })
    
    it('should update cursor position', () => {
      service.updateCursor(2, 5)
      
      const state = service.getState()
      expect(state.cursor).toEqual({ line: 2, column: 5 })
    })
    
    it('should update selection', () => {
      service.updateSelection(
        { line: 1, column: 1 },
        { line: 2, column: 5 }
      )
      
      const state = service.getState()
      expect(state.selection).toEqual({
        start: { line: 1, column: 1 },
        end: { line: 2, column: 5 }
      })
    })
    
    it('should get selected text for single line', () => {
      service.updateSelection(
        { line: 1, column: 1 },
        { line: 1, column: 5 }
      )
      
      const selected = service.getSelectedText()
      expect(selected).toBe('Line')
    })
    
    it('should get selected text for multiple lines', () => {
      service.updateSelection(
        { line: 1, column: 6 },
        { line: 2, column: 5 }
      )
      
      const selected = service.getSelectedText()
      expect(selected).toBe('1\nLine')
    })
    
    it('should return empty string when no selection', () => {
      const selected = service.getSelectedText()
      expect(selected).toBe('')
    })
  })
  
  describe('commands', () => {
    beforeEach(async () => {
      await service.init()
    })
    
    it('should register and execute command', async () => {
      const handler = vi.fn()
      service.registerCommand({
        id: 'test.command',
        label: 'Test Command',
        handler
      })
      
      await service.executeCommand('test.command')
      
      expect(handler).toHaveBeenCalled()
    })
    
    it('should throw error for unknown command', async () => {
      await expect(service.executeCommand('unknown.command')).rejects.toThrow('Command not found: unknown.command')
    })
    
    it('should list all commands', () => {
      const handler = vi.fn()
      service.registerCommand({
        id: 'custom.command',
        label: 'Custom Command',
        handler
      })
      
      const commands = service.getCommands()
      const customCommand = commands.find(c => c.id === 'custom.command')
      expect(customCommand).toBeDefined()
      expect(customCommand?.label).toBe('Custom Command')
    })
  })
  
  describe('optimization', () => {
    beforeEach(async () => {
      await service.init()
      service.updateContent('original content')
    })
    
    it('should register and apply optimization handler', async () => {
      const optimizationHandler = vi.fn().mockResolvedValue('optimized content')
      service.registerOptimizationHandler('test-optimization', optimizationHandler)
      
      await service.applyOptimization('test-optimization')
      
      expect(optimizationHandler).toHaveBeenCalledWith('original content')
      expect(service.getContent()).toBe('optimized content')
      expect(service.getState().isDirty).toBe(true)
    })
    
    it('should throw error for unknown optimization', async () => {
      await expect(service.applyOptimization('unknown')).rejects.toThrow('Optimization handler not found: unknown')
    })
    
    it('should get content for optimization', () => {
      const content = service.getContentForOptimization()
      expect(content).toBe('original content')
    })
    
    it('should apply optimization result', () => {
      service.applyOptimizationResult('result content')
      
      expect(service.getContent()).toBe('result content')
      expect(service.getState().isDirty).toBe(true)
    })
  })
  
  describe('health check', () => {
    beforeEach(async () => {
      await service.init()
    })
    
    it('should pass health check when services are healthy', async () => {
      const result = await service.checkHealth()
      
      expect(result).toBe(true)
      expect(mockPreferenceService.getPreferences).toHaveBeenCalled()
      expect(mockFileOperationsService.checkHealth).toHaveBeenCalled()
    })
    
    it('should fail health check when preference service fails', async () => {
      mockPreferenceService.getPreferences = vi.fn().mockRejectedValue(new Error('Preference error'))
      
      const result = await service.checkHealth()
      
      expect(result).toBe(false)
    })
    
    it('should fail health check when file operations fail', async () => {
      mockFileOperationsService.checkHealth = vi.fn().mockResolvedValue(false)
      
      const result = await service.checkHealth()
      
      expect(result).toBe(false)
    })
  })
  
  describe('auto-save', () => {
    it('should setup auto-save when enabled', async () => {
      vi.useFakeTimers()
      
      mockPreferenceService.getPreferences = vi.fn().mockResolvedValue({
        editor: {
          autoSave: true,
          autoSaveDelay: 1000
        }
      })
      
      const newService = new EditorService(mockPreferenceService, mockFileOperationsService)
      await newService.init()
      
      // Load a file
      mockFileOperationsService.read = vi.fn().mockResolvedValue({
        path: '/test.txt',
        content: 'content',
        metadata: {
          name: 'test.txt',
          path: '/test.txt',
          size: 7,
          lastModified: new Date(),
          isDirectory: false
        }
      })
      mockFileOperationsService.write = vi.fn().mockResolvedValue({
        success: true
      })
      
      await newService.loadFile('/test.txt')
      newService.updateContent('changed content')
      
      // Fast-forward time
      vi.advanceTimersByTime(1000)
      
      // Allow promises to resolve
      await vi.runAllTimersAsync()
      
      expect(mockFileOperationsService.write).toHaveBeenCalledWith('/test.txt', 'changed content')
      
      newService.cleanup()
      vi.useRealTimers()
    })
  })
})