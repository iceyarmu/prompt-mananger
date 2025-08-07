import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, '../ui')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PromptOptimizerUI',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs']
    },
    watch: process.env.NODE_ENV === 'development' ? {
      // 更精确的监听配置
      include: ['src/**/*'],
      buildDelay: 100
    } : null,
    sourcemap: true,
    rollupOptions: {
      external: ['vue', '@prompt-optimizer/core', '@prompt-optimizer/webdav', 'element-plus', 'element-plus/dist/index.css', 'uuid', 'pinia', 'vue-i18n'],
      output: {
        globals: {
          vue: 'Vue',
          '@prompt-optimizer/core': 'PromptOptimizerCore',
          '@prompt-optimizer/webdav': 'PromptOptimizerWebDAV',
          'element-plus': 'ElementPlus',
          'uuid': 'uuid',
          'pinia': 'Pinia',
          'vue-i18n': 'VueI18n'
        },
        assetFileNames: 'style.css'
      }
    },
    cssCodeSplit: false,
    emptyOutDir: false
  },
  assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg']
}) 