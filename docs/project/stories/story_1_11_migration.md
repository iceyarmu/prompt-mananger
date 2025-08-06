# Story 1.11: Implement Migration and Backward Compatibility - Brownfield Addition

## User Story

As a user,
I want my existing local prompts migrated to the new system,
So that I don't lose my previous work.

## Story Context

### Existing System Integration

- **Integrates with:** Existing local storage, WebDAVService, new file system
- **Technology:** Vue 3.4+, TypeScript, Browser APIs, WebDAV
- **Follows pattern:** Data migration patterns, backup/restore patterns
- **Touch points:** Local storage data, WebDAV file creation, user notifications

## Acceptance Criteria

### Functional Requirements

1. Detect existing prompts in local storage on first launch
2. Prompt user to migrate with clear explanation
3. Create backup of local storage before migration
4. Convert each local prompt to .md file format
5. Upload converted files to WebDAV storage
6. Verify successful migration before clearing local storage
7. Provide rollback option if migration fails

### Integration Requirements

8. Migration runs only once per browser/user
9. Existing app remains functional if migration skipped
10. Migration process doesn't block UI
11. Progress indication during migration
12. Local storage remains until migration confirmed

### Quality Requirements

13. Zero data loss during migration process
14. Migration handles interruptions gracefully
15. Clear error messages for migration failures
16. Backup downloadable as JSON file
17. Migration completes within 60 seconds for 100 prompts

## Technical Notes

### Integration Approach
- Check for migration flag in local storage
- Run migration wizard on first launch
- Create WebDAV folder structure
- Convert and upload in batches
- Maintain migration state for recovery

### Existing Pattern Reference
- Follow existing data export patterns
- Use same progress indicators
- Apply consistent backup formats
- Match existing wizard UI patterns

### Key Constraints
- One-time migration per browser
- Reversible within session
- Maximum 1000 prompts for auto-migration
- Preserve prompt metadata (dates, tags)

## Implementation Details

### Migration Detection
```typescript
class MigrationManager {
  private readonly MIGRATION_KEY = 'prompt_migration_v2';
  private readonly LEGACY_KEY = 'saved_prompts';
  
  async checkMigrationNeeded(): Promise<boolean> {
    // Check if migration already completed
    const migrationStatus = localStorage.getItem(this.MIGRATION_KEY);
    if (migrationStatus === 'completed') {
      return false;
    }
    
    // Check for legacy data
    const legacyData = localStorage.getItem(this.LEGACY_KEY);
    return legacyData \!== null && legacyData \!== '[]';
  }
  
  async getLegacyPrompts(): Promise<LegacyPrompt[]> {
    const data = localStorage.getItem(this.LEGACY_KEY);
    if (\!data) return [];
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse legacy prompts', error);
      return [];
    }
  }
}
```

### Migration Wizard Component
```vue
<template>
  <BaseModal
    v-model="showMigration"
    title="Migrate Your Prompts"
    :closable="false"
    size="lg"
  >
    <div class="migration-wizard">
      <\!-- Step Indicator -->
      <StepIndicator
        :steps="migrationSteps"
        :current="currentStep"
      />
      
      <\!-- Step Content -->
      <div class="step-content mt-6">
        <\!-- Step 1: Detection -->
        <div v-if="currentStep === 1">
          <h3 class="text-lg font-medium mb-2">
            Found {{ legacyPrompts.length }} Existing Prompts
          </h3>
          <p class="text-gray-600 mb-4">
            We've detected prompts stored locally in your browser. 
            Would you like to migrate them to your WebDAV storage for 
            better organization and sync across devices?
          </p>
          
          <div class="bg-blue-50 p-3 rounded mb-4">
            <p class="text-sm text-blue-800">
              <Icon name="info" class="inline w-4 h-4 mr-1" />
              Your original prompts will be backed up before migration.
            </p>
          </div>
          
          <div class="prompt-preview max-h-40 overflow-auto">
            <div
              v-for="prompt in previewPrompts"
              :key="prompt.id"
              class="border-b py-2"
            >
              <div class="font-medium">{{ prompt.title }}</div>
              <div class="text-xs text-gray-500">
                {{ formatDate(prompt.created) }}
              </div>
            </div>
          </div>
        </div>
        
        <\!-- Step 2: Backup -->
        <div v-if="currentStep === 2">
          <h3 class="text-lg font-medium mb-2">Creating Backup</h3>
          <p class="text-gray-600 mb-4">
            Creating a backup of your prompts before migration...
          </p>
          
          <ProgressBar :value="backupProgress" />
          
          <div v-if="backupComplete" class="mt-4">
            <Button
              variant="secondary"
              size="sm"
              @click="downloadBackup"
            >
              <Icon name="download" />
              Download Backup ({{ backupSize }})
            </Button>
          </div>
        </div>
        
        <\!-- Step 3: Migration -->
        <div v-if="currentStep === 3">
          <h3 class="text-lg font-medium mb-2">Migrating Prompts</h3>
          <p class="text-gray-600 mb-4">
            Uploading your prompts to WebDAV storage...
          </p>
          
          <ProgressBar 
            :value="migrationProgress"
            :label="`${migratedCount} / ${totalCount}`"
          />
          
          <div v-if="failedPrompts.length" class="mt-4">
            <Alert type="warning">
              {{ failedPrompts.length }} prompts failed to migrate.
              They will remain in local storage.
            </Alert>
          </div>
        </div>
        
        <\!-- Step 4: Completion -->
        <div v-if="currentStep === 4">
          <div class="text-center py-8">
            <Icon 
              name="check-circle" 
              class="w-16 h-16 text-green-500 mx-auto mb-4"
            />
            <h3 class="text-lg font-medium mb-2">
              Migration Complete\!
            </h3>
            <p class="text-gray-600">
              Successfully migrated {{ successCount }} prompts to your 
              WebDAV storage.
            </p>
          </div>
        </div>
      </div>
      
      <\!-- Actions -->
      <div class="flex justify-between mt-6">
        <Button
          v-if="currentStep === 1"
          variant="secondary"
          @click="skipMigration"
        >
          Skip for Now
        </Button>
        
        <Button
          v-if="currentStep === 1"
          variant="primary"
          @click="startMigration"
        >
          Start Migration
        </Button>
        
        <Button
          v-if="currentStep === 4"
          variant="primary"
          @click="completeMigration"
        >
          Continue to App
        </Button>
      </div>
    </div>
  </BaseModal>
</template>
```

