import { ref, onMounted, onUnmounted } from 'vue'

export interface ShortcutKey {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}

export interface ShortcutHandler {
  id: string
  keys: ShortcutKey
  description: string
  handler: (event: KeyboardEvent) => void
  context?: string // 'global' | 'editor' | 'fileTree' | 'panel'
  priority?: number // Higher number = higher priority
  enabled?: boolean
}

class KeyboardShortcutRegistry {
  private shortcuts = new Map<string, ShortcutHandler[]>()
  private activeContext = ref<string>('global')
  private enabled = ref(true)
  private listeners = new Map<string, Function[]>()

  constructor() {
    this.initializeDefaultShortcuts()
  }

  private initializeDefaultShortcuts() {
    // Default shortcuts will be registered by components
    // This method is kept for potential future initialization logic
  }

  private getShortcutKey(keys: ShortcutKey): string {
    const parts = []
    if (keys.ctrl) parts.push('ctrl')
    if (keys.alt) parts.push('alt')
    if (keys.shift) parts.push('shift')
    if (keys.meta) parts.push('meta')
    parts.push(keys.key.toLowerCase())
    return parts.join('+')
  }

  private matchesShortcut(event: KeyboardEvent, keys: ShortcutKey): boolean {
    // Check modifier keys
    if (!!keys.ctrl !== (event.ctrlKey || event.metaKey)) return false
    if (!!keys.alt !== event.altKey) return false
    if (!!keys.shift !== event.shiftKey) return false
    if (keys.meta && !event.metaKey) return false

    // Check main key
    const eventKey = event.key.toLowerCase()
    const targetKey = keys.key.toLowerCase()
    
    // Handle special keys
    if (targetKey === 'escape' && eventKey === 'escape') return true
    if (targetKey === 'enter' && eventKey === 'enter') return true
    if (targetKey === 'tab' && eventKey === 'tab') return true
    
    // Handle regular keys
    return eventKey === targetKey
  }

  register(shortcut: ShortcutHandler): void {
    const key = this.getShortcutKey(shortcut.keys)
    
    if (!this.shortcuts.has(key)) {
      this.shortcuts.set(key, [])
    }
    
    const handlers = this.shortcuts.get(key)!
    
    // Check for conflicts
    const conflict = handlers.find(h => 
      h.context === shortcut.context && 
      h.id !== shortcut.id
    )
    
    if (conflict) {
      console.warn(
        `Keyboard shortcut conflict: ${key} is already registered for ${conflict.description} in context ${conflict.context}`
      )
    }
    
    // Add handler, maintaining priority order
    handlers.push(shortcut)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    
    // Emit registration event
    this.emit('shortcut-registered', shortcut)
  }

  unregister(id: string): void {
    for (const [key, handlers] of this.shortcuts.entries()) {
      const index = handlers.findIndex(h => h.id === id)
      if (index !== -1) {
        handlers.splice(index, 1)
        if (handlers.length === 0) {
          this.shortcuts.delete(key)
        }
        this.emit('shortcut-unregistered', id)
        return
      }
    }
  }

  setContext(context: string): void {
    this.activeContext.value = context
    this.emit('context-changed', context)
  }

  getContext(): string {
    return this.activeContext.value
  }

  enable(): void {
    this.enabled.value = true
  }

  disable(): void {
    this.enabled.value = false
  }

  isEnabled(): boolean {
    return this.enabled.value
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.enabled.value) return

