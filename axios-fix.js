/**
 * This is a targeted fix for the axios isFormData syntax error.
 * It will be included in the build to ensure the error is fixed at runtime.
 */

module.exports = function generateAxiosFix() {
  // Create a simplified patching script that handles the issue specifically
  return `
<!-- Axios FormData Fix Script -->
<script>
  (function() {
    // Patch the problematic axios.isFormData function
    function patchAxios() {
      try {
        // The fixed implementation
        function safeIsFormData(thing) {
          return Boolean(
            thing && 
            (
              (typeof FormData !== 'undefined' && thing instanceof FormData) || 
              (typeof thing === 'object' && 
               typeof thing.toString === 'function' && 
               thing.toString() === '[object FormData]')
            )
          );
        }

        // Direct patcher function
        function applyPatch() {
          // Find axios in global scope
          if (window.axios && typeof window.axios === 'object') {
            if (typeof window.axios.isFormData === 'function') {
              window.axios.isFormData = safeIsFormData;
            }
            if (window.axios.utils && typeof window.axios.utils.isFormData === 'function') {
              window.axios.utils.isFormData = safeIsFormData;
            }
          }
          
          // Also look for other potential instances
          Object.keys(window).forEach(function(key) {
            try {
              const obj = window[key];
              if (obj && typeof obj === 'object') {
                if (obj.isFormData && typeof obj.isFormData === 'function' && 
                    obj.isFormData.toString().includes('kind')) {
                  obj.isFormData = safeIsFormData;
                }
                if (obj.utils && obj.utils.isFormData && 
                    typeof obj.utils.isFormData === 'function' && 
                    obj.utils.isFormData.toString().includes('kind')) {
                  obj.utils.isFormData = safeIsFormData;
                }
              }
            } catch (e) {
              // Ignore inaccessible properties
            }
          });
        }

        // Run patch immediately
        applyPatch();
        
        // Setup recurring check until axios is found
        const interval = setInterval(applyPatch, 50);
        setTimeout(function() { clearInterval(interval); }, 5000);

        // Fix for on-demand loading via import
        const originalImport = window.import;
        if (typeof originalImport === 'function') {
          window.import = function() {
            return originalImport.apply(this, arguments)
              .then(function(module) {
                setTimeout(applyPatch, 0);
                return module;
              });
          };
        }
        
        // Error handler as a fallback
        window.addEventListener('error', function(event) {
          if (event && event.error && event.error.message && 
              event.error.message.includes('Unexpected token')) {
            console.error('Caught syntax error, applying axios patch', event.error);
            applyPatch();
          }
        });
      } catch (e) {
        console.error('Error in axios patch:', e);
      }
    }

    // Run immediately
    patchAxios();
  })();
</script>
  `;
};