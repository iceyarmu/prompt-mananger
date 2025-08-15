# Configuration Guide

## Overview

This guide covers all configuration options for the Prompt Optimizer application across different deployment methods.

## Environment Variables

### Core Configuration

```bash
# Application
NODE_ENV=production                    # Environment: development, production, test
PORT=3000                              # Server port
BASE_URL=https://prompt.example.com   # Application base URL

# Security
ACCESS_PASSWORD=your_secure_password  # Access control password
JWT_SECRET=your_jwt_secret_key       # JWT signing secret
ENCRYPTION_KEY=your_encryption_key   # Data encryption key

# Feature Flags
VITE_ENABLE_NEW_PLATFORM=true        # Enable new platform features
VITE_ENABLE_WEBDAV=true              # Enable WebDAV integration
VITE_ENABLE_MCP=true                 # Enable MCP server
VITE_ENABLE_ANALYTICS=false         # Enable analytics tracking
```

### AI Service Configuration

```bash
# OpenAI
VITE_OPENAI_API_KEY=sk-...           # OpenAI API key
VITE_OPENAI_BASE_URL=https://api.openai.com/v1  # OpenAI API base URL
VITE_OPENAI_ORG_ID=org-...          # OpenAI organization ID (optional)

# Anthropic
VITE_ANTHROPIC_API_KEY=sk-ant-...    # Anthropic API key
VITE_ANTHROPIC_BASE_URL=https://api.anthropic.com  # Anthropic API base URL

# Google Gemini
VITE_GEMINI_API_KEY=...              # Gemini API key
VITE_GEMINI_BASE_URL=https://generativelanguage.googleapis.com  # Gemini API base URL

# DeepSeek
VITE_DEEPSEEK_API_KEY=...            # DeepSeek API key
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com  # DeepSeek API base URL

# Custom/Local Models
VITE_CUSTOM_API_KEY=...              # Custom model API key
VITE_CUSTOM_BASE_URL=http://localhost:11434  # Custom model base URL (e.g., Ollama)
```

### WebDAV Configuration

```bash
# WebDAV Settings
VITE_WEBDAV_URL=https://webdav.example.com     # WebDAV server URL
VITE_WEBDAV_USERNAME=username                   # WebDAV username
VITE_WEBDAV_PASSWORD=password                   # WebDAV password
VITE_WEBDAV_PATH=/prompts                      # WebDAV base path
VITE_WEBDAV_AUTH_TYPE=basic                    # Auth type: basic, digest
VITE_WEBDAV_TIMEOUT=30000                      # Request timeout in ms
```

### Performance Configuration

```bash
# Caching
VITE_CACHE_TTL=300                   # Cache TTL in seconds
VITE_ENABLE_SERVICE_WORKER=true      # Enable service worker caching

# Optimization
VITE_ENABLE_LAZY_LOADING=true        # Enable component lazy loading
VITE_ENABLE_CODE_SPLITTING=true      # Enable code splitting
VITE_CHUNK_SIZE_LIMIT=500            # Chunk size limit in KB

# Rate Limiting
VITE_RATE_LIMIT_WINDOW=60000         # Rate limit window in ms
VITE_RATE_LIMIT_MAX_REQUESTS=100     # Max requests per window
```

## Application Configuration Files

### settings.json

User preferences and application settings:

```json
{
  "version": "2.0.0",
  "theme": "dark",
  "language": "en",
  "editor": {
    "fontSize": 14,
    "fontFamily": "Monaco, monospace",
    "lineNumbers": true,
    "wordWrap": true,
    "autoSave": true,
    "autoSaveInterval": 30000,
    "tabSize": 2,
    "insertSpaces": true
  },
  "ui": {
    "sidebarWidth": 250,
    "panelLayout": "vertical",
    "showToolbar": true,
    "compactMode": false,
    "animations": true
  },
  "optimization": {
    "defaultMode": "general",
    "defaultModel": "gpt-4",
    "iterationCount": 1,
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "storage": {
    "provider": "indexeddb",
    "autoBackup": true,
    "backupInterval": 86400000,
    "maxHistoryItems": 1000
  },
  "webdav": {
    "enabled": true,
    "autoSync": true,
    "syncInterval": 60000,
    "conflictResolution": "manual"
  },
  "security": {
    "encryptStorage": true,
    "clearOnLogout": false,
    "sessionTimeout": 3600000,
    "requireHttps": true
  }
}
```

### models.json

