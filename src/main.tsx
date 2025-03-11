import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Import Three.js to ensure it's available for R3F
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

// Extend specific THREE components instead of the entire library
extend({
  DirectionalLight: THREE.DirectionalLight,
  PointLight: THREE.PointLight,
  SpotLight: THREE.SpotLight,
  AmbientLight: THREE.AmbientLight,
  Mesh: THREE.Mesh,
  Group: THREE.Group
});

// Make THREE available globally for debugging
declare global {
  interface Window {
    THREE: typeof THREE;
    fixAxiosFormData(): void;
  }
}
window.THREE = THREE;

// Fix the axios isFormData function that causes syntax error
// This is a more direct approach that modifies the core of axios
window.fixAxiosFormData = function() {
  // Define a fixed isFormData function to replace the problematic one
  const fixedIsFormData = function(thing: any) {
    return Boolean(
      thing && 
      (typeof FormData !== 'undefined' && thing instanceof FormData ||
        typeof thing === 'object' && 
        typeof thing.toString === 'function' && 
        thing.toString() === '[object FormData]')
    );
  };

  try {
    // 1. Direct approach - monkey patch axios module system
    // This will handle the issue at its root by patching the module system
    // Create a script that will execute in the global context
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        // Store the original define property method
        var originalDefineProperty = Object.defineProperty;
        
        // Override defineProperty to intercept axios module definition
        Object.defineProperty = function(obj, prop, descriptor) {
          // Check if this is the problematic axios isFormData function
          if (
            obj && 
            typeof obj === 'object' && 
            prop === 'isFormData' && 
            descriptor && 
            descriptor.value && 
            typeof descriptor.value === 'function' && 
            descriptor.value.toString().includes('kind ===')
          ) {
            console.log('Intercepted axios isFormData definition');
            
            // Replace with our fixed implementation
            descriptor.value = function(thing) {
              return Boolean(
                thing && 
                (typeof FormData !== 'undefined' && thing instanceof FormData ||
                  typeof thing === 'object' && 
                  typeof thing.toString === 'function' && 
                  thing.toString() === '[object FormData]')
              );
            };
          }
          
          return originalDefineProperty.call(this, obj, prop, descriptor);
        };
        
        console.log('Installed Object.defineProperty interceptor for axios');

        // 2. Also patch existing instances
        function patchExistingAxios() {
          try {
            // Look for axios in the global scope
            Object.keys(window).forEach(function(key) {
              try {
                if (key === 'window' || key === 'document') return;
                
                var obj = window[key];
                if (obj && typeof obj === 'object') {
                  // Check for axios signature
                  if (typeof obj.isFormData === 'function') {
                    console.log('Patched window.' + key + '.isFormData');
                    obj.isFormData = function(thing) {
                      return Boolean(
                        thing && 
                        (typeof FormData !== 'undefined' && thing instanceof FormData ||
                          typeof thing === 'object' && 
                          typeof thing.toString === 'function' && 
                          thing.toString() === '[object FormData]')
                      );
                    };
                  }
                  
                  if (obj.utils && typeof obj.utils.isFormData === 'function') {
                    console.log('Patched window.' + key + '.utils.isFormData');
                    obj.utils.isFormData = function(thing) {
                      return Boolean(
                        thing && 
                        (typeof FormData !== 'undefined' && thing instanceof FormData ||
                          typeof thing === 'object' && 
                          typeof thing.toString === 'function' && 
                          thing.toString() === '[object FormData]')
                      );
                    };
                  }
                }
              } catch(e) {
                // Ignore errors from inaccessible properties
              }
            });
          } catch(e) {
            console.error('Error patching existing axios:', e);
          }
        }

        // Run immediately and set up recurring checks
        patchExistingAxios();
        setInterval(patchExistingAxios, 500);
        setTimeout(function() { clearInterval(patchExistingAxios); }, 10000);
      })();
    `;
    
    // Add to head immediately
    document.head.appendChild(script);
    console.log('Installed axios patch script');
  } catch(e) {
    console.error('Error setting up axios patch:', e);
  }
};

// Run fix immediately
window.fixAxiosFormData();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)