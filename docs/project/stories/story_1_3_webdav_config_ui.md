# Story 1.3: Create WebDAV Configuration UI - Brownfield Addition

## User Story

As a user,
I want to configure my WebDAV connection through the UI,
So that I can connect to my preferred storage provider.

## Story Context

### Existing System Integration

- **Integrates with:** Existing Vue 3 modal system, Tailwind CSS design system, WebDAVService
- **Technology:** Vue 3.4+ Composition API, TypeScript, Tailwind CSS, Pinia stores
- **Follows pattern:** Current modal component patterns, form validation approach
- **Touch points:** Main UI toolbar, browser local storage, existing notification system

## Acceptance Criteria

### Functional Requirements

1. Create configuration modal dialog with WebDAV connection fields:
   - Server URL (required, with URL validation)
   - Username (optional)
   - Password (optional, masked input)
   - Connection name/profile (for multiple endpoints)
2. Implement "Test Connection" button with loading state and result feedback
3. Save configuration securely in encrypted browser storage
4. Support multiple saved profiles with quick switching
5. Display current connection status in UI (connected/disconnected indicator)

### Integration Requirements

6. Modal follows existing modal component patterns and animations
7. Form validation uses existing validation utilities
8. Styling consistent with current Tailwind CSS classes
9. Integration with WebDAVService for connection testing
10. Existing UI remains functional when modal is open (non-blocking)

### Quality Requirements

11. Password field implements proper masking with show/hide toggle
12. URL validation includes protocol check (https preferred)
13. Form submission disabled until required fields are valid
14. Clear error messages for connection failures
15. Loading states for all async operations

## Technical Notes

### Integration Approach
- Extend existing BaseModal component
- Use existing form validation composables
- Store configuration in existing Pinia configuration store
- Use existing notification service for success/error messages

### Existing Pattern Reference
- Follow existing SettingsModal component structure
- Use same form field components and styling
- Apply consistent button styles and spacing

### Key Constraints
- Credentials must be encrypted before storing in browser
- Modal must be responsive on mobile devices (min 320px)
- Connection test timeout: 10 seconds
- Maximum 5 saved profiles

## Implementation Details

### Component Structure
```vue
<template>
  <BaseModal
    v-model="isOpen"
    title="WebDAV Configuration"
    size="md"
  >
    <form @submit.prevent="handleSubmit">
      <!-- Server URL Field -->
      <FormField
        v-model="config.url"
        label="WebDAV Server URL"
        type="url"
        placeholder="https://webdav.example.com"
        :error="errors.url"
        required
      />
      
      <!-- Username Field -->
      <FormField
        v-model="config.username"
        label="Username (Optional)"
        type="text"
        :error="errors.username"
      />
      
      <!-- Password Field -->
      <FormField
        v-model="config.password"
        label="Password (Optional)"
        type="password"
        :show-toggle="true"
        :error="errors.password"
      />
      
      <!-- Profile Name -->
      <FormField
        v-model="config.profileName"
        label="Profile Name"
        placeholder="My WebDAV Server"
      />
      
      <!-- Action Buttons -->
      <div class="flex gap-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          @click="testConnection"
          :loading="testing"
        >
          Test Connection
        </Button>
        
        <Button
          type="submit"
          variant="primary"
          :disabled="!isValid"
        >
          Save Configuration
        </Button>
      </div>
    </form>
    
    <!-- Saved Profiles Section -->
    <div v-if="savedProfiles.length" class="mt-6 border-t pt-4">
      <h3 class="text-sm font-medium mb-2">Saved Profiles</h3>
      <ProfileList
        :profiles="savedProfiles"
        @select="loadProfile"
        @delete="deleteProfile"
      />
    </div>
  </BaseModal>
</template>
```

### Store Structure
```typescript
// webdavStore.ts
interface WebDAVProfile {
  id: string;
  name: string;
  url: string;
  username?: string;
  // password stored separately in secure storage
  lastUsed: Date;
  isActive: boolean;
}

interface WebDAVStore {
  profiles: WebDAVProfile[];
  activeProfile: WebDAVProfile | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  
  // Actions
  saveProfile(profile: WebDAVProfile): Promise<void>;
  deleteProfile(id: string): void;
  setActiveProfile(id: string): Promise<void>;
  testConnection(config: WebDAVConfig): Promise<boolean>;
}
```

### Security Implementation
```typescript
// Credential encryption using Web Crypto API
class CredentialManager {
  private async getKey(): Promise<CryptoKey> {
    // Derive key from user-specific salt
  }
  
  async encrypt(password: string): Promise<string> {
    // Encrypt using AES-GCM
  }
  
  async decrypt(encrypted: string): Promise<string> {
    // Decrypt stored credentials
  }
}
```

## Definition of Done

- ✅ Configuration modal fully functional with all fields
- ✅ Test connection feature working with proper feedback
- ✅ Multiple profiles can be saved and switched
- ✅ Credentials encrypted in browser storage
- ✅ UI follows existing Tailwind CSS design patterns
- ✅ Form validation working with clear error messages
- ✅ Connection status indicator visible in main UI
- ✅ Modal responsive on mobile devices
- ✅ Unit tests for configuration logic
- ✅ E2E tests for configuration workflow

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Credential security in browser storage
- **Mitigation:** Use Web Crypto API for encryption
- **Rollback:** Option to not save credentials, enter each session

**Secondary Risk:** CORS issues during connection test
- **Mitigation:** Clear error message with setup instructions
- **Rollback:** Skip test, allow manual configuration

### Compatibility Verification

- ✅ No breaking changes to existing UI components
- ✅ No database changes required
- ✅ UI changes follow existing patterns
- ✅ Performance impact negligible
- ✅ Existing modals continue to function

## Estimation

**Story Points:** 5
**Estimated Hours:** 8-10 hours
**Dependencies:** Story 1.2 (WebDAV Service)

## Testing Strategy

### Unit Tests
1. Form validation logic
2. Profile management (CRUD operations)
3. Credential encryption/decryption
4. Store actions and mutations

### Integration Tests
1. Modal open/close behavior
2. Form submission flow
3. Connection test with WebDAVService
4. Profile switching functionality
5. Error handling scenarios

### E2E Tests
1. Complete configuration workflow
2. Save and load profile
3. Connection test with real server
4. Credential persistence across sessions

## Notes for Developer

- Use existing BaseModal and FormField components
- Leverage existing validation composables (useFormValidation)
- Consider adding "Import from URL" feature for auto-configuration
- Add keyboard shortcuts (Escape to close, Enter to submit)
- Show recently used profiles at top of list
- Consider adding advanced options in collapsible section
- Add help text/tooltips for configuration fields
- Clear any test credentials from commits