import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useMarkdownEditor, validateFilePath, validateFile, LoadingState } from '../useMarkdownEditor';

// Mock the dependencies
vi.mock('../useServices', () => ({
  useServices: () => ({
    services: {
      value: {
        webdavService: {
          getFile: vi.fn(),
          putFile: vi.fn(),
          getFileInfo: vi.fn()
        }
      }
    }
  })
}));

vi.mock('../useTheme', () => ({
  useTheme: () => ({
    currentTheme: { value: 'light' }
  })
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'en' }
  })
}));

vi.mock('../../utils/notification', () => ({
  showNotification: vi.fn()
}));

describe('useMarkdownEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('loads file content correctly', async () => {
    const mockFile = { 
      path: '/test.md', 
      name: 'test.md',
      type: 'file' as const 
    };
    const mockContent = '# Test Content';
    
    const { loadFile, content } = useMarkdownEditor();
    
    // Mock the WebDAV service response
    const { services } = await import('../useServices');
    vi.mocked(services.value?.webdavService.getFile).mockResolvedValue(mockContent);
    
    await loadFile(mockFile);
    
    expect(content.value).toBe(mockContent);
  });

  test('tracks unsaved changes', () => {
    const { content, originalContent, hasUnsavedChanges } = useMarkdownEditor();
    
    originalContent.value = 'original';
    content.value = 'original';
    expect(hasUnsavedChanges.value).toBe(false);
    
    content.value = 'modified content';
    expect(hasUnsavedChanges.value).toBe(true);
  });

  test('detects editor theme correctly', () => {
    const { editorTheme } = useMarkdownEditor();
    expect(editorTheme.value).toBe('light');
  });

  test('sets view mode correctly', () => {
    const { currentViewMode, setViewMode } = useMarkdownEditor();
    
    expect(currentViewMode.value).toBe('edit');
    
    setViewMode('preview');
    expect(currentViewMode.value).toBe('preview');
    
    setViewMode('split');
    expect(currentViewMode.value).toBe('split');
  });

  test('handles content changes with debouncing', async () => {
    const { handleContentChange, content } = useMarkdownEditor();
    
    handleContentChange('new content');
    
    // Content should not change immediately due to debouncing
    expect(content.value).toBe('');
    
    // Wait for debounce delay
    await new Promise(resolve => setTimeout(resolve, 350));
    
    expect(content.value).toBe('new content');
  });

  test('saves file when there are unsaved changes', async () => {
    const { content, originalContent, currentFile, saveFile } = useMarkdownEditor();
    const { showNotification } = await import('../../utils/notification');
    const { services } = await import('../useServices');
    
    // Set up file and content
    currentFile.value = { 
      name: 'test.md', 
      path: '/test.md',
      type: 'file' 
    };
    originalContent.value = 'original';
    content.value = 'modified';
    
    await saveFile();
    
    expect(services.value?.webdavService.putFile).toHaveBeenCalledWith({
      path: '/test.md',
      content: 'modified'
    });
    expect(originalContent.value).toBe('modified');
    expect(showNotification).toHaveBeenCalledWith('editor.saved', 'success');
  });

  test('does not save when no unsaved changes', async () => {
    const { content, originalContent, currentFile, saveFile } = useMarkdownEditor();
    const { services } = await import('../useServices');
    
    currentFile.value = { 
      name: 'test.md', 
      path: '/test.md',
      type: 'file' 
    };
    content.value = 'same';
    originalContent.value = 'same';
    
    await saveFile();
    
    expect(services.value?.webdavService.putFile).not.toHaveBeenCalled();
  });

  test('handles file load errors', async () => {
    const mockFile = { 
      path: '/test.md', 
      name: 'test.md',
      type: 'file' as const 
    };
    
    const { loadFile, loading } = useMarkdownEditor();
    const { services } = await import('../useServices');
    
    // Mock error response
    vi.mocked(services.value?.webdavService.getFile).mockRejectedValue(
      new Error('Network error')
    );
    
    await loadFile(mockFile);
    
    expect(loading.value).toBe(false);
  });

  test('toolbar configuration includes expected tools', () => {
    const { toolbarConfig } = useMarkdownEditor();
    
    expect(toolbarConfig.value).toContain('bold');
    expect(toolbarConfig.value).toContain('italic');
    expect(toolbarConfig.value).toContain('code');
    expect(toolbarConfig.value).toContain('link');
    expect(toolbarConfig.value).toContain('image');
    expect(toolbarConfig.value).toContain('save');
  });
});

