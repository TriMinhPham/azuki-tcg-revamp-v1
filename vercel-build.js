// This is a custom build script for Vercel
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fixThreeShaders = require('./three-shader-fix');

console.log('Starting custom Vercel build script...');

// Set environment variables for compatibility
process.env.NODE_ENV = 'production';
process.env.VITE_APP_ENV = 'production';
process.env.BROWSERSLIST_ENV = 'production';

// Apply Three.js shader fixes before building
try {
  console.log('Applying Three.js shader fixes...');
  fixThreeShaders();
  console.log('Shader fixes applied successfully!');
} catch (error) {
  console.error('Error applying shader fixes:', error);
  console.log('Continuing with build anyway...');
}

// Run the build command
try {
  console.log('Building frontend with Vite...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Create a simple vercel.json file in the dist directory
const vercelConfig = {
  "version": 2,
  "routes": [
    {
      "src": "/assets/(.*)",
      "dest": "/assets/$1",
      "headers": { "Cache-Control": "public, max-age=31536000, immutable" }
    },
    {
      "src": "/(.*)\\.(.+)",
      "dest": "/$1.$2"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
};

// Write the vercel.json file to the dist directory
try {
  console.log('Creating vercel.json in dist directory...');
  fs.writeFileSync(
    path.join(__dirname, 'dist', 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2)
  );
  console.log('vercel.json created successfully!');
} catch (error) {
  console.error('Failed to create vercel.json:', error);
}

console.log('Vercel build script completed!');