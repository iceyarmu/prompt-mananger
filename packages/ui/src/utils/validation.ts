/**
 * Filename validation and sanitization utilities
 */

// Reserved names on Windows that should be avoided for cross-platform compatibility
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  // Additional reserved names for safety
  'CLOCK$', 'CONFIG$'
]

// Additional invalid characters for different OS
const INVALID_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F\x7F]/g
const INVALID_ENDING_CHARS = /[\s.]$/

/**
 * Validate a filename
 * @param filename The filename to validate
 * @param isFolder Whether this is a folder name
 * @returns Error message if invalid, null if valid
 */
export function validateFilename(filename: string, isFolder: boolean = false): string | null {
  // Check if empty
  if (!filename.trim()) {
    return 'Name cannot be empty'
  }
  
  // Check length
  if (filename.length > 255) {
    return 'Name too long (max 255 characters)'
  }
  
  // For files, check if it has .md extension
  if (!isFolder) {
    const nameWithoutExt = filename.replace(/\.md$/i, '')
    if (!nameWithoutExt) {
      return 'File name cannot be just .md'
    }
  }
  
  // Check for invalid characters - more comprehensive check
  if (INVALID_CHARS_REGEX.test(filename)) {
    return 'Name contains invalid characters'
  }
  
  // Allow alphanumeric, dash, underscore, space, and period
  if (!/^[a-zA-Z0-9\s\-_.]+$/.test(filename)) {
    return 'Name contains invalid characters. Use only letters, numbers, spaces, dashes, underscores, and periods.'
  }
  
  // Check for leading/trailing dots or spaces (cross-platform issue)
  if (filename.startsWith('.') || filename.startsWith(' ') || INVALID_ENDING_CHARS.test(filename)) {
    return 'Name cannot start with a dot or have leading/trailing spaces or dots'
  }
  
  // Check for only dots (., .., etc)
  if (/^\.+$/.test(filename)) {
    return 'Name cannot consist only of dots'
  }
  
  // Check reserved names
  const baseName = filename.replace(/\.md$/i, '').toUpperCase()
  if (RESERVED_NAMES.includes(baseName)) {
    return `"${baseName}" is a reserved name`
  }
  
  return null
}

/**
 * Sanitize a filename by removing invalid characters
 * @param filename The filename to sanitize
 * @param isFolder Whether this is a folder name
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string, isFolder: boolean = false): string {
  let sanitized = filename
    .trim()
    // Remove invalid characters (comprehensive)
    .replace(INVALID_CHARS_REGEX, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove leading dots and spaces
    .replace(/^[\s.]+/, '')
    // Remove trailing dots and spaces
    .replace(INVALID_ENDING_CHARS, '')
  
  // If empty after sanitization, provide default
  if (!sanitized) {
    sanitized = isFolder ? 'new-folder' : 'new-file'
  }
  
  // For files, ensure .md extension
  if (!isFolder && !sanitized.toLowerCase().endsWith('.md')) {
    sanitized += '.md'
  }
  
  return sanitized
}

/**
 * Check if a name already exists in a list of items
 * @param name The name to check
 * @param existingNames List of existing names
 * @param currentName The current name (for rename operations)
 * @returns True if duplicate exists
 */
export function isDuplicateName(
  name: string, 
  existingNames: string[], 
  currentName?: string
): boolean {
  const normalizedName = name.toLowerCase()
  const normalizedCurrent = currentName?.toLowerCase()
  
  return existingNames.some(existing => {
    const normalizedExisting = existing.toLowerCase()
    return normalizedExisting === normalizedName && normalizedExisting !== normalizedCurrent
  })
}

/**
 * Generate a unique name by appending a number
 * @param baseName The base name
 * @param existingNames List of existing names
 * @param isFolder Whether this is a folder
 * @returns A unique name
 */
export function generateUniqueName(
  baseName: string, 
  existingNames: string[], 
  isFolder: boolean = false
): string {
  let name = baseName
  let counter = 1
  
  // Remove .md extension for comparison if it's a file
  const baseWithoutExt = !isFolder ? baseName.replace(/\.md$/i, '') : baseName
  
  while (isDuplicateName(name, existingNames)) {
    if (isFolder) {
      name = `${baseWithoutExt}-${counter}`
    } else {
      name = `${baseWithoutExt}-${counter}.md`
    }
    counter++
  }
  
  return name
}