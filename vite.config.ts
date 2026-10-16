import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import postcssPxToRem from 'postcss-pxtorem'
import { feedbackApiPlugin } from './server/feedbackApiPlugin'

export default defineConfig({
  plugins: [vue(), feedbackApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    postcss: {
      plugins: [
        postcssPxToRem({
          rootValue: 37.5,
          propList: ['*'],
          selectorBlackList: ['.norem'],
          minPixelValue: 1,
          exclude: (file: string) => /[\\/]src[\\/]ops[\\/]/.test(file),
        }),
      ],
    },
  },
  build: {
    target: 'es2015',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash][extname]',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