AI model configurations:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "models": [
        {
          "id": "gpt-4",
          "name": "GPT-4",
          "maxTokens": 8192,
          "supportsFunctions": true,
          "supportsVision": true,
          "pricing": {
            "input": 0.03,
            "output": 0.06
          }
        },
        {
          "id": "gpt-3.5-turbo",
          "name": "GPT-3.5 Turbo",
          "maxTokens": 4096,
          "supportsFunctions": true,
          "pricing": {
            "input": 0.001,
            "output": 0.002
          }
        }
      ]
    },
    "anthropic": {
      "enabled": true,
      "models": [
        {
          "id": "claude-3-opus",
          "name": "Claude 3 Opus",
          "maxTokens": 200000,
          "supportsVision": true
        }
      ]
    }
  },
  "defaults": {
    "temperature": 0.7,
    "topP": 0.9,
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "maxTokens": 2000
  }
}
```

### templates.json

Template configurations:

```json
{
  "templates": [
    {
      "id": "general-optimization",
      "name": "General Optimization",
      "category": "optimization",
      "description": "Improves clarity and effectiveness",
      "system": "You are an expert prompt engineer...",
      "parameters": [
        {
          "name": "style",
          "type": "select",
          "options": ["concise", "detailed", "balanced"],
          "default": "balanced"
        }
      ],
      "enabled": true,
      "builtin": true
    }
  ],
  "categories": [
    "optimization",
    "analysis",
    "creative",
    "technical",
    "custom"
  ]
}
```

## Docker Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    image: prompt-optimizer:2.0.0
    container_name: prompt-optimizer
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - ACCESS_PASSWORD=${ACCESS_PASSWORD}
      - VITE_OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    networks:
      - prompt-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  webdav:
    image: bytemark/webdav
    container_name: prompt-webdav
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - AUTH_TYPE=Basic
      - USERNAME=${WEBDAV_USERNAME}
      - PASSWORD=${WEBDAV_PASSWORD}
    volumes:
      - ./webdav-data:/var/lib/dav
    networks:
      - prompt-net

  redis:
    image: redis:7-alpine
    container_name: prompt-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - ./redis-data:/data
    networks:
      - prompt-net
    command: redis-server --appendonly yes

networks:
  prompt-net:
    driver: bridge
```

### Dockerfile Configuration

```dockerfile
# Build arguments
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.19

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

# Build-time variables
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Labels
LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.version=$VERSION \
      org.label-schema.name="prompt-optimizer" \
      org.label-schema.description="AI Prompt Optimization Tool"

# Runtime configuration
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    CONFIG_DIR=/app/config

# Health check configuration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1
```

## Nginx Configuration

### nginx.conf

```nginx
server {
    listen 80;
    server_name prompt.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name prompt.example.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CSP Header
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.openai.com https://api.anthropic.com;" always;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;

    # Proxy Configuration
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static Files
    location /assets {
        alias /app/public/assets;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

## Kubernetes Configuration

### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prompt-optimizer
  labels:
    app: prompt-optimizer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: prompt-optimizer
  template:
    metadata:
      labels:
        app: prompt-optimizer
    spec:
      containers:
      - name: app
        image: prompt-optimizer:2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: ACCESS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: prompt-secrets
              key: access-password
        - name: VITE_OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: prompt-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prompt-config
data:
  settings.json: |
    {
      "version": "2.0.0",
      "theme": "dark",
      "language": "en"
    }
  models.json: |
    {
      "providers": {
        "openai": {
          "enabled": true
        }
      }
    }
```

## MCP Server Configuration

### mcp-config.json

```json
{
  "server": {
    "name": "prompt-optimizer-mcp",
    "version": "1.0.0",
    "description": "Prompt Optimizer MCP Server"
  },
  "tools": [
    {
      "name": "optimize_prompt",
      "description": "Optimize a prompt for better AI responses",
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "mode": {
          "type": "string",
          "enum": ["general", "analytical", "creative"],
          "default": "general"
        }
      }
    },
    {
      "name": "execute_prompt",
      "description": "Execute a prompt with specified model",
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "model": {
          "type": "string",
          "default": "gpt-4"
        }
      }
    }
  ],
  "resources": [
    {
      "name": "templates",
      "type": "collection",
      "description": "Prompt templates"
    },
    {
      "name": "history",
      "type": "collection",
      "description": "Prompt history"
    }
  ]
}
```

## Vercel Configuration

### vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "packages/web/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "packages/web/dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "env": {
    "VITE_OPENAI_API_KEY": "@openai_api_key",
    "ACCESS_PASSWORD": "@access_password"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## Monitoring Configuration

### prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prompt-optimizer'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### grafana-dashboard.json

```json
{
  "dashboard": {
    "title": "Prompt Optimizer Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds)"
          }
        ]
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "active_users_total"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting Configuration Issues

### Common Issues

1. **API Key Not Working**
   - Verify environment variable is set correctly
   - Check for extra spaces or quotes
   - Ensure key has necessary permissions

2. **WebDAV Connection Failed**
   - Verify server URL and credentials
   - Check CORS settings on WebDAV server
   - Test with curl or WebDAV client

3. **Performance Issues**
   - Enable lazy loading and code splitting
   - Adjust cache TTL values
   - Increase memory limits in Docker

4. **Security Headers Missing**
   - Check nginx/reverse proxy configuration
   - Verify Vercel headers configuration
   - Use security header testing tools

---

*Last Updated: 2025-08-14*
*Configuration Version: 2.0.0*