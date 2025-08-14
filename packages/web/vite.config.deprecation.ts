import { Plugin } from 'vite';

/**
 * Vite plugin to handle deprecated components in production builds
 */
export function deprecationPlugin(): Plugin {
  const deprecatedPaths = [
    '/legacy/',
    'Legacy.vue',
    'Legacy.ts',
    'Legacy.js'
  ];

  return {
    name: 'vite-plugin-deprecation',
    
    // Transform code to add deprecation warnings in development
    transform(code: string, id: string) {
      if (process.env.NODE_ENV === 'development') {
        // Check if file is in deprecated path
        const isDeprecated = deprecatedPaths.some(path => id.includes(path));
        
        if (isDeprecated) {
          // Inject deprecation warning at the top of the file
          const warning = `
            if (typeof window !== 'undefined' && window.console) {
              console.warn('[DEPRECATION] Loading deprecated module:', '${id}');
            }
          `;
          return warning + code;
        }
      }
      
      return code;
    },
    
    // Exclude deprecated components from production build
    config(config) {
      if (process.env.NODE_ENV === 'production') {
        // Add build exclusions
        if (!config.build) config.build = {};
        if (!config.build.rollupOptions) config.build.rollupOptions = {};
        if (!config.build.rollupOptions.external) config.build.rollupOptions.external = [];
        
        // Convert external to function if it's an array
        const originalExternal = config.build.rollupOptions.external;
        config.build.rollupOptions.external = (id: string) => {
          // Check if should exclude deprecated components
          const shouldExclude = deprecatedPaths.some(path => id.includes(path));
          if (shouldExclude) {
            console.log(`[Build] Excluding deprecated component: ${id}`);
            return true;
          }
          
          // Check original external config
          if (typeof originalExternal === 'function') {
            return originalExternal(id);
          } else if (Array.isArray(originalExternal)) {
            return originalExternal.includes(id);
          }
          
          return false;
        };
      }
      
      return config;
    },
    
    // Add virtual module for deprecation timeline
    resolveId(id: string) {
      if (id === 'virtual:deprecation-timeline') {
        return id;
      }
    },
    
    load(id: string) {
      if (id === 'virtual:deprecation-timeline') {
        // Generate deprecation timeline at build time
        return `
          export const deprecationTimeline = {
            "2.0.0": [
              "AppContentLegacy",
              "FileTreeLegacy",
              "MarkdownEditorLegacy",
              "AppLayoutLegacy"
            ],
            "3.0.0": {
              remove: [
                "AppContentLegacy",
                "FileTreeLegacy",
                "MarkdownEditorLegacy",
                "AppLayoutLegacy"
              ]
            }
          };
          
          export const migrationGuides = {
            "AppContentLegacy": "/docs/migration/app-content.md",
            "FileTreeLegacy": "/docs/migration/file-tree.md",
            "MarkdownEditorLegacy": "/docs/migration/markdown-editor.md",
            "AppLayoutLegacy": "/docs/migration/app-layout.md"
          };
        `;
      }
    }
  };
}

/**
 * Build-time deprecation checker
 */
export function checkDeprecationsAtBuildTime() {
  const fs = require('fs');
  const path = require('path');
  
  const deprecatedComponents = [
    'AppContentLegacy',
    'FileTreeLegacy',
    'MarkdownEditorLegacy',
    'AppLayoutLegacy'
  ];
  
  const srcDir = path.resolve(__dirname, 'src');
  const warnings: string[] = [];
  
  function checkFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    deprecatedComponents.forEach(component => {
      if (content.includes(component)) {
        warnings.push(`${filePath} uses deprecated component: ${component}`);
      }
    });
  }
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    
    files.forEach((file: string) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('legacy')) {
        walkDir(filePath);
      } else if (stat.isFile() && (file.endsWith('.vue') || file.endsWith('.ts') || file.endsWith('.js'))) {
        checkFile(filePath);
      }
    });
  }
  
  walkDir(srcDir);
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Deprecation Warnings Found:\n');
    warnings.forEach(warning => console.log(`  - ${warning}`));
    console.log('\nPlease update these files to use the new components.\n');
  }
  
  return warnings;
}