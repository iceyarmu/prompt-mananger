# Security Best Practices

## Overview

This document outlines security best practices for deploying and maintaining the Prompt Optimizer application.

## Current Security Status

### Vulnerability Summary (2025-08-14)
- **Total Vulnerabilities**: 5
- **Critical**: 1 (form-data package)
- **High**: 0
- **Medium**: 2 (vue-i18n XSS)
- **Low**: 2

### Immediate Actions Required
1. Update `vue-i18n` to version 10.0.8 or later
2. Update `form-data` to version 4.0.4 or later
3. Update `@eslint/plugin-kit` to version 0.3.5 or later
4. Update `tmp` to version 0.2.5 or later

## Deployment Security

### 1. Environment Configuration

#### API Keys and Secrets
```javascript
// ❌ NEVER hardcode secrets
const API_KEY = "sk-abc123...";

// ✅ Use environment variables
const API_KEY = process.env.OPENAI_API_KEY;
```

#### Environment File Security
```bash
# .env.local (git-ignored)
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...

# .env.example (committed)
OPENAI_API_KEY=your_api_key_here
DATABASE_URL=your_database_url_here
```

### 2. HTTPS Configuration

#### Enforce HTTPS
```nginx
# Nginx configuration
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Strong SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
}
```

### 3. Security Headers

#### Required Headers
```javascript
// middleware.js
export function middleware(request) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}
```

#### Content Security Policy
```javascript
// Strict CSP for production
const cspHeader = `
  default-src 'self';
  script-src 'self' 'sha256-...' https://trusted-cdn.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.openai.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`;
```

### 4. Authentication & Authorization

#### API Key Storage
```javascript
// ❌ Don't store in localStorage
localStorage.setItem('api_key', apiKey);

// ✅ Use secure session storage or encrypted cookies
import { encrypt } from '@/utils/crypto';

// Store encrypted
const encrypted = await encrypt(apiKey);
sessionStorage.setItem('api_key', encrypted);

// Retrieve and decrypt
const encrypted = sessionStorage.getItem('api_key');
const apiKey = await decrypt(encrypted);
```

#### Rate Limiting
```javascript
// Implement rate limiting for API endpoints
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 5. Input Validation & Sanitization

#### XSS Prevention
```javascript
// Always sanitize user input
import DOMPurify from 'dompurify';

// Sanitize HTML content
const clean = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href']
});

// Escape for HTML context
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
```

#### File Upload Security
```javascript
// Validate file uploads
const allowedTypes = ['text/markdown', 'text/plain'];
const maxSize = 10 * 1024 * 1024; // 10MB

function validateFile(file) {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  // Check file size
  if (file.size > maxSize) {
    throw new Error('File too large');
  }
  
  // Check file extension
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['md', 'txt'].includes(ext)) {
    throw new Error('Invalid file extension');
  }
  
  // Scan for malicious content
  return scanFile(file);
}
```

### 6. Data Protection

#### Encryption at Rest
```javascript
// Encrypt sensitive data before storage
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}
```

#### Secure Communication
```javascript
// Use HTTPS for all API calls
const apiClient = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for auth
apiClient.interceptors.request.use(config => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## WebDAV Security

### Authentication
```javascript
// Configure WebDAV with authentication
const webdavClient = createClient(url, {
  username: process.env.WEBDAV_USERNAME,
  password: process.env.WEBDAV_PASSWORD,
  digest: true, // Use digest authentication
  withCredentials: true
});
```

### Path Traversal Prevention
```javascript
// Sanitize file paths
function sanitizePath(userPath) {
  // Remove directory traversal attempts
  const cleaned = userPath
    .replace(/\.\./g, '')
    .replace(/\/\//g, '/')
    .replace(/\\/g, '/')
    .replace(/^\//, '');
  
  // Ensure path stays within allowed directory
  const resolved = path.resolve(BASE_DIR, cleaned);
  if (!resolved.startsWith(BASE_DIR)) {
    throw new Error('Invalid path');
  }
  
  return resolved;
}
```

## Dependency Management

### Regular Updates
```bash
# Check for vulnerabilities
pnpm audit

# Update dependencies
pnpm update

# Update specific package
pnpm update vue-i18n@latest

# Check outdated packages
pnpm outdated
```

### Automated Security Scanning
```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm audit --audit-level moderate
      - run: pnpm audit fix --audit-level moderate
```

## Monitoring & Logging

### Security Event Logging
```javascript
// Log security events
function logSecurityEvent(event) {
  const log = {
    timestamp: new Date().toISOString(),
    type: event.type,
    user: event.user,
    ip: event.ip,
    details: event.details
  };
  
  // Log to file/service
  logger.security(log);
  
  // Alert on critical events
  if (event.severity === 'critical') {
    alertAdmins(log);
  }
}

// Usage
logSecurityEvent({
  type: 'failed_login',
  user: username,
  ip: req.ip,
  severity: 'warning',
  details: 'Multiple failed login attempts'
});
```

### Error Handling
```javascript
// Don't expose sensitive information in errors
app.use((err, req, res, next) => {
  // Log full error internally
  logger.error({
    error: err.stack,
    request: req.url,
    user: req.user?.id
  });
  
  // Send generic error to client
  res.status(err.status || 500).json({
    error: 'An error occurred',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});
```

## Docker Security

### Dockerfile Best Practices
```dockerfile
# Use specific version
FROM node:22-alpine

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy only necessary files
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose only necessary ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]
```

### Docker Compose Security
```yaml
version: '3.8'

services:
  app:
    image: prompt-optimizer:latest
    restart: always
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    networks:
      - internal
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp

networks:
  internal:
    driver: bridge
    internal: true
```

## Incident Response

### Security Incident Checklist
1. **Identify** - Determine the nature and scope
2. **Contain** - Isolate affected systems
3. **Investigate** - Collect logs and evidence
4. **Remediate** - Fix vulnerabilities
5. **Recover** - Restore normal operations
6. **Review** - Post-incident analysis

### Contact Information
- Security Team: security@example.com
- Emergency: +1-xxx-xxx-xxxx
- Bug Bounty: https://example.com/security

## Compliance

### GDPR Considerations
- Implement data minimization
- Provide data export functionality
- Enable data deletion
- Maintain audit logs
- Obtain proper consent

### Security Audit Schedule
- **Weekly**: Dependency vulnerability scan
- **Monthly**: Security header validation
- **Quarterly**: Full security audit
- **Annually**: Third-party penetration testing

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Vue.js Security](https://vuejs.org/guide/best-practices/security.html)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Security Headers](https://securityheaders.com/)

---

*Last Updated: 2025-08-14*
*Next Review: 2025-09-14*