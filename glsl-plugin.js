// GLSL shader handling plugin for Vite - Enhanced version for Vercel deployment
// This ensures that GLSL shaders are properly processed during bundling

module.exports = function glslPlugin() {
  return {
    name: 'vite-plugin-glsl',
    
    // Process files during the build
    transform(code, id) {
      // Only process GLSL files and JS files that might contain shader code
      const isShaderFile = /\.(glsl|vert|frag)$/.test(id);
      const mightContainShaders = id.includes('shader') || 
                                 id.includes('three') || 
                                 id.toLowerCase().includes('material') ||
                                 code.includes('glsl') || 
                                 code.includes('shader') ||
                                 code.includes('vert') ||
                                 code.includes('frag');
      
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

        // First safely handle quoted GLSL code and prevent it from being treated as identifiers
        processedCode = processedCode
          // Replace standalone GLSL types with quoted strings to prevent syntax errors
          .replace(/\bvec2\b(?!\s*[\w\.])/g, '"vec2"')
          .replace(/\bvec3\b(?!\s*[\w\.])/g, '"vec3"')
          .replace(/\bvec4\b(?!\s*[\w\.])/g, '"vec4"')
          .replace(/\bmat2\b(?!\s*[\w\.])/g, '"mat2"')
          .replace(/\bmat3\b(?!\s*[\w\.])/g, '"mat3"')
          .replace(/\bmat4\b(?!\s*[\w\.])/g, '"mat4"')
          .replace(/\bsampler2D\b(?!\s*[\w\.])/g, '"sampler2D"')
          .replace(/\buniform\b(?!\s*[\w\.])/g, '"uniform"')
          .replace(/\bvarying\b(?!\s*[\w\.])/g, '"varying"')
          .replace(/\battribute\b(?!\s*[\w\.])/g, '"attribute"');
        
        // Fix template literals - ensure GLSL shader inside template literals is handled
        processedCode = processedCode
          .replace(/(glsl|shader)`([\s\S]*?)`/g, function(match, type, content) {
            // Process the content to escape any template expressions
            const escapedContent = content
              .replace(/\${/g, '\\${')  // Escape template expressions
              .replace(/\bvec2\b(?!\s*[\w\.])/g, "'vec2'")  // Quote GLSL keywords
              .replace(/\bvec3\b(?!\s*[\w\.])/g, "'vec3'")
              .replace(/\bvec4\b(?!\s*[\w\.])/g, "'vec4'")
              .replace(/\bmat4\b(?!\s*[\w\.])/g, "'mat4'")
              .replace(/\bsampler2D\b(?!\s*[\w\.])/g, "'sampler2D'");
            
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