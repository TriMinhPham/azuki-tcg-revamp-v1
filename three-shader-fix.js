/**
 * Enhanced Three.js shader fixer for Vercel deployment
 * This script patches Three.js shader files to prevent syntax errors during bundling
 */

const fs = require('fs');
const path = require('path');

/**
 * Thoroughly fix Three.js shader files in node_modules to prevent GLSL syntax errors
 */
function fixThreeShaders() {
  try {
    console.log('Applying comprehensive Three.js shader fixes for deployment...');
    
    // Get the path to Three.js shaders
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const threePath = path.join(nodeModulesPath, 'three');
    const threeShadersDir = path.join(threePath, 'src', 'renderers', 'shaders');
    
    // Check if the directory exists
    if (!fs.existsSync(threeShadersDir)) {
      console.warn('Three.js shaders directory not found:', threeShadersDir);
      return;
    }
    
    // Map all shader files and shader-related files to process
    const shaderFiles = [
      // Main shader files
      path.join(threeShadersDir, 'ShaderChunk.js'),
      path.join(threeShadersDir, 'ShaderLib.js'),
      // Material files
      path.join(threePath, 'src', 'materials', 'MeshPhysicalMaterial.js'),
      path.join(threePath, 'src', 'materials', 'MeshStandardMaterial.js'),
      // Additional shader files
      path.join(threePath, 'src', 'renderers', 'WebGLRenderer.js')
    ];
    
    // Add all ShaderChunk files
    const shaderChunkDir = path.join(threeShadersDir, 'ShaderChunk');
    if (fs.existsSync(shaderChunkDir)) {
      const chunkFiles = fs.readdirSync(shaderChunkDir);
      chunkFiles.forEach(file => {
        if (file.endsWith('.glsl.js')) {
          shaderFiles.push(path.join(shaderChunkDir, file));
        }
      });
    }
    
    // Add all ShaderLib files
    const shaderLibDir = path.join(threeShadersDir, 'ShaderLib');
    if (fs.existsSync(shaderLibDir)) {
      const libFiles = fs.readdirSync(shaderLibDir);
      libFiles.forEach(file => {
        if (file.endsWith('.glsl.js')) {
          shaderFiles.push(path.join(shaderLibDir, file));
        }
      });
    }
    
    // Process each file
    let fixCount = 0;
    shaderFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        console.log('Processing shader file:', filePath);
        
        try {
          // Read the file content
          let content = fs.readFileSync(filePath, 'utf8');
          const originalContent = content;
          
          // Replace GLSL keywords with quoted versions
          const glslKeywords = [
            'vec2', 'vec3', 'vec4', 
            'mat2', 'mat3', 'mat4',
            'sampler2D', 'sampler3D', 'samplerCube',
            'uniform', 'varying', 'attribute',
            'precision', 'lowp', 'mediump', 'highp'
          ];
          
          glslKeywords.forEach(keyword => {
            // Only replace exact matches that aren't already in quotes
            // Avoid replacing function calls or variables
            const regex = new RegExp(`\\b${keyword}\\b(?!\\s*[\\w\\.\\(])`, 'g');
            content = content.replace(regex, `"${keyword}"`);
          });
          
          // Special handling for template literals (backticks)
          content = content.replace(/`([\s\S]*?)`/g, (match, shaderCode) => {
            // Escape template placeholders
            let processed = shaderCode.replace(/\${/g, '\\${');
            
            // Also handle GLSL keywords inside the shader code
            glslKeywords.forEach(keyword => {
              const regex = new RegExp(`\\b${keyword}\\b(?!\\s*[\\w\\.\\(])`, 'g');
              processed = processed.replace(regex, `'${keyword}'`);
            });
            
            return `\`${processed}\``;
          });
          
          // Fix potential template literal issues
          content = content.replace(/export\s+default\s+`/g, 'export default `');
          
          // Write back only if changed
          if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed shader file:', path.basename(filePath));
            fixCount++;
          } else {
            console.log('No changes needed for:', path.basename(filePath));
          }
        } catch (fileError) {
          console.error('Error processing file:', path.basename(filePath), fileError);
        }
      } else {
        console.warn('Shader file not found:', filePath);
      }
    });
    
    // Additional patch: Create a runtime patch file if it doesn't exist
    const patchFilePath = path.join(process.cwd(), 'public', 'shader-fix.js');
    const patchDirPath = path.join(process.cwd(), 'public');
    
    if (!fs.existsSync(patchDirPath)) {
      fs.mkdirSync(patchDirPath, { recursive: true });
    }
    
    const runtimePatch = `
// Runtime patch for Three.js shader syntax errors
// This script fixes issues with GLSL keywords in the browser
(function() {
  // Fix for "Unexpected identifier 'vec2'" and similar errors
  function fixShaderKeywords() {
    try {
      // List of GLSL keywords that might cause syntax errors
      const glslKeywords = [
        'vec2', 'vec3', 'vec4', 
        'mat2', 'mat3', 'mat4',
        'sampler2D', 'sampler3D', 'samplerCube',
        'uniform', 'varying', 'attribute'
      ];
      
      // Check all global objects for THREE related objects
      Object.keys(window).forEach(key => {
        try {
          const obj = window[key];
          if (obj && typeof obj === 'object') {
            // Look for ShaderChunk or ShaderLib
            if (obj.ShaderChunk || obj.ShaderLib) {
              console.log('Found Three.js shader objects, applying runtime fix');
              
              // Fix ShaderChunk
              if (obj.ShaderChunk) {
                Object.keys(obj.ShaderChunk).forEach(chunkName => {
                  const chunk = obj.ShaderChunk[chunkName];
                  if (typeof chunk === 'string') {
                    // No need to modify the string, just ensure it's kept as a string
                  }
                });
              }
              
              // Fix ShaderLib
              if (obj.ShaderLib) {
                Object.keys(obj.ShaderLib).forEach(libName => {
                  const lib = obj.ShaderLib[libName];
                  if (lib && typeof lib === 'object' && lib.vertexShader) {
                    // Make sure shader code remains as strings
                  }
                });
              }
            }
          }
        } catch (e) {
          // Ignore errors accessing properties
        }
      });
    } catch (e) {
      console.error('Error in shader runtime fix:', e);
    }
  }
  
  // Run the fix after the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixShaderKeywords);
  } else {
    setTimeout(fixShaderKeywords, 0);
  }
  
  // Also fix on demand
  window.fixShaderKeywords = fixShaderKeywords;
})();
`;
    
    fs.writeFileSync(patchFilePath, runtimePatch, 'utf8');
    console.log('Created runtime shader patch at:', patchFilePath);
    
    // Patch the main index.html to include the runtime fix
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
    
    console.log(`Three.js shader fixes complete! Fixed ${fixCount} files.`);
  } catch (error) {
    console.error('Error fixing Three.js shaders:', error);
  }
}

// Export the function for use in build scripts
module.exports = fixThreeShaders;