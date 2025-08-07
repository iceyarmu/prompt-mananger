const fs = require('fs');
const path = require('path');

// Generate test folder structure with various .md files
function generateTestData(baseDir) {
  console.log('🚀 Starting test data generation...');
  
  // Create basic folder structure
  const folders = [
    'documents',
    'documents/projects',
    'documents/projects/project-a',
    'documents/projects/project-b',
    'documents/projects/project-c',
    'notes',
    'notes/daily',
    'notes/daily/2024',
    'notes/daily/2024/08',
    'notes/meetings',
    'notes/ideas',
    'templates',
    'templates/reports',
    'templates/documentation',
    'archive',
    'archive/2024',
    'archive/2024/q1',
    'archive/2024/q2',
    'archive/2024/q3',
    'archive/2023',
    'personal',
    'personal/journal',
    'personal/learning',
    'work',
    'work/tasks',
    'work/reviews'
  ];

  // Create folders
  console.log('📁 Creating folder structure...');
  folders.forEach(folder => {
    const folderPath = path.join(baseDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  });

  // Create sample .md files with realistic content
  const files = [
    { 
      path: 'README.md', 
      content: `# Test WebDAV Repository

This is a test repository for the Prompt Optimizer File Tree component.

## Structure
- **documents/**: Project documentation
- **notes/**: Daily notes and meeting records
- **templates/**: Reusable templates
- **archive/**: Archived content
- **personal/**: Personal notes
- **work/**: Work-related content

## Testing
This data is generated for testing the File Tree component with WebDAV integration.`
    },
    { 
      path: 'documents/guide.md', 
      content: `# User Guide

## WebDAV File Tree Testing

This guide explains how to use the WebDAV test environment.

### Features
1. Hierarchical file browsing
2. Search and filter functionality
3. Virtual scrolling for large trees
4. Keyboard navigation

### Usage
- Single-click to select files
- Double-click to open files
- Use arrow keys for navigation
- Press Enter to toggle folders`
    },
    { 
      path: 'documents/projects/overview.md', 
      content: `# Projects Overview

## Active Projects

### Project A
High-priority project focusing on core features.

### Project B
Secondary project for UI improvements.

### Project C
Research and development initiatives.`
    },
    { 
      path: 'documents/projects/project-a/spec.md', 
      content: `# Project A Specification

## Overview
Core feature implementation project.

## Requirements
- Feature 1: File tree component
- Feature 2: WebDAV integration
- Feature 3: Search functionality

## Timeline
- Phase 1: Q3 2024
- Phase 2: Q4 2024`
    },
    { 
      path: 'documents/projects/project-a/notes.md', 
      content: `# Project A Notes

## Development Notes
- Implemented basic tree structure
- Added virtual scrolling
- WebDAV integration complete

## Issues
- Performance with 1000+ files
- Keyboard navigation edge cases`
    },
    { 
      path: 'documents/projects/project-b/plan.md', 
      content: `# Project B Plan

## UI Improvements
1. Theme system enhancement
2. Responsive design updates
3. Accessibility improvements`
    },
    { 
      path: 'notes/daily/2024/08/2024-08-07.md', 
      content: `# Daily Notes - August 7, 2024

## Tasks Completed
- ✅ File tree component implementation
- ✅ Virtual scrolling integration
- ✅ WebDAV service connection

## Tomorrow's Plan
- Integration testing
- Performance optimization
- Documentation updates`
    },
    { 
      path: 'notes/meetings/standup.md', 
      content: `# Standup Meeting Notes

## August 7, 2024
- **Yesterday**: File tree development
- **Today**: Testing and optimization
- **Blockers**: Need WebDAV test server`
    },
    { 
      path: 'templates/bug-report.md', 
      content: `# Bug Report Template

## Bug Description
[Describe the bug]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [...]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS: 
- Browser: 
- Version:`
    },
    { 
      path: 'templates/feature-request.md', 
      content: `# Feature Request Template

## Feature Description
[Describe the feature]

## Use Case
[Why is this needed?]

## Proposed Solution
[How could this be implemented?]

## Alternatives Considered
[Other options explored]`
    },
    { 
      path: 'templates/documentation/api.md', 
      content: `# API Documentation Template

## Endpoint
\`\`\`
[METHOD] /api/endpoint
\`\`\`

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | Description |

## Response
\`\`\`json
{
  "status": "success",
  "data": {}
}
\`\`\``
    },
    { 
      path: 'archive/2024/q1/report.md', 
      content: `# Q1 2024 Report

## Summary
First quarter achievements and metrics.

## Highlights
- Project completion: 85%
- Bug reduction: 40%
- User satisfaction: 92%`
    },
    { 
      path: 'personal/journal/thoughts.md', 
      content: `# Personal Thoughts

## Development Journey
Reflections on the development process and lessons learned.

## Key Learnings
- Importance of testing
- Value of documentation
- User feedback integration`
    },
    { 
      path: 'work/tasks/current.md', 
      content: `# Current Tasks

## High Priority
- [ ] Complete file tree implementation
- [ ] Set up WebDAV testing
- [ ] Write documentation

## Medium Priority
- [ ] Performance optimization
- [ ] Code review
- [ ] Test coverage improvement`
    }
  ];

  // Create regular files
  console.log('📝 Creating sample .md files...');
  files.forEach(file => {
    const filePath = path.join(baseDir, file.path);
    fs.writeFileSync(filePath, file.content);
  });

  // Generate large dataset for performance testing
  console.log('🔥 Generating large dataset for performance testing...');
  const perfTestBase = path.join(baseDir, 'performance-test');
  
  for (let batch = 0; batch < 10; batch++) {
    const batchFolder = path.join(perfTestBase, `batch-${batch}`);
    
    if (!fs.existsSync(batchFolder)) {
      fs.mkdirSync(batchFolder, { recursive: true });
    }
    
    // Create 100 files per batch (total 1000 files)
    for (let i = 1; i <= 100; i++) {
      const fileNum = batch * 100 + i;
      const content = `# Test File ${fileNum}

## Metadata
- **File Number**: ${fileNum}
- **Batch**: ${batch}
- **Created**: ${new Date().toISOString()}
- **Purpose**: Performance testing

## Content
This is test file number ${fileNum} for performance testing of the File Tree component.

### Lorem Ipsum
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### Test Data
- Random value: ${Math.random()}
- Timestamp: ${Date.now()}
- UUID: ${generateSimpleUUID()}

### Nested Structure
#### Level 1
##### Level 2
###### Level 3
Content at various heading levels for testing.

### Code Block
\`\`\`javascript
function testFunction() {
  console.log('File ${fileNum}');
  return ${fileNum};
}
\`\`\`

### Table
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value A  | Value B  | Value C  |
| Data 1   | Data 2   | Data 3   |

### List
1. First item
2. Second item
3. Third item
   - Sub-item A
   - Sub-item B
   - Sub-item C`;
      
      const fileName = `file-${String(fileNum).padStart(4, '0')}.md`;
      fs.writeFileSync(path.join(batchFolder, fileName), content);
    }
    
    console.log(`  ✅ Batch ${batch} created (100 files)`);
  }

  // Create some nested structures for edge case testing
  console.log('🎯 Creating edge case test files...');
  
  // Deep nesting
  const deepPath = path.join(baseDir, 'edge-cases/deep/nested/structure/very/deep/level');
  if (!fs.existsSync(deepPath)) {
    fs.mkdirSync(deepPath, { recursive: true });
  }
  fs.writeFileSync(path.join(deepPath, 'deep-file.md'), '# Deeply Nested File\n\nTesting deep folder structures.');

  // Special characters in filenames (safe ones)
  const specialCharsPath = path.join(baseDir, 'edge-cases/special-chars');
  if (!fs.existsSync(specialCharsPath)) {
    fs.mkdirSync(specialCharsPath, { recursive: true });
  }
  
  const safeSpecialFiles = [
    'file-with-dash.md',
    'file_with_underscore.md',
    'file.multiple.dots.md',
    'FILE-UPPERCASE.md',
    '123-numeric-start.md',
    'file (with parentheses).md',
    'file [with brackets].md'
  ];
  
  safeSpecialFiles.forEach(fileName => {
    fs.writeFileSync(
      path.join(specialCharsPath, fileName), 
      `# ${fileName}\n\nTesting special characters in filenames.`
    );
  });

  // Empty folders (should be filtered out in tree)
  const emptyFolders = [
    'edge-cases/empty-folder',
    'edge-cases/folder-with-non-md-files'
  ];
  
  emptyFolders.forEach(folder => {
    const folderPath = path.join(baseDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  });

  // Create some non-.md files to test filtering
  console.log('🚫 Creating non-.md files for filter testing...');
  fs.writeFileSync(path.join(baseDir, 'config.json'), '{"test": true}');
  fs.writeFileSync(path.join(baseDir, 'documents/data.csv'), 'col1,col2\nval1,val2');
  fs.writeFileSync(path.join(baseDir, 'notes/todo.txt'), 'Test todo file');
  fs.writeFileSync(path.join(baseDir, '.hidden-file'), 'Hidden file content');
  fs.writeFileSync(
    path.join(baseDir, 'edge-cases/folder-with-non-md-files/script.js'), 
    'console.log("JavaScript file");'
  );
  fs.writeFileSync(
    path.join(baseDir, 'edge-cases/folder-with-non-md-files/style.css'), 
    'body { margin: 0; }'
  );

  // Create summary statistics
  const stats = {
    folders: folders.length + 13, // Additional folders created
    regularFiles: files.length,
    performanceTestFiles: 1000,
    edgeCaseFiles: safeSpecialFiles.length + 1, // +1 for deep nested file
    nonMdFiles: 5,
    totalMdFiles: files.length + 1000 + safeSpecialFiles.length + 1
  };

  console.log('\n📊 Test Data Generation Complete!');
  console.log('================================');
  console.log(`📁 Folders created: ${stats.folders}`);
  console.log(`📝 Regular .md files: ${stats.regularFiles}`);
  console.log(`🔥 Performance test files: ${stats.performanceTestFiles}`);
  console.log(`🎯 Edge case files: ${stats.edgeCaseFiles}`);
  console.log(`🚫 Non-.md files: ${stats.nonMdFiles}`);
  console.log(`📄 Total .md files: ${stats.totalMdFiles}`);
  console.log('================================\n');

  // Create a manifest file
  const manifest = {
    generated: new Date().toISOString(),
    statistics: stats,
    structure: {
      folders: folders,
      regularFiles: files.map(f => f.path),
      performanceTestBatches: 10,
      edgeCases: {
        deepNesting: 'edge-cases/deep/nested/structure/very/deep/level/deep-file.md',
        specialCharacters: safeSpecialFiles,
        emptyFolders: emptyFolders
      },
      nonMdFiles: [
        'config.json',
        'documents/data.csv',
        'notes/todo.txt',
        '.hidden-file',
        'edge-cases/folder-with-non-md-files/script.js',
        'edge-cases/folder-with-non-md-files/style.css'
      ]
    }
  };

  fs.writeFileSync(
    path.join(baseDir, 'test-data-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('✅ Manifest file created: test-data-manifest.json');
}

// Simple UUID generator for test data
function generateSimpleUUID() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => {
    return Math.floor(Math.random() * 16).toString(16);
  });
}

// Main execution
const testDataDir = path.join(__dirname, 'test-data');

// Create test data directory if it doesn't exist
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
  console.log(`📁 Created test data directory: ${testDataDir}`);
}

// Run generation
generateTestData(testDataDir);