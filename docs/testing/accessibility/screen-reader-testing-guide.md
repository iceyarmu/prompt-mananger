# Screen Reader Testing Guide

## Overview
This guide provides comprehensive instructions for manually testing the Prompt Management Platform with screen readers to ensure accessibility compliance (WCAG 2.1 AA).

## Supported Screen Readers

### Primary Testing Targets
1. **NVDA** (Windows) - Free, open-source
2. **JAWS** (Windows) - Industry standard
3. **VoiceOver** (macOS/iOS) - Built-in Apple screen reader
4. **TalkBack** (Android) - Built-in Android screen reader

### Secondary Testing Targets
- **Narrator** (Windows) - Built-in Windows screen reader
- **Orca** (Linux) - Open-source Linux screen reader

## Test Environment Setup

### NVDA Setup (Windows)
1. Download from: https://www.nvaccess.org/download/
2. Install with default settings
3. Key commands:
   - Start/Stop: `Ctrl + Alt + N`
   - Speech mode: `NVDA + S`
   - Browse mode: `NVDA + Space`
   - Element list: `NVDA + F7`

### JAWS Setup (Windows)
1. Download trial from: https://www.freedomscientific.com/products/software/jaws/
2. Key commands:
   - Virtual cursor: `Insert + Z`
   - Headings list: `Insert + F6`
   - Forms mode: `Insert + Space`
   - Links list: `Insert + F7`

### VoiceOver Setup (macOS)
1. Enable: System Preferences > Accessibility > VoiceOver
2. Key commands:
   - Toggle: `Cmd + F5`
   - VoiceOver keys: `Ctrl + Option`
   - Rotor: `VO + U`
   - Web navigation: `VO + Arrows`

## Critical Test Scenarios

### 1. Initial Navigation
**Test Steps:**
1. Load application with screen reader active
2. Navigate using Tab key through main interface
3. Verify all elements are announced correctly

**Expected Results:**
- Application title announced on load
- Skip navigation link available as first tab stop
- Main landmarks identified (navigation, main, etc.)
- All interactive elements reachable via keyboard

**Verification Checklist:**
- [ ] Page title announced
- [ ] Skip links functional
- [ ] Landmarks properly labeled
- [ ] Tab order logical
- [ ] Focus indicators visible

### 2. File Tree Navigation
**Test Steps:**
1. Navigate to file tree using heading navigation (H key)
2. Enter tree with arrow keys
3. Expand/collapse folders with Enter or Space
4. Create new file/folder
5. Delete existing items

**Expected Results:**
- Tree structure announced with levels
- File/folder types distinguished
- Actions announced (expanded/collapsed)
- Context menu accessible

**Verification Checklist:**
- [ ] Tree role announced
- [ ] Item levels clear
- [ ] State changes announced
- [ ] Actions confirmed verbally
- [ ] Error messages announced

### 3. Markdown Editor Interaction
**Test Steps:**
1. Open a file in editor
2. Navigate to editor area
3. Type and edit content
4. Use formatting toolbar
5. Save document

**Expected Results:**
- Editor role and label announced
- Cursor position trackable
- Formatting changes announced
- Save status communicated

**Verification Checklist:**
- [ ] Editor labeled clearly
- [ ] Text entry functional
- [ ] Toolbar buttons labeled
- [ ] Shortcuts announced
- [ ] Save confirmation audible

### 4. Optimization Workflow
**Test Steps:**
1. Select text for optimization
2. Open optimization modal
3. Review options
4. Apply optimization
5. Review results

**Expected Results:**
- Modal focus trapped
- Options clearly labeled
- Progress announced
- Results readable
- Comparison accessible

**Verification Checklist:**
- [ ] Modal announced on open
- [ ] Focus management correct
- [ ] Options navigable
- [ ] Progress updates announced
- [ ] Results comparison clear

### 5. WebDAV Configuration
**Test Steps:**
1. Open settings/configuration
2. Navigate to WebDAV settings
3. Enter connection details
4. Test connection
5. Save configuration

**Expected Results:**
- Form fields labeled
- Required fields identified
- Validation errors announced
- Success/failure communicated

**Verification Checklist:**
- [ ] Form structure clear
- [ ] Field labels associated
- [ ] Required fields marked
- [ ] Errors announced immediately
- [ ] Success confirmation audible

## Component-Specific Testing