describe('validateFilePath', () => {
  test('validates safe paths correctly', () => {
    expect(() => validateFilePath('documents/notes.md')).not.toThrow();
    expect(() => validateFilePath('folder/subfolder/file.txt')).not.toThrow();
    expect(() => validateFilePath('/home/user/documents/notes.md')).not.toThrow();
    expect(() => validateFilePath('./file.md')).not.toThrow();
    expect(() => validateFilePath('C:/Users/name/documents/notes.md')).not.toThrow();
  });

  test('rejects path traversal attempts', () => {
    expect(() => validateFilePath('../../../etc/passwd')).toThrow('path traversal detected');
    expect(() => validateFilePath('documents/../../../etc/passwd')).toThrow('path traversal detected');
    expect(() => validateFilePath('folder/../../../system/file.txt')).toThrow('path traversal detected');
    expect(() => validateFilePath('..\\..\\windows\\system32\\file.txt')).toThrow('path traversal detected');
  });

  test('rejects access to system directories', () => {
    expect(() => validateFilePath('/etc/passwd')).toThrow('access to system directories not allowed');
    expect(() => validateFilePath('/proc/cpuinfo')).toThrow('access to system directories not allowed');
    expect(() => validateFilePath('/sys/kernel/debug')).toThrow('access to system directories not allowed');
    expect(() => validateFilePath('C:\\Windows\\System32\\config')).toThrow('access to system directories not allowed');
  });

  test('rejects null bytes', () => {
    expect(() => validateFilePath('file.txt\0.jpg')).toThrow('null bytes not allowed');
    expect(() => validateFilePath('documents/\0file.txt')).toThrow('null bytes not allowed');
  });

  test('rejects invalid inputs', () => {
    expect(() => validateFilePath('')).toThrow('path must be a non-empty string');
    expect(() => validateFilePath(null as any)).toThrow('path must be a non-empty string');
    expect(() => validateFilePath(undefined as any)).toThrow('path must be a non-empty string');
    expect(() => validateFilePath(123 as any)).toThrow('path must be a non-empty string');
  });

  test('handles mixed path separators', () => {
    expect(() => validateFilePath('folder\\..\\..\\file.txt')).toThrow('path traversal detected');
    expect(() => validateFilePath('folder/..\\../file.txt')).toThrow('path traversal detected');
  });

  test('validates legitimate paths that include dots', () => {
    expect(() => validateFilePath('my.file.md')).not.toThrow();
    expect(() => validateFilePath('folder/file.with.dots.txt')).not.toThrow();
    expect(() => validateFilePath('.hidden-file')).not.toThrow();
    expect(() => validateFilePath('folder/.hidden/file.txt')).not.toThrow();
  });

  test('validates paths and prevents load attempts with malicious paths', async () => {
    const mockFile = { 
      path: '../../../etc/passwd', 
      name: 'passwd',
      type: 'file' as const 
    };
    
    const { loadFile } = useMarkdownEditor();
    const { services } = await import('../useServices');
    
    await loadFile(mockFile);
    
    // WebDAV service should not be called due to path validation failure
    expect(services.value?.webdavService.getFile).not.toHaveBeenCalled();
  });

  test('retries file operations with exponential backoff', async () => {
    vi.useFakeTimers();
    
    const mockFile = { 
      path: '/test.md', 
      name: 'test.md',
      type: 'file' as const 
    };
    
    const { loadFile } = useMarkdownEditor();
    const { services } = await import('../useServices');
    
    // Mock initial failures then success
    vi.mocked(services.value?.webdavService.getFile)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('# Success content');
    
    // Trigger load operation
    const loadPromise = loadFile(mockFile);
    
    // Fast-forward through retry delays
    await vi.runAllTimersAsync();
    await loadPromise;
    
    // Should have called getFile 3 times (1 initial + 2 retries)
    expect(services.value?.webdavService.getFile).toHaveBeenCalledTimes(3);
    
    vi.useRealTimers();
  });
});

