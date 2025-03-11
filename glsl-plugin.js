// GLSL shader handling plugin for Vite
// This ensures that GLSL shaders are properly processed during bundling

module.exports = function glslPlugin() {
  return {
    name: 'vite-plugin-glsl',
    // Custom transform hook to process GLSL shader code
    transform(code, id) {
      // Only process GLSL-related files
      if (!/\.(glsl|vert|frag)$/.test(id) && 
          !id.includes('shader') && 
          !code.includes('glsl`') && 
          !code.includes('shader`') && 
          !code.includes('vec2') &&
          !code.includes('vec3') &&
          !code.includes('vec4')) {
        return null;
      }

      console.log('Processing GLSL in file:', id);
      
      // For actual GLSL files, just export the content
      if (/\.(glsl|vert|frag)$/.test(id)) {
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null
        };
      }

      // For JavaScript files that may contain GLSL code
      try {
        // Handle template literals with GLSL code by wrapping properly
        const processedCode = code
          // Make sure we don't interfere with template literals
          .replace(/glsl`([\s\S]*?)`/g, (_, content) => {
            return `\`${content}\``;
          })
          .replace(/shader`([\s\S]*?)`/g, (_, content) => {
            return `\`${content}\``;
          });

        return {
          code: processedCode,
          map: null
        };
      } catch (error) {
        console.error('Error processing GLSL in file:', id);
        console.error(error);
        return null;
      }
    }
  };
};