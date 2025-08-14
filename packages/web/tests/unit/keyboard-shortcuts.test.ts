import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { KeyboardShortcutRegistry, useKeyboardShortcuts } from '../../src/utils/KeyboardShortcuts'

describe('Keyboard Shortcuts', () => {
  let registry: KeyboardShortcutRegistry
  
  beforeEach(() => {
    // Create a new registry instance for each test
    registry = new KeyboardShortcutRegistry()
  })
  
  afterEach(() => {
    registry.reset()
  })
  
  describe('Task 7.1: Keyboard Shortcut Registry', () => {
    it('should register a keyboard shortcut', () => {
      const handler = vi.fn()
      
      registry.register({
        id: 'test-shortcut',
        keys: { key: 's', ctrl: true },
        description: 'Test shortcut',
        handler,
        context: 'global',
        priority: 100
      })
      
      const shortcuts = registry.getShortcuts()
      expect(shortcuts).toHaveLength(1)
      expect(shortcuts[0].id).toBe('test-shortcut')
    })
    
    it('should unregister a keyboard shortcut', () => {
      const handler = vi.fn()
      
      registry.register({
        id: 'test-shortcut',
        keys: { key: 's', ctrl: true },
        description: 'Test shortcut',
        handler
      })
      
      registry.unregister('test-shortcut')
      
      const shortcuts = registry.getShortcuts()
      expect(shortcuts).toHaveLength(0)
    })
  })
  
  describe('Task 7.2: Component-Specific Shortcuts', () => {
    it('should register shortcuts with different contexts', () => {
      const globalHandler = vi.fn()
      const editorHandler = vi.fn()
      
      registry.register({
        id: 'global-shortcut',
        keys: { key: 's', ctrl: true },
        description: 'Global shortcut',
        handler: globalHandler,
        context: 'global'
      })
      
      registry.register({
        id: 'editor-shortcut',
        keys: { key: 'f', ctrl: true },
        description: 'Editor shortcut',
        handler: editorHandler,
        context: 'editor'
      })
      
      const globalShortcuts = registry.getShortcuts('global')
      expect(globalShortcuts).toHaveLength(1)
      
      const editorShortcuts = registry.getShortcuts('editor')
      expect(editorShortcuts).toHaveLength(1)
    })
    
    it('should change context and affect shortcut handling', () => {
      const handler = vi.fn()
      
      registry.register({
        id: 'editor-only',
        keys: { key: 'f', ctrl: true },
        description: 'Editor only',
        handler,
        context: 'editor'
      })
      
      // Set context to global - editor shortcut shouldn't trigger
      registry.setContext('global')
      expect(registry.getContext()).toBe('global')
      
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true
      })
      
      registry.handleKeydown(event)
      expect(handler).not.toHaveBeenCalled()
      
      // Change to editor context - now it should trigger
      registry.setContext('editor')
      registry.handleKeydown(event)
      expect(handler).toHaveBeenCalled()
    })
  })
  
  describe('Task 7.3: Shortcut Conflicts and Precedence', () => {
    it('should handle shortcut priority correctly', () => {
      const highPriorityHandler = vi.fn()
      const lowPriorityHandler = vi.fn()
      
      registry.register({
        id: 'high-priority',
        keys: { key: 's', ctrl: true },
        description: 'High priority',
        handler: highPriorityHandler,
        priority: 100
      })
      
      registry.register({
        id: 'low-priority',
        keys: { key: 's', ctrl: true },
        description: 'Low priority',
        handler: lowPriorityHandler,
        priority: 50
      })
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true
      })
      
      registry.handleKeydown(event)
      
      // Only high priority handler should be called
      expect(highPriorityHandler).toHaveBeenCalledOnce()
      expect(lowPriorityHandler).not.toHaveBeenCalled()
    })
    
    it('should warn about conflicting shortcuts', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      registry.register({
        id: 'first',
        keys: { key: 's', ctrl: true },
        description: 'First shortcut',
        handler: vi.fn(),
        context: 'global'
      })
      
      registry.register({
        id: 'second',
        keys: { key: 's', ctrl: true },
        description: 'Second shortcut',
        handler: vi.fn(),
        context: 'global'
      })
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keyboard shortcut conflict')
      )
      
      warnSpy.mockRestore()
    })
  })
  
  describe('Task 7.4: Ctrl+S and Ctrl+O Implementation', () => {
    it('should handle Ctrl+S shortcut', () => {
      const saveHandler = vi.fn()
      
      registry.register({
        id: 'save-file',
        keys: { key: 's', ctrl: true },
        description: 'Save file',
        handler: saveHandler
      })
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      })
      
      registry.handleKeydown(event)
      
      expect(saveHandler).toHaveBeenCalledWith(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })
    
    it('should handle Ctrl+O shortcut', () => {
      const openHandler = vi.fn()
      
      registry.register({
        id: 'open-file',
        keys: { key: 'o', ctrl: true },
        description: 'Open file',
        handler: openHandler
      })
      
      const event = new KeyboardEvent('keydown', {
        key: 'o',
        ctrlKey: true,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      })
      
      registry.handleKeydown(event)
      
      expect(openHandler).toHaveBeenCalledWith(event)
    })
  })
  
  describe('Task 7.5: Panel Navigation Shortcuts', () => {
    it('should handle Ctrl+1/2/3 for panel navigation', () => {
      const panel1Handler = vi.fn()
      const panel2Handler = vi.fn()
      const panel3Handler = vi.fn()
      
      registry.register({
        id: 'panel-1',
        keys: { key: '1', ctrl: true },
        description: 'Focus panel 1',
        handler: panel1Handler
      })
      
      registry.register({
        id: 'panel-2',
        keys: { key: '2', ctrl: true },
        description: 'Focus panel 2',
        handler: panel2Handler
      })
      
      registry.register({
        id: 'panel-3',
        keys: { key: '3', ctrl: true },
        description: 'Focus panel 3',
        handler: panel3Handler
      })
      
      // Test Ctrl+1
      const event1 = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true
      })
      registry.handleKeydown(event1)
      expect(panel1Handler).toHaveBeenCalled()
      
      // Test Ctrl+2
      const event2 = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true
      })
      registry.handleKeydown(event2)
      expect(panel2Handler).toHaveBeenCalled()
      
      // Test Ctrl+3
      const event3 = new KeyboardEvent('keydown', {
        key: '3',
        ctrlKey: true
      })
      registry.handleKeydown(event3)
      expect(panel3Handler).toHaveBeenCalled()
    })
  })
  
  describe('Keyboard Event Handling', () => {
    it('should skip shortcuts when typing in input fields', () => {
      const handler = vi.fn()
      
      registry.register({
        id: 'test',
        keys: { key: 'a', ctrl: true },
        description: 'Test',
        handler
      })
      
      // Create event with input as target
      const inputElement = document.createElement('input')
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true
      })
      
      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false
      })
      
      registry.handleKeydown(event)
      expect(handler).not.toHaveBeenCalled()
    })
    
    it('should allow Ctrl+S even in input fields', () => {
      const saveHandler = vi.fn()
      
      registry.register({
        id: 'save',
        keys: { key: 's', ctrl: true },
        description: 'Save',
        handler: saveHandler
      })
      
      // Create event with input as target
      const inputElement = document.createElement('input')
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      })
      
      Object.defineProperty(event, 'target', {
        value: inputElement,
        writable: false
      })
      
      registry.handleKeydown(event)
      expect(saveHandler).toHaveBeenCalled()
    })
    
    it('should disable/enable shortcuts globally', () => {
      const handler = vi.fn()
      
      registry.register({
        id: 'test',
        keys: { key: 's', ctrl: true },
        description: 'Test',
        handler
      })
      
      // Disable shortcuts
      registry.disable()
      expect(registry.isEnabled()).toBe(false)
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true
      })
      
      registry.handleKeydown(event)
      expect(handler).not.toHaveBeenCalled()
      
      // Re-enable shortcuts
      registry.enable()
      expect(registry.isEnabled()).toBe(true)
      
      registry.handleKeydown(event)
      expect(handler).toHaveBeenCalled()
    })
    
    it('should handle special keys like Escape', () => {
      const escapeHandler = vi.fn()
      
      registry.register({
        id: 'escape',
        keys: { key: 'Escape' },
        description: 'Escape',
        handler: escapeHandler
      })
      
      const event = new KeyboardEvent('keydown', {
        key: 'Escape'
      })
      
      registry.handleKeydown(event)
      expect(escapeHandler).toHaveBeenCalled()
    })
  })
  
  describe('Display Formatting', () => {
    it('should format shortcuts for display on Mac', () => {
      // Mock Mac platform
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true
      })
      
      const display = registry.getShortcutDisplay({
        key: 's',
        ctrl: true
      })
      
      expect(display).toBe('⌘S')
    })
    
    it('should format shortcuts for display on Windows/Linux', () => {
      // Mock Windows platform
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true
      })
      
      const display = registry.getShortcutDisplay({
        key: 's',
        ctrl: true
      })
      
      expect(display).toBe('Ctrl+S')
    })
    
    it('should format complex shortcuts', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true
      })
      
      const display = registry.getShortcutDisplay({
        key: 'f',
        ctrl: true,
        shift: true,
        alt: true
      })
      
      expect(display).toBe('Ctrl+Alt+Shift+F')
    })
  })
  
  describe('Event System', () => {
    it('should emit events on shortcut registration', () => {
      const listener = vi.fn()
      registry.on('shortcut-registered', listener)
      
      const shortcut = {
        id: 'test',
        keys: { key: 's', ctrl: true },
        description: 'Test',
        handler: vi.fn()
      }
      
      registry.register(shortcut)
      
      expect(listener).toHaveBeenCalledWith(shortcut)
    })
    
    it('should emit events on shortcut execution', () => {
      const listener = vi.fn()
      registry.on('shortcut-executed', listener)
      
      const handler = vi.fn()
      registry.register({
        id: 'test',
        keys: { key: 's', ctrl: true },
        description: 'Test',
        handler
      })
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true
      })
      
      registry.handleKeydown(event)
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          shortcut: expect.objectContaining({ id: 'test' }),
          event
        })
      )
    })
    
    it('should handle errors in shortcut handlers', () => {
      const errorListener = vi.fn()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      registry.on('shortcut-error', errorListener)
      
      const error = new Error('Handler error')
      const handler = vi.fn().mockImplementation(() => {
        throw error
      })
      
      registry.register({
        id: 'failing',
        keys: { key: 's', ctrl: true },
        description: 'Failing',
        handler
      })
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true
      })
      
      registry.handleKeydown(event)
      
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          shortcut: expect.objectContaining({ id: 'failing' }),
          error
        })
      )
      
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })
})