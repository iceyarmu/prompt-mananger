# API Reference

## Overview

The Prompt Optimizer API provides programmatic access to optimization, execution, and file management features. All API endpoints follow RESTful conventions and return JSON responses.

## Base URL

```
Production: https://api.prompt-optimizer.com/v1
Local: http://localhost:3000/api/v1
```

## Authentication

All API requests require authentication using an API key:

```http
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

- **Default**: 100 requests per minute
- **Premium**: 1000 requests per minute
- Rate limit headers are included in all responses:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Endpoints

### Optimization Service

#### POST /optimize

Optimize a prompt using AI models.

**Request:**
```json
{
  "prompt": "Write a story about a robot",
  "mode": "general",
  "model": "gpt-4",
  "options": {
    "temperature": 0.7,
    "maxTokens": 2000,
    "iterationCount": 1
  }
}
```

**Response:**
```json
{
  "id": "opt_123abc",
  "status": "completed",
  "original": "Write a story about a robot",
  "optimized": "Create a compelling narrative...",
  "metadata": {
    "model": "gpt-4",
    "mode": "general",
    "timestamp": "2025-08-14T10:00:00Z",
    "tokensUsed": 1500
  }
}
```

**Modes:**
- `general`: General purpose optimization
- `analytical`: Analytical and reasoning tasks
- `output-format`: Structured output formatting
- `user-prompt`: User prompt enhancement

#### GET /optimize/{id}

Get optimization result by ID.

**Response:**
```json
{
  "id": "opt_123abc",
  "status": "completed",
  "result": "...",
  "createdAt": "2025-08-14T10:00:00Z"
}
```

#### POST /optimize/batch

Batch optimize multiple prompts.

**Request:**
```json
{
  "prompts": [
    {
      "id": "1",
      "prompt": "Explain quantum computing",
      "mode": "analytical"
    },
    {
      "id": "2", 
      "prompt": "Write a poem",
      "mode": "general"
    }
  ],
  "model": "gpt-4"
}
```

### Execution Service

#### POST /execute

Execute a prompt with a model.

**Request:**
```json
{
  "prompt": "What is the capital of France?",
  "systemPrompt": "You are a helpful assistant",
  "model": "gpt-3.5-turbo",
  "parameters": {
    "temperature": 0.5,
    "maxTokens": 500,
    "topP": 0.9
  }
}
```

**Response:**
```json
{
  "id": "exec_456def",
  "status": "completed",
  "result": "The capital of France is Paris.",
  "usage": {
    "promptTokens": 15,
    "completionTokens": 8,
    "totalTokens": 23
  },
  "model": "gpt-3.5-turbo",
  "timestamp": "2025-08-14T10:05:00Z"
}
```

#### POST /execute/stream

Execute with streaming response.

**Request:**
```json
{
  "prompt": "Tell me a long story",
  "model": "gpt-4",
  "stream": true
}
```

**Response:** Server-Sent Events stream
```
data: {"chunk": "Once upon a time", "index": 0}
data: {"chunk": " in a distant land", "index": 1}
data: {"done": true, "totalTokens": 500}
```

### Template Management

#### GET /templates

List all available templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "tpl_001",
      "name": "General Optimization",
      "description": "Improves clarity and effectiveness",
      "category": "optimization",
      "isBuiltin": true
    },
    {
      "id": "tpl_custom_002",
      "name": "My Custom Template",
      "category": "custom",
      "isBuiltin": false
    }
  ],
  "total": 15
}
```

#### GET /templates/{id}

Get template details.

**Response:**
```json
{
  "id": "tpl_001",
  "name": "General Optimization",
  "content": "You are an expert prompt engineer...",
  "parameters": [
    {
      "name": "tone",
      "type": "select",
      "options": ["professional", "casual", "formal"],
      "default": "professional"
    }
  ],
  "metadata": {
    "author": "system",
    "version": "1.0.0",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

#### POST /templates

Create custom template.

**Request:**
```json
{
  "name": "Technical Writer",
  "description": "For technical documentation",
  "content": "You are a technical writer...",
  "category": "writing",
  "parameters": []
}
```

### Model Management

#### GET /models

List available AI models.

**Response:**
```json
{
  "models": [
    {
      "id": "gpt-4",
      "provider": "openai",
      "name": "GPT-4",
      "description": "Most capable model",
      "capabilities": ["chat", "completion"],
      "pricing": {
        "input": 0.03,
        "output": 0.06,
        "unit": "per 1k tokens"
      }
    },
    {
      "id": "claude-3-opus",
      "provider": "anthropic",
      "name": "Claude 3 Opus",
      "capabilities": ["chat", "vision"]
    }
  ]
}
```

#### POST /models/test

Test model configuration.

**Request:**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-3.5-turbo"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Model configured successfully",
  "response": "Hello! I'm working properly."
}
```

### File Operations (WebDAV)

#### GET /files

List files in directory.

**Query Parameters:**
- `path`: Directory path (default: "/")
- `recursive`: Include subdirectories (default: false)

**Response:**
```json
{
  "files": [
    {
      "name": "prompt.md",
      "path": "/prompts/prompt.md",
      "type": "file",
      "size": 1024,
      "modified": "2025-08-14T10:00:00Z"
    },
    {
      "name": "templates",
      "path": "/templates",
      "type": "directory",
      "children": 5
    }
  ],
  "total": 12
}
```

