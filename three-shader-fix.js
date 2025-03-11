/**
 * This file patches the Three.js shader chunks to work with Vite's bundling
 * It's applied during the build process to fix GLSL shader issues
 */

const fs = require('fs');
const path = require('path');

/**
 * Fix Three.js shader files in node_modules by replacing instances of GLSL shader code
 * that might cause problems during minification
 */
function fixThreeShaders() {
  try {
    console.log('Applying Three.js shader fixes for production build...');
    
    // Get the path to Three.js shaders
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const threeShadersDir = path.join(nodeModulesPath, 'three', 'src', 'renderers', 'shaders');
    
    // Check if the directory exists
    if (!fs.existsSync(threeShadersDir)) {
      console.warn('Three.js shaders directory not found:', threeShadersDir);
      return;
    }
    
    // Files we need to fix - focus on the ShaderChunk.js and ShaderLib files
    const shaderFiles = [
      path.join(threeShadersDir, 'ShaderChunk.js'),
      path.join(threeShadersDir, 'ShaderLib.js'),
      path.join(threeShadersDir, 'ShaderLib', 'meshphysical_vert.glsl.js'),
      path.join(threeShadersDir, 'ShaderLib', 'meshphysical_frag.glsl.js')
    ];
    
    // Process each shader file
    shaderFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        console.log('Processing:', filePath);
        
        // Read the file content
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Make replacements to help with minification issues
        // These are common patterns that can cause problems
        content = content
          // Add quotes around vec2, vec3, vec4 to make them strings
          .replace(/\bvec2\b(?!\s*\w+\()/g, '"vec2"')
          .replace(/\bvec3\b(?!\s*\w+\()/g, '"vec3"')
          .replace(/\bvec4\b(?!\s*\w+\()/g, '"vec4"')
          // Ensure template literals are properly formatted
          .replace(/`([\s\S]*?)`/g, (_, shader) => {
            return `\`${shader.replace(/\${/g, '\\${')}\``;
          });
        
        // Write back the modified content
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed shader file:', filePath);
      } else {
        console.warn('Shader file not found:', filePath);
      }
    });
    
    console.log('Three.js shader fixes applied successfully!');
  } catch (error) {
    console.error('Error fixing Three.js shaders:', error);
  }
}

// Export the function for use in build scripts
module.exports = fixThreeShaders;