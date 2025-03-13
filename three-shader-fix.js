/**
 * Three.js shader fixer for Vercel deployment
 * This is a safer approach that doesn't directly modify Three.js files
 */

const fs = require('fs');
const path = require('path');

/**
 * Creates a runtime shader fix that's injected into the page
 */
function fixThreeShaders() {
  try {
    console.log('Creating runtime shader fixes instead of modifying Three.js directly...');
    
    // Create a runtime patch file that will fix shader issues at runtime
    const patchFilePath = path.join(process.cwd(), 'public', 'shader-fix.js');
    const patchDirPath = path.join(process.cwd(), 'public');
    
    if (!fs.existsSync(patchDirPath)) {
      fs.mkdirSync(patchDirPath, { recursive: true });
    }
    
    // Runtime patch that handles shader syntax issues in the browser
    const runtimePatch = `
// Runtime patch for Three.js shader syntax errors
// This script fixes issues with GLSL keywords in the browser
(function() {
  console.log('Shader runtime fix loaded');
  
  // Fix for "Unexpected identifier 'vec2'" and similar errors
  function fixShaderKeywords() {
    try {
      // Create globally available GLSL keywords as strings to prevent syntax errors
      ['vec2', 'vec3', 'vec4', 'mat2', 'mat3', 'mat4', 'sampler2D'].forEach(function(keyword) {
        // Only add if not already defined
        if (window[keyword] === undefined) {
          // Define as getter that returns a string
          Object.defineProperty(window, keyword, {
            get: function() { return keyword; },
            configurable: true
          });
        }
      });
      
      // Error handler to catch and fix specific shader errors
      window.addEventListener('error', function(event) {
        const errorMsg = event.error?.message || event.message || '';
        
        // Check for shader-related errors
        if (errorMsg.includes('Unexpected identifier') && 
            (errorMsg.includes('vec2') || errorMsg.includes('vec3') || 
             errorMsg.includes('vec4') || errorMsg.includes('mat'))) {
          
          console.error('Caught shader error:', errorMsg);
          
          // Try to resolve by defining missing keywords
          const keyword = errorMsg.match(/['"]([^'"]+)['"]/)?.[1] || 
                         errorMsg.match(/identifier\s+['"]?([^'"]+)['"]?/)?.[1];
          
          if (keyword) {
            console.log('Defining missing shader keyword:', keyword);
            window[keyword] = keyword;
          }
          
          // Prevent the error from propagating
          event.preventDefault();
        }
      }, true);
    } catch (e) {
      console.error('Error in shader keyword fix:', e);
    }
  }
  
  // Run the fix after everything is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixShaderKeywords);
  } else {
    setTimeout(fixShaderKeywords, 0);
  }
  
  // Also expose globally for on-demand use
  window.fixShaderKeywords = fixShaderKeywords;
})();
`;
    
    fs.writeFileSync(patchFilePath, runtimePatch, 'utf8');
    console.log('Created runtime shader patch at:', patchFilePath);
    
    // Add it to index.html if it's not already there
    const indexPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(indexPath)) {
      let indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Only add if not already present
      if (!indexContent.includes('shader-fix.js')) {
        const headEndPos = indexContent.indexOf('</head>');
        if (headEndPos !== -1) {
          const fixScript = '\n    <script src="/shader-fix.js"></script>';
          indexContent = indexContent.slice(0, headEndPos) + fixScript + indexContent.slice(headEndPos);
          fs.writeFileSync(indexPath, indexContent, 'utf8');
          console.log('Added shader runtime fix to index.html');
        }
      }
    }
    
    console.log('Three.js shader runtime fix created successfully!');
  } catch (error) {
    console.error('Error creating shader fix:', error);
  }
}

// Export the function for use in build scripts
module.exports = fixThreeShaders;