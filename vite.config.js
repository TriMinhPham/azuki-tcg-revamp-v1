// Optimized vite config with advanced code splitting
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true
      }
    },
    sourcemap: false,
    // Optimize chunk size with aggressive splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react', 
            'react-dom', 
            'react-router-dom'
          ],
          'three-core': ['three'],
          'three-fiber': [
            '@react-three/fiber', 
            '@react-three/drei'
          ],
        },
        // Optimize chunk size with more aggressive splitting
        chunkSizeWarningLimit: 600,
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      },
    },
    // Reduce bundle size with tree shaking
    assetsInlineLimit: 4096, // 4kb - smaller assets are inlined
    cssCodeSplit: true,
    reportCompressedSize: false, // Speeds up build
  },
  optimizeDeps: {
    include: ['three'],
    exclude: []
  },
  esbuild: {
    pure: process.env.NODE_ENV === 'production' ? [
      'console.log', 
      'console.info', 
      'console.debug', 
      'console.trace'
    ] : [],
  }
});