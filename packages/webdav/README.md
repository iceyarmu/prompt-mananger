# WebDAV Service Package

A TypeScript WebDAV client service following established service patterns.

## Features

- **Connection Management**: Configurable connection with timeout and retry logic
- **File Operations**: Complete CRUD operations for files (create, read, update, delete, move)
- **Folder Operations**: Create, list, and delete folders with recursive options
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Type Safety**: Full TypeScript support with detailed type definitions
- **Security**: Path validation and authentication support
- **Testing**: Comprehensive unit and integration test suites

## Installation

```bash
pnpm add @prompt-optimizer/webdav
```

## Usage

### Basic Example

```typescript
import { WebDAVService, WebDAVConfig } from '@prompt-optimizer/webdav';

const config: WebDAVConfig = {
  url: 'https://your-webdav-server.com',
  username: 'your-username',
  password: 'your-password',
  authType: 'basic'
};

const service = new WebDAVService();

// Connect
await service.connect(config);

// Upload a file
await service.putFile({
  path: '/documents/note.md',
  content: '# My Note\n\nThis is my note content.',
  mimeType: 'text/markdown'
});

// Read a file
const file = await service.getFile('/documents/note.md');
console.log(file.content);

// List folder contents
const files = await service.listFolder('/documents');
console.log(files);

// Disconnect
await service.disconnect();
```

### Configuration Options

```typescript
interface WebDAVConfig {
  url: string;                    // WebDAV server URL (required)
  username?: string;              // Username for authentication
  password?: string;              // Password for authentication
  authType?: 'none' | 'basic' | 'digest'; // Authentication type
  timeout?: number;               // Connection timeout (default: 30000ms)
  maxConnections?: number;        // Max concurrent connections (default: 5)
  enableRetry?: boolean;          // Enable retry logic (default: true)
  maxRetries?: number;            // Max retry attempts (default: 3)
  retryDelay?: number;           // Retry delay (default: 1000ms)
}
```

### Error Handling

The service throws detailed WebDAV errors that include user-friendly messages:

```typescript
import { WebDAVError, WebDAVErrorCode } from '@prompt-optimizer/webdav';

try {
  await service.getFile('/nonexistent.md');
} catch (error) {
  if (error instanceof WebDAVError) {
    console.log('Error code:', error.code);
    console.log('User message:', error.getUserFriendlyMessage());
    console.log('Details:', error.details);
  }
}
```

## API Reference

### WebDAVService

#### Connection Management
- `connect(config: WebDAVConfig): Promise<boolean>` - Connect to WebDAV server
- `disconnect(): Promise<void>` - Disconnect and cleanup resources
- `testConnection(config: WebDAVConfig, timeoutMs?: number): Promise<ConnectionTestResult>` - Test connection
- `isConnected(): boolean` - Check connection status

#### File Operations
- `getFile(path: string): Promise<FileContent>` - Get file content
- `putFile(fileContent: FileContent): Promise<void>` - Upload file
- `deleteFile(path: string): Promise<void>` - Delete file
- `moveFile(sourcePath: string, destinationPath: string): Promise<void>` - Move/rename file

#### Folder Operations
- `listFolder(path: string, filterMarkdown?: boolean): Promise<FileInfo[]>` - List folder contents
- `createFolder(path: string, recursive?: boolean): Promise<void>` - Create folder
- `deleteFolder(path: string, force?: boolean): Promise<void>` - Delete folder

#### Utility Methods
- `exists(path: string): Promise<boolean>` - Check if path exists
- `getFileInfo(path: string): Promise<FileInfo>` - Get file/folder information

## Development

### Running Tests

#### Unit Tests
```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

#### Integration Tests

Integration tests require a WebDAV server. You can use Docker for easy setup:

```bash
# Start WebDAV server with Docker
pnpm docker:test:up

# Run integration tests
pnpm test:integration

# Stop WebDAV server
pnpm docker:test:down

# Run full integration test cycle (start server, test, stop server)
pnpm docker:test
```

Or manually start a WebDAV server and run tests with environment variables:

```bash
# With custom server
WEBDAV_URL=http://localhost:8080 WEBDAV_USERNAME=test WEBDAV_PASSWORD=test pnpm test:integration
```

#### Running All Tests
```bash
# Run both unit and integration tests
pnpm test:all
```

### Building

```bash
# Build the package
pnpm build

# Build in development mode with watch
pnpm dev
```

## Security Considerations

- Never log credentials or authentication headers
- All file paths are validated to prevent directory traversal attacks
- Credentials are stored in memory only during sessions
- Use HTTPS for all WebDAV connections in production
- Clear credentials on disconnect

## Performance Notes

- Connection pooling is implemented for concurrent operations
- Large files (>1MB) use streaming for better memory efficiency
- Request debouncing is implemented for rapid operations
- Folder listings are cached for performance
- Exponential backoff retry logic prevents server overload

## Error Codes

The service provides detailed error codes for different scenarios:

- `CONNECTION_FAILED` - Unable to connect to server
- `AUTHENTICATION_FAILED` - Invalid credentials
- `FILE_NOT_FOUND` - Requested file doesn't exist
- `INSUFFICIENT_PERMISSIONS` - Operation not allowed
- `QUOTA_EXCEEDED` - Server storage quota exceeded
- And more... (see error types for complete list)

## License

This package is part of the prompt-optimizer project.