    // Check if the event target is an input element (skip shortcuts in inputs)
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true') {
      // Allow Ctrl+S even in inputs
      if (!(event.ctrlKey && event.key === 's')) {
        return
      }
    }

    // Find matching shortcuts
    for (const [_, handlers] of this.shortcuts.entries()) {
      for (const handler of handlers) {
        if (handler.enabled === false) continue
        
        // Check if shortcut matches
        if (!this.matchesShortcut(event, handler.keys)) continue
        
        // Check context
        if (handler.context && 
            handler.context !== 'global' && 
            handler.context !== this.activeContext.value) {
          continue
        }
        
        // Execute handler
        event.preventDefault()
        event.stopPropagation()
        
        try {
          handler.handler(event)
          this.emit('shortcut-executed', {
            shortcut: handler,
            event
          })
        } catch (error) {
          console.error(`Error executing shortcut ${handler.id}:`, error)
          this.emit('shortcut-error', {
            shortcut: handler,
            error
          })
        }
        
        // Stop after first matching handler
        return
      }
    }
  }

  getShortcuts(context?: string): ShortcutHandler[] {
    const allShortcuts: ShortcutHandler[] = []
    
    for (const handlers of this.shortcuts.values()) {
      for (const handler of handlers) {
        if (!context || handler.context === context || handler.context === 'global') {
          allShortcuts.push(handler)
        }
      }
    }
    
    return allShortcuts
  }

  getShortcutDisplay(keys: ShortcutKey): string {
    const parts = []
    
    // Use appropriate symbols for the platform
    const isMac = navigator.platform.toLowerCase().includes('mac')
    
    if (keys.ctrl) parts.push(isMac ? '⌘' : 'Ctrl')
    if (keys.alt) parts.push(isMac ? '⌥' : 'Alt')
    if (keys.shift) parts.push(isMac ? '⇧' : 'Shift')
    if (keys.meta && !isMac) parts.push('Meta')
    
    // Format the key
    let keyDisplay = keys.key
    if (keyDisplay.length === 1) {
      keyDisplay = keyDisplay.toUpperCase()
    }
    parts.push(keyDisplay)
    
    return parts.join(isMac ? '' : '+')
  }

  private emit(event: string, data?: any): void {
    const handlers = this.listeners.get(event)
    if (handlers && Array.isArray(handlers)) {
      handlers.forEach(handler => handler(data))
    }
  }

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    const handlers = this.listeners.get(event)
    if (Array.isArray(handlers)) {
      handlers.push(handler)
    }
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event)
    if (Array.isArray(handlers)) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  reset(): void {
    this.shortcuts.clear()
    this.activeContext.value = 'global'
    this.enabled.value = true
    this.listeners.clear()
    this.initializeDefaultShortcuts()
  }
}

// Create singleton instance
const shortcutRegistry = new KeyboardShortcutRegistry()

// Store the event handler reference for cleanup
let keydownHandler: ((event: KeyboardEvent) => void) | null = null

// Global keyboard event handler
if (typeof window !== 'undefined') {
  keydownHandler = (event: KeyboardEvent) => {
    shortcutRegistry.handleKeydown(event)
  }
  window.addEventListener('keydown', keydownHandler)
}

// Cleanup function for removing event listener
function cleanupKeyboardShortcuts() {
  if (typeof window !== 'undefined' && keydownHandler) {
    window.removeEventListener('keydown', keydownHandler)
    keydownHandler = null
  }
}

// Vue composable
export function useKeyboardShortcuts() {
  const register = (shortcut: ShortcutHandler) => {
    shortcutRegistry.register(shortcut)
    
    // Auto-unregister on component unmount
    onUnmounted(() => {
      shortcutRegistry.unregister(shortcut.id)
    })
  }

  const unregister = (id: string) => {
    shortcutRegistry.unregister(id)
  }

  const setContext = (context: string) => {
    shortcutRegistry.setContext(context)
  }

  const getContext = () => {
    return shortcutRegistry.getContext()
  }

  const enable = () => {
    shortcutRegistry.enable()
  }

  const disable = () => {
    shortcutRegistry.disable()
  }

  const getShortcuts = (context?: string) => {
    return shortcutRegistry.getShortcuts(context)
  }

  const getShortcutDisplay = (keys: ShortcutKey) => {
    return shortcutRegistry.getShortcutDisplay(keys)
  }

  onMounted(() => {
    // Component-specific setup if needed
  })

  onUnmounted(() => {
    // Cleanup if needed
  })

  return {
    register,
    unregister,
    setContext,
    getContext,
    enable,
    disable,
    getShortcuts,
    getShortcutDisplay,
    registry: shortcutRegistry
  }
}

// Export the class for testing purposes
export { KeyboardShortcutRegistry }

export { shortcutRegistry, cleanupKeyboardShortcuts }
export default shortcutRegistry