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
    target: 'es2019', // Even more conservative target for better browser support
    minify: 'esbuild', // Try esbuild instead of terser
    sourcemap: false,
    // Optimize chunk size with less aggressive splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react', 
            'react-dom', 
            'react-router-dom',
            // Include Three.js in the vendor bundle to avoid separate chunking
            'three',
            '@react-three/fiber', 
            '@react-three/drei'
          ]
        },
        // Optimize chunk size with more reasonable limits
        chunkSizeWarningLimit: 1000,
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
    include: [
      'three', 
      '@react-three/fiber', 
      '@react-three/drei',
      'react',
      'react-dom',
      'react-router-dom'
    ],
    exclude: []
  },
  esbuild: {
    // Disable code elimination since it can cause issues
    pure: [],
    // Use a more conservative JS target
    target: 'es2019'
  }
});