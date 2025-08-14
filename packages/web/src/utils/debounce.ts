/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns The debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function debounced(...args: Parameters<T>): void {
    // Clear existing timeout if any
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, wait)
  }
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 * 
 * @param func The function to throttle
 * @param wait The number of milliseconds to throttle invocations to
 * @returns The throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  let lastArgs: Parameters<T> | null = null

  return function throttled(...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      
      setTimeout(() => {
        inThrottle = false
        if (lastArgs !== null) {
          throttled(...lastArgs)
          lastArgs = null
        }
      }, wait)
    } else {
      lastArgs = args
    }
  }
}