// GLSL shader handling plugin for Vite - Enhanced version for Vercel deployment
// This ensures that GLSL shaders are properly processed during bundling

module.exports = function glslPlugin() {
  return {
    name: 'vite-plugin-glsl',
    
    // Process files during the build
    transform(code, id) {
      // Skip node_modules/three to avoid breaking Three.js
      if (id.includes('node_modules/three')) {
        return null;
      }
      
      // Only process GLSL files and JS files that might contain shader code
      const isShaderFile = /\.(glsl|vert|frag)$/.test(id);
      const mightContainShaders = id.includes('shader') || 
                                 id.toLowerCase().includes('material') ||
                                 code.includes('glsl') || 
                                 code.includes('shader');
      
      if (!isShaderFile && !mightContainShaders) {
        return null;
      }

      console.log('Processing potential shader code in:', id);
      
      // For dedicated GLSL files, properly export as strings
      if (isShaderFile) {
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null
        };
      }

      // For JavaScript files that may contain GLSL code
      try {
        let processedCode = code;

        // Fix template literals with glsl or shader tags
        processedCode = processedCode
          .replace(/(glsl|shader)`([\s\S]*?)`/g, function(match, type, content) {
            // Process the content to escape any template expressions
            const escapedContent = content
              .replace(/\${/g, '\\${');  // Escape template expressions
            
            // Return the processed template literal
            return `\`${escapedContent}\``;
          });

        return {
          code: processedCode,
          map: null
        };
      } catch (error) {
        console.error('Error processing shader code in file:', id);
        console.error(error);
        
        // Even on error, return the original code
        return {
          code: code,
          map: null
        };
      }
    }
  };
};