#### GET /files/{path}

Get file content.

**Response:**
```json
{
  "path": "/prompts/story.md",
  "content": "# Story Prompt\n\nWrite a story about...",
  "metadata": {
    "size": 256,
    "modified": "2025-08-14T10:00:00Z",
    "mimeType": "text/markdown"
  }
}
```

#### PUT /files/{path}

Create or update file.

**Request:**
```json
{
  "content": "# New Prompt\n\nThis is my new prompt...",
  "metadata": {
    "tags": ["creative", "story"]
  }
}
```

#### DELETE /files/{path}

Delete file or directory.

**Response:**
```json
{
  "status": "success",
  "message": "File deleted successfully"
}
```

### History Service

#### GET /history

Get prompt history.

**Query Parameters:**
- `limit`: Number of items (default: 20)
- `offset`: Pagination offset (default: 0)
- `type`: Filter by type (optimize/execute)

**Response:**
```json
{
  "history": [
    {
      "id": "hist_789",
      "type": "optimization",
      "prompt": "Original prompt...",
      "result": "Optimized prompt...",
      "model": "gpt-4",
      "timestamp": "2025-08-14T10:00:00Z"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

#### DELETE /history/{id}

Delete history item.

### Preferences

#### GET /preferences

Get user preferences.

**Response:**
```json
{
  "theme": "dark",
  "language": "en",
  "defaultModel": "gpt-4",
  "autoSave": true,
  "saveInterval": 30,
  "editorSettings": {
    "fontSize": 14,
    "wordWrap": true,
    "lineNumbers": true
  }
}
```

#### PUT /preferences

Update preferences.

**Request:**
```json
{
  "theme": "light",
  "defaultModel": "claude-3"
}
```

### Data Import/Export

#### POST /export

Export all data.

**Request:**
```json
{
  "format": "json",
  "include": ["prompts", "templates", "history", "settings"]
}
```

**Response:**
```json
{
  "exportId": "exp_abc123",
  "downloadUrl": "https://api.prompt-optimizer.com/downloads/exp_abc123",
  "expiresAt": "2025-08-15T10:00:00Z",
  "size": 102400
}
```

#### POST /import

Import data.

**Request:** Multipart form data
```
file: backup.json
options: {"merge": true, "overwrite": false}
```

**Response:**
```json
{
  "status": "success",
  "imported": {
    "prompts": 50,
    "templates": 10,
    "history": 200
  },
  "errors": []
}
```

## WebSocket Events

### Connection

```javascript
const ws = new WebSocket('wss://api.prompt-optimizer.com/v1/ws');
ws.send(JSON.stringify({
  type: 'auth',
  token: 'YOUR_API_KEY'
}));
```

### Events

#### optimization.progress
```json
{
  "type": "optimization.progress",
  "data": {
    "id": "opt_123",
    "progress": 0.5,
    "message": "Analyzing prompt structure..."
  }
}
```

#### file.changed
```json
{
  "type": "file.changed",
  "data": {
    "path": "/prompts/story.md",
    "action": "modified",
    "timestamp": "2025-08-14T10:00:00Z"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request body is invalid",
    "details": {
      "field": "prompt",
      "reason": "Required field missing"
    }
  },
  "timestamp": "2025-08-14T10:00:00Z",
  "requestId": "req_xyz789"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Access denied to resource |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## SDK Examples

### JavaScript/TypeScript

```typescript
import { PromptOptimizer } from '@prompt-optimizer/sdk';

const client = new PromptOptimizer({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://api.prompt-optimizer.com/v1'
});

// Optimize a prompt
const result = await client.optimize({
  prompt: 'Write a story',
  mode: 'general'
});

// Execute with streaming
const stream = await client.executeStream({
  prompt: 'Tell me about AI',
  model: 'gpt-4'
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

### Python

```python
from prompt_optimizer import Client

client = Client(api_key="YOUR_API_KEY")

# Optimize prompt
result = client.optimize(
    prompt="Explain quantum computing",
    mode="analytical"
)

# List files
files = client.files.list(path="/prompts")
for file in files:
    print(f"{file.name}: {file.size} bytes")
```

### cURL

```bash
# Optimize a prompt
curl -X POST https://api.prompt-optimizer.com/v1/optimize \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a haiku",
    "mode": "general"
  }'

# Get file content
curl https://api.prompt-optimizer.com/v1/files/prompts/story.md \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Webhooks

Configure webhooks to receive real-time notifications:

### Configuration

```json
{
  "url": "https://your-server.com/webhooks",
  "events": ["optimization.completed", "file.changed"],
  "secret": "webhook_secret_key"
}
```

### Webhook Payload

```json
{
  "event": "optimization.completed",
  "data": {
    "id": "opt_123",
    "status": "success"
  },
  "timestamp": "2025-08-14T10:00:00Z",
  "signature": "sha256=..."
}
```

## Changelog

### v2.0.0 (2025-08-14)
- Added WebDAV file operations
- Introduced streaming execution
- New template management system
- Batch optimization support
- WebSocket real-time events

### v1.5.0 (2025-01-01)
- Initial API release
- Basic optimization and execution
- Model management

---

*Last Updated: 2025-08-14*
*API Version: 2.0.0*