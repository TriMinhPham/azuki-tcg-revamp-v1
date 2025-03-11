// Optimized vite config with advanced code splitting
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import glslPlugin from './glsl-plugin';

export default defineConfig({
  plugins: [
    react(),
    glslPlugin()
  ],
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
    target: 'es2015', // Even more conservative target for maximum browser support
    minify: false, // Disable minification entirely for debugging
    sourcemap: true, // Enable sourcemaps for debugging
    // Disable minification for GLSL code
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
    assetsInlineLimit: 0, // Don't inline assets to avoid GLSL processing issues
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