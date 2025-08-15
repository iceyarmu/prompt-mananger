# Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Problem: Application won't start
**Symptoms**: Application crashes on startup or shows blank screen

**Solutions**:
1. Check Node.js version (requires v18+):
   ```bash
   node --version
   ```

2. Clear cache and reinstall dependencies:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

3. Check for port conflicts:
   ```bash
   lsof -i :3000  # Linux/Mac
   netstat -ano | findstr :3000  # Windows
   ```

4. Verify environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your settings
   ```

#### Problem: Desktop app won't install
**Symptoms**: Installation fails or app doesn't open

**Solutions**:
1. **Windows**: Run as administrator
2. **macOS**: Allow app in System Preferences → Security & Privacy
3. **Linux**: Install required dependencies:
   ```bash
   sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6
   ```

### API Connection Issues

#### Problem: "API Key Invalid" error
**Symptoms**: Cannot connect to AI services

**Solutions**:
1. Verify API key format:
   - OpenAI: Starts with `sk-`
   - Anthropic: Starts with `sk-ant-`
   
2. Check API key permissions in provider dashboard

3. Test API directly:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

4. Clear browser cache and re-enter key

#### Problem: CORS errors in browser
**Symptoms**: "Access blocked by CORS policy"

**Solutions**:
1. Use desktop app (no CORS restrictions)
2. Configure proxy in development:
   ```javascript
   // vite.config.js
   proxy: {
     '/api': {
       target: 'https://api.openai.com',
       changeOrigin: true
     }
   }
   ```
3. Deploy to server with proper headers
4. Use browser extension to disable CORS (development only)

### WebDAV Issues

#### Problem: Cannot connect to WebDAV server
**Symptoms**: "Connection failed" or timeout errors

**Solutions**:
1. Verify WebDAV URL format:
   ```
   Correct: https://webdav.example.com/remote.php/dav
   Wrong: webdav.example.com
   ```

2. Test with curl:
   ```bash
   curl -X PROPFIND https://webdav.example.com \
     --user username:password \
     -H "Depth: 1"
   ```

3. Check authentication type (Basic vs Digest)

4. Verify firewall/network settings

5. For Nextcloud/ownCloud:
   - Enable WebDAV in settings
   - Use app password instead of login password

#### Problem: File sync conflicts
**Symptoms**: "Conflict detected" messages

**Solutions**:
1. Choose conflict resolution strategy in settings
2. Manual resolution:
   - Review both versions
   - Choose or merge changes
   - Save resolved version
3. Enable auto-backup before sync
4. Use version history to recover

### Performance Issues

#### Problem: Slow page load
**Symptoms**: Application takes >3 seconds to load

**Solutions**:
1. Enable production mode:
   ```bash
   NODE_ENV=production pnpm build
   pnpm preview
   ```

2. Check network tab for slow resources

3. Enable caching:
   ```javascript
   // In settings
   {
     "cache": {
       "enabled": true,
       "ttl": 3600
     }
   }
   ```

4. Reduce history size:
   - Settings → Storage → Max History Items → 100

#### Problem: High memory usage
**Symptoms**: Browser tab using >500MB RAM

**Solutions**:
1. Clear history and cache
2. Reduce editor undo levels
3. Close unused tabs/panels
4. Restart application periodically
5. Use desktop app for better memory management

### Editor Issues

#### Problem: Editor not responding
**Symptoms**: Cannot type or edit text

**Solutions**:
1. Check file size (>10MB may cause issues)
2. Disable syntax highlighting for large files
3. Clear editor cache:
   ```javascript
   localStorage.removeItem('editor-cache')
   ```
4. Disable extensions/plugins
5. Use plain text mode for troubleshooting

#### Problem: Auto-save not working
**Symptoms**: Changes lost after refresh

**Solutions**:
1. Check auto-save settings
2. Verify storage quota:
   ```javascript
   navigator.storage.estimate().then(console.log)
   ```
3. Enable manual save (Ctrl/Cmd+S)
4. Check browser console for errors
5. Use WebDAV for reliable persistence

### Security Issues

#### Problem: "Insecure connection" warning
**Symptoms**: Browser shows security warning

**Solutions**:
1. Use HTTPS in production
2. Update SSL certificates
3. Check mixed content warnings
4. Verify CSP headers

#### Problem: Data not encrypted
**Symptoms**: Sensitive data visible in storage

**Solutions**:
1. Enable encryption in settings
2. Use secure storage providers
3. Clear data after logout
4. Use desktop app for local encryption

### Browser-Specific Issues

#### Chrome/Edge
- **Problem**: Extensions conflict
  - **Solution**: Disable extensions one by one
  
- **Problem**: Storage quota exceeded
  - **Solution**: Clear site data in settings

#### Firefox
- **Problem**: IndexedDB disabled
  - **Solution**: Check privacy settings
  
- **Problem**: WebDAV CORS issues
  - **Solution**: Use `network.cors_preflight.allow_client_cert`

#### Safari
- **Problem**: LocalStorage in private mode
  - **Solution**: Use regular browsing mode
  
- **Problem**: WebDAV authentication
  - **Solution**: Use basic auth instead of digest

## Diagnostic Tools

### Browser Console Commands

```javascript
// Check version
console.log(window.__APP_VERSION__)