describe('validateFile', () => {
  test('validates files with allowed extensions', () => {
    const validFiles = [
      { path: '/docs/readme.md', name: 'readme.md', type: 'file' as const },
      { path: '/docs/guide.markdown', name: 'guide.markdown', type: 'file' as const },
      { path: '/docs/notes.txt', name: 'notes.txt', type: 'file' as const },
      { path: '/docs/content.rst', name: 'content.rst', type: 'file' as const },
    ];

    validFiles.forEach(file => {
      expect(() => validateFile(file)).not.toThrow();
    });
  });

  test('rejects files with disallowed extensions', () => {
    const invalidFiles = [
      { path: '/docs/script.js', name: 'script.js', type: 'file' as const },
      { path: '/docs/data.json', name: 'data.json', type: 'file' as const },
      { path: '/docs/image.jpg', name: 'image.jpg', type: 'file' as const },
      { path: '/docs/archive.zip', name: 'archive.zip', type: 'file' as const },
    ];

    invalidFiles.forEach(file => {
      expect(() => validateFile(file)).toThrow(/Unsupported file type/);
    });
  });

  test('rejects files that exceed size limit', () => {
    const largeFile = { 
      path: '/docs/large.md', 
      name: 'large.md', 
      type: 'file' as const,
      size: 15 * 1024 * 1024 // 15MB - exceeds 10MB limit
    };

    expect(() => validateFile(largeFile)).toThrow(/File exceeds maximum size/);
  });

  test('accepts files within size limit', () => {
    const acceptableFile = { 
      path: '/docs/small.md', 
      name: 'small.md', 
      type: 'file' as const,
      size: 5 * 1024 * 1024 // 5MB - within 10MB limit
    };

    expect(() => validateFile(acceptableFile)).not.toThrow();
  });

  test('rejects files with suspicious characters in filename', () => {
    const suspiciousFiles = [
      { path: '/docs/file<script>.md', name: 'file<script>.md', type: 'file' as const },
      { path: '/docs/file|pipe.md', name: 'file|pipe.md', type: 'file' as const },
      { path: '/docs/file?.md', name: 'file?.md', type: 'file' as const },
      { path: '/docs/file*.md', name: 'file*.md', type: 'file' as const },
    ];

    suspiciousFiles.forEach(file => {
      expect(() => validateFile(file)).toThrow(/File name contains invalid characters/);
    });
  });

  test('rejects empty filenames', () => {
    const emptyNameFile = { 
      path: '/docs/', 
      name: '', 
      type: 'file' as const 
    };

    expect(() => validateFile(emptyNameFile)).toThrow(/File name cannot be empty/);
  });

  test('validates files without extension', () => {
    const noExtensionFile = { 
      path: '/docs/README', 
      name: 'README', 
      type: 'file' as const 
    };

    expect(() => validateFile(noExtensionFile)).not.toThrow();
  });

  test('combines path and file validation', () => {
    const maliciousFile = { 
      path: '../../../etc/passwd.md', 
      name: 'passwd.md', 
      type: 'file' as const 
    };

    expect(() => validateFile(maliciousFile)).toThrow(/path traversal detected/);
  });
});

describe('LoadingState enum', () => {
  test('has correct values', () => {
    expect(LoadingState.IDLE).toBe('idle');
    expect(LoadingState.LOADING).toBe('loading');
    expect(LoadingState.ERROR).toBe('error');
    expect(LoadingState.SUCCESS).toBe('success');
  });
});