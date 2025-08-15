# Known Issues

## Current Issues (v2.0.0)

### Critical Issues
*No critical issues at this time*

### High Priority Issues

#### 1. WebDAV Authentication on Safari
- **Status**: 🔧 In Progress
- **Affected Versions**: 2.0.0+
- **Platforms**: Safari 16+ on macOS
- **Description**: WebDAV digest authentication fails intermittently on Safari
- **Workaround**: 
  - Use basic authentication instead of digest
  - Use Chrome/Firefox as alternative
  - Use desktop application
- **Tracking**: [Issue #245](https://github.com/issues/245)

#### 2. Large File Performance
- **Status**: 📝 Planned
- **Affected Versions**: All
- **Description**: Files >10MB cause editor slowdown
- **Workaround**:
  - Split large files into smaller chunks
  - Disable syntax highlighting for large files
  - Use streaming mode (desktop app only)
- **Tracking**: [Issue #198](https://github.com/issues/198)

### Medium Priority Issues

#### 3. Touch Gestures on Mobile
- **Status**: 📝 Planned
- **Affected Versions**: 2.0.0+
- **Platforms**: Mobile browsers
- **Description**: Some touch gestures not working properly in file tree
- **Workaround**:
  - Use tap instead of swipe
  - Enable "Desktop Mode" in mobile browser
- **Tracking**: [Issue #312](https://github.com/issues/312)

#### 4. Dark Mode Color Contrast
- **Status**: 🔧 In Progress  
- **Affected Versions**: 2.0.0+
- **Description**: Some UI elements have insufficient contrast in dark mode
- **Workaround**:
  - Switch to light mode if visibility is poor
  - Adjust monitor brightness/contrast
- **Tracking**: [Issue #287](https://github.com/issues/287)

#### 5. Memory Leak with Long Sessions
- **Status**: 🔍 Investigating
- **Affected Versions**: 2.0.0+
- **Description**: Memory usage increases over extended sessions (>8 hours)
- **Workaround**:
  - Refresh page every few hours
  - Use desktop app for better memory management
- **Tracking**: [Issue #334](https://github.com/issues/334)

### Low Priority Issues

#### 6. Markdown Preview Rendering
- **Status**: 📝 Planned
- **Description**: Some complex markdown syntax not rendering correctly
- **Workaround**: Use simpler markdown syntax
- **Tracking**: [Issue #256](https://github.com/issues/256)

#### 7. Keyboard Shortcuts Conflict
- **Status**: 📝 Planned
- **Platforms**: macOS
- **Description**: Some shortcuts conflict with system shortcuts
- **Workaround**: Customize shortcuts in settings
- **Tracking**: [Issue #289](https://github.com/issues/289)

## Platform-Specific Issues

### Windows

#### UAC Prompts on Installation
- **Description**: Multiple UAC prompts during desktop app installation
- **Workaround**: Run installer as administrator
- **Status**: By design (security requirement)

#### Path Length Limitations
- **Description**: Files with paths >260 characters fail to open
- **Workaround**: Use shorter paths or enable long path support in Windows
- **Fix**: Enable in Windows 10+:
  ```powershell
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
    -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```

### macOS

#### Gatekeeper Warnings
- **Description**: "App is damaged" warning on first launch
- **Workaround**: 
  ```bash
  xattr -cr /Applications/PromptOptimizer.app
  ```
- **Status**: Awaiting Apple notarization

#### Spotlight Indexing
- **Description**: App files indexed by Spotlight causing slowdown
- **Workaround**: Exclude app data folder from Spotlight

### Linux

#### Missing Dependencies
- **Description**: App fails to start due to missing libraries
- **Fix**: Install dependencies:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6
  
  # Fedora
  sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst
  
  # Arch
  sudo pacman -S gtk3 libnotify nss libxss libxtst
  ```

#### Wayland Compatibility
- **Description**: Some features not working on Wayland
- **Workaround**: Run with X11:
  ```bash
  GDK_BACKEND=x11 ./prompt-optimizer
  ```

## Browser-Specific Issues

### Chrome/Chromium

#### Extension Conflicts
- **Affected Extensions**: 
  - AdBlock Plus (interferes with API calls)
  - Grammarly (conflicts with editor)
  - LastPass (form autofill issues)
- **Workaround**: Disable extensions for this site

### Firefox

#### IndexedDB Private Mode
- **Description**: Data not persisted in private browsing
- **Workaround**: Use normal browsing mode
- **Status**: Firefox limitation

#### WebDAV CORS
- **Description**: Stricter CORS policy for WebDAV
- **Workaround**: Configure server with proper CORS headers

### Safari

#### LocalStorage Limitations
- **Description**: 10MB limit for localStorage
- **Workaround**: Use IndexedDB for large data
- **Status**: Safari limitation

#### WebRTC Features
- **Description**: Some real-time features not available
- **Workaround**: Use Chrome/Firefox for full features

## Security Vulnerabilities

### Dependency Vulnerabilities

#### vue-i18n XSS (CVE-2025-53892)
- **Severity**: Medium
- **Status**: 🔧 Fix Available
- **Action Required**: Update to vue-i18n@10.0.8+
- **Command**: `pnpm update vue-i18n@latest`

#### form-data Boundary Prediction (CVE-2025-7783)
- **Severity**: Critical
- **Status**: 🔧 Fix Available
- **Action Required**: Update to form-data@4.0.4+
- **Command**: `pnpm update form-data@latest`

## Deprecated Features

### Removed in v2.0.0
- Legacy storage format (auto-migrated)
- Old API endpoints (redirected)
- jQuery dependencies (replaced with Vue)

### Deprecating in v2.1.0
- `/api/v1/*` endpoints (use `/api/v2/*`)
- Local storage for large data (use IndexedDB)
- Synchronous API calls (use async/await)

## Workaround Scripts

### Clear Cache Script
```javascript
// Run in browser console
(async () => {
  localStorage.clear();
  sessionStorage.clear();
  const dbs = await indexedDB.databases();
  dbs.forEach(db => indexedDB.deleteDatabase(db.name));
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('Cache cleared successfully');
  location.reload();
})();
```

### Force Update Script
```javascript
// Force service worker update
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => {
    reg.unregister();
    reg.update();
  });
});
```

### Debug Mode Script
```javascript
// Enable verbose logging
window.DEBUG = {
  api: true,
  storage: true,
  editor: true,
  webdav: true
};
console.log('Debug mode enabled');
```

## Reporting New Issues

### Before Reporting

1. Check this list for known issues
2. Search GitHub issues
3. Try workarounds listed above
4. Update to latest version
5. Test in incognito/private mode

### How to Report

Create issue at: https://github.com/linshenkx/prompt-optimizer/issues

Include:
- Version number
- Browser/OS
- Steps to reproduce
- Error messages
- Screenshots

### Issue Template

```markdown
## Bug Report

**Version**: 2.0.0
**Browser**: Chrome 120
**OS**: Windows 11

**Description**:
[Clear description of the issue]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Issue occurs]

**Expected**: [What should happen]
**Actual**: [What actually happens]

**Error Messages**:
```
[Paste any error messages]
```

**Screenshots**:
[Attach if helpful]
```

## Version History

### v2.0.0 (Current)
- Major platform rebuild
- WebDAV integration
- New editor component
- Known issues listed above

### v1.5.0
- Fixed: API timeout issues
- Fixed: Memory leaks in editor
- Fixed: Dark mode inconsistencies

### v1.0.0
- Initial release
- Basic functionality

## Status Legend

- 🔧 **In Progress**: Actively being worked on
- 📝 **Planned**: Scheduled for future release
- 🔍 **Investigating**: Under investigation
- ✅ **Fixed**: Fixed in latest version
- ⚠️ **Won't Fix**: Will not be fixed (by design or limitation)

---

*Last Updated: 2025-08-14*
*Version: 2.0.0*
*Check for updates: https://github.com/linshenkx/prompt-optimizer/releases*