// Check storage usage
navigator.storage.estimate().then(console.log)

// Clear all data
localStorage.clear()
indexedDB.deleteDatabase('prompt-optimizer')

// Debug mode
window.__DEBUG__ = true

// Performance metrics
performance.getEntriesByType('navigation')[0]

// Check service worker
navigator.serviceWorker.getRegistrations()
```

### Health Check Endpoints

```bash
# Application health
curl http://localhost:3000/health

# API status
curl http://localhost:3000/api/status

# WebDAV connection
curl http://localhost:3000/api/webdav/test
```

### Log Analysis

```bash
# View application logs
tail -f logs/app.log

# Filter errors
grep ERROR logs/app.log

# Check memory usage
ps aux | grep node

# Monitor network
netstat -tuln | grep 3000
```

## Error Codes Reference

| Code | Description | Solution |
|------|-------------|----------|
| E001 | Invalid API key | Check API key format and permissions |
| E002 | Rate limit exceeded | Wait or upgrade plan |
| E003 | Network timeout | Check internet connection |
| E004 | Storage quota exceeded | Clear cache or upgrade storage |
| E005 | Invalid file format | Check supported formats |
| E006 | WebDAV auth failed | Verify credentials |
| E007 | CORS blocked | Use desktop app or configure proxy |
| E008 | Model not available | Select different model |
| E009 | Template not found | Refresh template list |
| E010 | Sync conflict | Resolve manually |

## Debug Mode

Enable debug mode for detailed logging:

### Web Application
```javascript
// In browser console
localStorage.setItem('debug', 'true')
location.reload()
```

### Desktop Application
```bash
# Windows
set DEBUG=* && npm start

# Mac/Linux
DEBUG=* npm start
```

### Extension
1. Open extension options
2. Enable "Debug Mode"
3. Check browser console for logs

## Getting Help

### Before Contacting Support

1. **Check documentation**:
   - User Guide
   - FAQ
   - Known Issues

2. **Search existing issues**:
   - GitHub Issues
   - Community Forum

3. **Gather information**:
   - Application version
   - Browser/OS version
   - Error messages
   - Steps to reproduce
   - Screenshots/recordings

### Contact Channels

1. **GitHub Issues**: Bug reports and feature requests
   - URL: https://github.com/linshenkx/prompt-optimizer/issues
   - Template: Use issue templates

2. **Community Forum**: General questions
   - URL: https://community.prompt-optimizer.com

3. **Email Support**: Premium users
   - Email: support@prompt-optimizer.com
   - Response time: 24-48 hours

### Information to Provide

```markdown
## Issue Report

**Environment:**
- App Version: 2.0.0
- Browser: Chrome 120
- OS: Windows 11
- Deployment: Docker/Vercel/Local

**Problem:**
[Describe the issue]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [Error occurs]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Error Messages:**
```
[Paste error messages]
```

**Screenshots:**
[Attach if relevant]

**Additional Context:**
[Any other relevant information]
```

## Recovery Procedures

### Data Recovery

1. **From backup**:
   ```javascript
   // Import backup
   const backup = await fetch('/backup.json').then(r => r.json())
   await dataManager.import(backup)
   ```

2. **From browser storage**:
   - Check IndexedDB in DevTools
   - Export data before clearing

3. **From WebDAV**:
   - Access WebDAV directly
   - Download files manually

### Reset Application

1. **Soft reset** (keeps data):
   ```javascript
   localStorage.removeItem('settings')
   location.reload()
   ```

2. **Hard reset** (clears everything):
   ```javascript
   if (confirm('Delete all data?')) {
     localStorage.clear()
     await caches.delete('prompt-optimizer')
     indexedDB.deleteDatabase('prompt-optimizer')
     location.reload()
   }
   ```

### Emergency Mode

Start application in safe mode:

```bash
# Skip all plugins/extensions
npm start -- --safe-mode

# Minimal UI only
npm start -- --minimal

# Read-only mode
npm start -- --read-only
```

---

*Last Updated: 2025-08-14*
*Version: 2.0.0*