### Migration Service
```typescript
class PromptMigrationService {
  async migratePrompts(
    prompts: LegacyPrompt[],
    onProgress: (progress: number) => void
  ): Promise<MigrationResult> {
    const results: MigrationResult = {
      success: [],
      failed: [],
      skipped: []
    };
    
    // Create migration folder
    const migrationFolder = `/migrated_${Date.now()}`;
    await webdavService.createFolder(migrationFolder);
    
    // Migrate in batches
    const batchSize = 10;
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (prompt) => {
          try {
            const mdContent = this.convertToMarkdown(prompt);
            const fileName = this.sanitizeFileName(prompt.title);
            const filePath = `${migrationFolder}/${fileName}.md`;
            
            await webdavService.putFile(filePath, mdContent);
            results.success.push(prompt);
          } catch (error) {
            console.error(`Failed to migrate: ${prompt.title}`, error);
            results.failed.push(prompt);
          }
        })
      );
      
      onProgress((i + batch.length) / prompts.length * 100);
    }
    
    return results;
  }
  
  private convertToMarkdown(prompt: LegacyPrompt): string {
    return `# ${prompt.title}

*Created: ${prompt.created}*
*Last Modified: ${prompt.modified}*
${prompt.tags ? `*Tags: ${prompt.tags.join(', ')}*` : ''}

---

${prompt.content}

---

## Metadata
- Original ID: ${prompt.id}
- Migrated: ${new Date().toISOString()}
- Version: ${prompt.version || '1.0'}
`;
  }
  
  private sanitizeFileName(title: string): string {
    return title
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 100);
  }
}
```

### Rollback Mechanism
```typescript
class MigrationRollback {
  async rollback(backup: BackupData): Promise<void> {
    // Restore local storage
    localStorage.setItem(this.LEGACY_KEY, JSON.stringify(backup.prompts));
    
    // Remove migration flag
    localStorage.removeItem(this.MIGRATION_KEY);
    
    // Optional: Remove migrated files from WebDAV
    if (backup.migrationFolder) {
      try {
        await webdavService.deleteFolder(backup.migrationFolder);
      } catch (error) {
        console.warn('Could not remove migrated files', error);
      }
    }
    
    showNotification('Migration rolled back', 'info');
  }
}
```

## Definition of Done

- ✅ Migration detection on first launch
- ✅ Migration wizard UI complete
- ✅ Backup creation before migration
- ✅ Prompts converted to markdown format
- ✅ Files uploaded to WebDAV successfully
- ✅ Progress indication during migration
- ✅ Error handling for failed migrations
- ✅ Rollback mechanism functional
- ✅ Skip option preserves local storage
- ✅ Migration state persisted
- ✅ Zero data loss verified
- ✅ Unit tests for migration logic
- ✅ Integration tests for full workflow

## Risk and Compatibility Check

### Risk Assessment

**Primary Risk:** Data loss during migration
- **Mitigation:** Mandatory backup, verification before deletion
- **Rollback:** Restore from backup JSON

**Secondary Risk:** WebDAV connection failure during migration
- **Mitigation:** Retry logic, partial migration support
- **Rollback:** Keep local storage until confirmed

### Compatibility Verification

- ✅ No breaking changes to existing app
- ✅ Local storage preserved if skipped
- ✅ UI remains functional during migration
- ✅ Performance acceptable for large datasets
- ✅ Browser compatibility maintained

## Estimation

**Story Points:** 8
**Estimated Hours:** 12-14 hours
**Dependencies:** Story 1.2 (WebDAV Service)

## Testing Strategy

### Unit Tests
1. Legacy prompt detection
2. Markdown conversion logic
3. Filename sanitization
4. Backup creation
5. Rollback functionality

### Integration Tests
1. Migration wizard flow
2. WebDAV upload process
3. Progress tracking
4. Error recovery
5. Skip and continue paths

### E2E Tests
1. Complete migration workflow
2. Large dataset migration (100+ prompts)
3. Migration interruption recovery
4. Rollback after partial migration

## Notes for Developer

- Test with various legacy data formats
- Handle corrupted local storage gracefully
- Consider chunked uploads for large migrations
- Add dry-run mode for testing
- Log migration metrics for analysis
- Consider incremental migration support
- Add migration resume capability
- Document rollback process clearly