### Dialogs and Modals
**Key Points:**
- Focus trapped within modal
- Title announced on open
- Close button accessible
- Escape key functional

**Test Commands:**
```
NVDA: NVDA + Space (browse mode off)
JAWS: Insert + Space (forms mode)
VoiceOver: VO + Shift + Down Arrow (interact)
```

### Forms and Inputs
**Key Points:**
- Labels properly associated
- Required fields marked
- Error messages linked
- Help text available

**Test Commands:**
```
NVDA: F (next form field)
JAWS: F (forms mode)
VoiceOver: VO + Command + J (next form control)
```

### Data Tables
**Key Points:**
- Table structure announced
- Headers associated with cells
- Navigation between cells works
- Summary information available

**Test Commands:**
```
NVDA: Ctrl + Alt + Arrows (table navigation)
JAWS: Ctrl + Alt + Arrows
VoiceOver: VO + Arrows (table navigation)
```

### Dynamic Content
**Key Points:**
- Live regions properly configured
- Status updates announced
- Loading states communicated
- Completion notifications audible

**ARIA Live Regions:**
- `aria-live="polite"` - Non-critical updates
- `aria-live="assertive"` - Important updates
- `role="alert"` - Error messages
- `role="status"` - Status updates

## Common Issues and Solutions

### Issue: Elements Not Announced
**Solutions:**
1. Check for proper ARIA labels
2. Verify role attributes
3. Ensure visible text present
4. Test with different screen readers

### Issue: Focus Lost
**Solutions:**
1. Implement focus management
2. Use focus trap for modals
3. Restore focus after actions
4. Add skip links

### Issue: Context Missing
**Solutions:**
1. Add descriptive labels
2. Use ARIA descriptions
3. Provide instructions
4. Group related elements

### Issue: Dynamic Updates Silent
**Solutions:**
1. Implement live regions
2. Use appropriate politeness
3. Avoid region flooding
4. Test timing of announcements

## Testing Checklist

### Navigation
- [ ] All content keyboard accessible
- [ ] Tab order logical
- [ ] Skip links functional
- [ ] Landmarks properly labeled
- [ ] Headings hierarchical

### Announcements
- [ ] Page title meaningful
- [ ] Buttons labeled clearly
- [ ] Links descriptive
- [ ] Form fields labeled
- [ ] Errors announced

### Interaction
- [ ] Focus visible
- [ ] Modals trap focus
- [ ] Shortcuts documented
- [ ] Context menus accessible
- [ ] Drag-drop alternatives exist

### Feedback
- [ ] Actions confirmed
- [ ] Errors explained
- [ ] Progress indicated
- [ ] Status updates announced
- [ ] Loading states communicated

## Automated Testing Integration

### Running Accessibility Tests
```bash
# Run all accessibility tests
pnpm test:a11y

# Run specific component tests
pnpm test:a11y -- FileTree

# Generate accessibility report
pnpm test:a11y:report
```

### CI/CD Integration
```yaml
- name: Accessibility Testing
  run: |
    pnpm test:a11y
    pnpm test:a11y:report
  continue-on-error: false
```

## Reporting Issues

### Issue Template
```markdown
**Component:** [Component name]
**Screen Reader:** [NVDA/JAWS/VoiceOver]
**Browser:** [Chrome/Firefox/Safari/Edge]
**Issue Type:** [Navigation/Announcement/Interaction]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Recordings:**
[If applicable]
```

## Resources

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Screen Reader User Survey](https://webaim.org/projects/screenreadersurvey9/)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Accessibility Insights](https://accessibilityinsights.io/)

### Training
- [Screen Reader Basics](https://webaim.org/articles/screenreader_testing/)
- [NVDA User Guide](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
- [VoiceOver Getting Started](https://support.apple.com/guide/voiceover/welcome/mac)

## Best Practices

1. **Test Early and Often**
   - Include in development workflow
   - Test during code reviews
   - Automate where possible

2. **Use Real Screen Readers**
   - Don't rely solely on automated tools
   - Test with actual users when possible
   - Cover multiple screen readers

3. **Focus on User Journey**
   - Test complete workflows
   - Consider different user needs
   - Verify error recovery

4. **Document Findings**
   - Keep testing logs
   - Track improvements
   - Share knowledge with team

5. **Stay Updated**
   - Follow accessibility standards
   - Update screen reader versions
   - Learn new testing techniques