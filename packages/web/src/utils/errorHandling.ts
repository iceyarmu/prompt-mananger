import { createLogger } from './logger'

const logger = createLogger('ErrorHandler')

export interface ErrorInfo {
  message: string
  stack?: string
  code?: string
  timestamp: number
  userAgent: string
  url: string
}

/**
 * Setup global error handling for the application
 */
export function setupErrorHandling(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise
    })
    
    // Prevent default browser behavior in production
    if (import.meta.env.PROD) {
      event.preventDefault()
    }
    
    reportError({
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      code: 'UNHANDLED_REJECTION'
    })
  })
  
  // Handle global errors
  window.addEventListener('error', (event) => {
    logger.error('Global error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
    
    // Prevent default browser behavior in production
    if (import.meta.env.PROD) {
      event.preventDefault()
    }
    
    reportError({
      message: event.message,
      stack: event.error?.stack,
      code: 'GLOBAL_ERROR'
    })
  })
  
  // Override console.error in production
  if (import.meta.env.PROD) {
    const originalConsoleError = console.error
    console.error = (...args) => {
      logger.error('Console error', args)
      reportError({
        message: args.map(arg => String(arg)).join(' '),
        code: 'CONSOLE_ERROR'
      })
      originalConsoleError.apply(console, args)
    }
  }
}

/**
 * Report error to logging service
 */
function reportError(error: Partial<ErrorInfo>): void {
  const errorInfo: ErrorInfo = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    code: error.code,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href
  }
  
  // In production, could send to error reporting service
  if (import.meta.env.PROD) {
    // TODO: Send to error reporting service (e.g., Sentry)
    logger.error('Error reported', errorInfo)
  } else {
    logger.debug('Error reported (dev mode)', errorInfo)
  }
}

/**
 * Create an error with additional context
 */
export function createContextualError(
  message: string,
  code: string,
  context?: Record<string, any>
): Error {
  const error = new Error(message)
  ;(error as any).code = code
  ;(error as any).context = context
  return error
}

/**
 * Gracefully handle async errors
 */
export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    logger.error('Async operation failed', error)
    reportError({
      message: (error as Error).message,
      stack: (error as Error).stack,
      code: 'ASYNC_ERROR'
    })
    return fallback
  }
}