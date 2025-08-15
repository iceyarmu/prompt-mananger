import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import { splitVendorChunkPlugin } from 'vite'

// Performance optimization configuration for vite
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(process.cwd(), '../../'))
  const isDevelopment = mode === 'development'
  const isProduction = mode === 'production'
  
  return {
    plugins: [
      vue(),
      // Vendor chunk splitting
      splitVendorChunkPlugin(),
      
      // Compression plugin for production
      isProduction && viteCompression({
        verbose: true,
        disable: false,
        threshold: 10240,
        algorithm: 'gzip',
        ext: '.gz',
      }),
      
      // Bundle analyzer for production
      isProduction && visualizer({
        open: false,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/bundle-analysis.html'
      })
    ].filter(Boolean),
    
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': resolve(__dirname, 'src'),
        '@prompt-optimizer/core': path.resolve(__dirname, '../core'),
        '@prompt-optimizer/ui': path.resolve(__dirname, '../ui'),
        '@prompt-optimizer/web': path.resolve(__dirname, '../web'),
        '@prompt-optimizer/extension': path.resolve(__dirname, '../extension')
      }
    },
    
    build: {
      // Target modern browsers for smaller bundles
      target: 'es2020',
      
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
      
      // Rollup options for code splitting
      rollupOptions: {
        output: {
          // Manual chunk splitting strategy
          manualChunks: {
            // Vue ecosystem
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            
            // UI libraries
            'ui-vendor': [
              '@headlessui/vue',
              '@heroicons/vue',
              '@vueuse/core'
            ],
            
            // Editor related
            'editor': [
              'monaco-editor',
              'codemirror',
              '@codemirror/lang-markdown'
            ],
            
            // WebDAV and file operations
            'webdav': ['webdav'],
            
            // Utilities
            'utils': ['lodash-es', 'axios', 'date-fns'],
            
            // Heavy components (lazy loaded)
            'optimization': [
              '@prompt-optimizer/core/services/llm',
              '@prompt-optimizer/core/services/prompt'
            ]
          },
          
          // Asset file naming
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.')
            const ext = info[info.length - 1]
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`
            } else if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`
            }
            return `assets/[name]-[hash][extname]`
          },
          
          // Chunk file naming
          chunkFileNames: 'js/[name]-[hash].js',
          
          // Entry file naming
          entryFileNames: 'js/[name]-[hash].js'
        }
      },
      
      // Minification options
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info'] : []
        }
      },
      
      // Enable source maps for production debugging
      sourcemap: !isProduction,
      
      // CSS code splitting
      cssCodeSplit: true,
      
      // Asset inlining threshold (4kb)
      assetsInlineLimit: 4096,
      
      // Enable brotli compression reporting
      reportCompressedSize: false
    },
    
    // Optimization options
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        '@vueuse/core'
      ],
      exclude: [
        '@prompt-optimizer/core',
        '@prompt-optimizer/ui'
      ]
    },
    
    // Server configuration
    server: {
      port: 18181,
      host: true,
      fs: {
        allow: ['..']
      },
      hmr: true,
      watch: {
        usePolling: false,
        interval: 100
      }
    },
    
    // Define global constants
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || mode),
        ...Object.keys(env).reduce((acc, key) => {
          acc[key] = env[key];
          return acc;
        }, {})
      }
    },
    
    // Preview server configuration
    preview: {
      port: 3000,
      host: true
    }
  }
})