// Optimized vite config with advanced code splitting
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import glslPlugin from './glsl-plugin';

export default defineConfig({
  plugins: [
    react({
      // Add additional configuration to prevent transformation issues
      jsxImportSource: '@/jsx-runtime',
      babel: {
        plugins: [
          // Preserve function names to avoid breaking patches
          ['@babel/plugin-transform-function-name', { loose: true }]
        ]
      }
    }),
    glslPlugin(),
    // Custom plugin to handle shader code directly in the final output
    {
      name: 'shader-post-process',
      generateBundle(options, bundle) {
        // Process all generated JS files
        Object.keys(bundle).forEach(fileName => {
          if (fileName.endsWith('.js')) {
            const chunk = bundle[fileName];
            if (chunk.type === 'chunk' && chunk.code) {
              // Fix potential shader syntax issues in the final bundle
              const fixedCode = chunk.code
                .replace(/\bvec2\b(?!\s*[\w\.])/g, '"vec2"')
                .replace(/\bvec3\b(?!\s*[\w\.])/g, '"vec3"')
                .replace(/\bvec4\b(?!\s*[\w\.])/g, '"vec4"')
                .replace(/\bmat2\b(?!\s*[\w\.])/g, '"mat2"')
                .replace(/\bmat3\b(?!\s*[\w\.])/g, '"mat3"')
                .replace(/\bmat4\b(?!\s*[\w\.])/g, '"mat4"');
              
              chunk.code = fixedCode;
            }
          }
        });
      }
    }
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
    target: 'es2015', // Conservative target for maximum browser support
    minify: 'esbuild', // Use esbuild for safer minification
    sourcemap: true, // Enable sourcemaps for debugging
    // Configure minify options to avoid unsafe transformations
    minifyOptions: {
      syntax: true,
      keep_fnames: true, // Preserve function names to avoid breaking fixes
      ecma: 2015,
      safari10: true
    },
    // Optimize chunk size with less aggressive splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react', 
            'react-dom', 
            'react-router-dom',
            // Separate axios to allow easier patching
            'three',
            '@react-three/fiber', 
            '@react-three/drei'
          ],
          'axios': ['axios'] // Isolate axios in its own chunk
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