/**
 * Logging service for application-wide debugging and monitoring
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
  context?: string
  data?: any
  error?: Error
}

export interface Logger {
  debug(message: string, data?: any): void
  info(message: string, data?: any): void
  warn(message: string, data?: any): void
  error(message: string, error?: any): void
  setLevel(level: LogLevel): void
  getHistory(): LogEntry[]
}

class LoggerImpl implements Logger {
  private static instance: LoggerImpl
  private logLevel: LogLevel = 'info'
  private history: LogEntry[] = []
  private maxHistorySize = 1000
  private context: string
  
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }
  
  constructor(context: string = 'Application') {
    this.context = context
    this.logLevel = this.getConfiguredLevel()
  }
  
  private getConfiguredLevel(): LogLevel {
    const env = import.meta.env
    if (env.DEV) return 'debug'
    return (env.VITE_LOG_LEVEL as LogLevel) || 'info'
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel]
  }
  
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`
  }
  
  private addToHistory(entry: LogEntry): void {
    this.history.push(entry)
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
  }
  
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: this.context,
      data,
      error: data instanceof Error ? data : undefined
    }
    
    this.addToHistory(entry)
    
    const formattedMessage = this.formatMessage(level, message)
    
    // Console output
    if (import.meta.env.VITE_LOG_CONSOLE !== 'false') {
      switch (level) {
        case 'debug':
          console.debug(formattedMessage, data || '')
          break
        case 'info':
          console.info(formattedMessage, data || '')
          break
        case 'warn':
          console.warn(formattedMessage, data || '')
          break
        case 'error':
          console.error(formattedMessage, data || '')
          if (data instanceof Error) {
            console.error(data.stack)
          }
          break
      }
    }
    
    // Remote logging (if enabled)
    if (import.meta.env.VITE_LOG_REMOTE === 'true' && level === 'error') {
      this.sendToRemote(entry)
    }
  }
  
  private async sendToRemote(entry: LogEntry): Promise<void> {
    // TODO: Implement remote logging service integration
    // This could send to a service like Sentry, LogRocket, etc.
    try {
      // Placeholder for remote logging
      if (import.meta.env.VITE_REMOTE_LOG_URL) {
        await fetch(import.meta.env.VITE_REMOTE_LOG_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        }).catch(() => {
          // Silently fail remote logging
        })
      }
    } catch {
      // Never let remote logging errors affect the application
    }
  }
  
  debug(message: string, data?: any): void {
    this.log('debug', message, data)
  }
  
  info(message: string, data?: any): void {
    this.log('info', message, data)
  }
  
  warn(message: string, data?: any): void {
    this.log('warn', message, data)
  }
  
  error(message: string, error?: any): void {
    this.log('error', message, error)
  }
  
  setLevel(level: LogLevel): void {
    this.logLevel = level
    this.info(`Log level changed to ${level}`)
  }
  
  getHistory(): LogEntry[] {
    return [...this.history]
  }
}

// Logger factory with context support
const loggerInstances = new Map<string, Logger>()

export function createLogger(context: string = 'Application'): Logger {
  if (!loggerInstances.has(context)) {
    loggerInstances.set(context, new LoggerImpl(context))
  }
  return loggerInstances.get(context)!
}

// Global logger instance
export const globalLogger = createLogger('Global')

// Development-only utilities
if (import.meta.env.DEV) {
  // Expose logger to window for debugging
  (window as any).__logger = {
    loggers: loggerInstances,
    getHistory: () => {
      const allHistory: LogEntry[] = []
      loggerInstances.forEach(logger => {
        allHistory.push(...logger.getHistory())
      })
      return allHistory.sort((a, b) => a.timestamp - b.timestamp)
    },
    setGlobalLevel: (level: LogLevel) => {
      loggerInstances.forEach(logger => {
        logger.setLevel(level)
      })
    },
    clear: () => {
      loggerInstances.clear()
    }
  }
}