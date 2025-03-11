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
// This overwrites the problematic function before the app starts
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

  // Add script element to fix axios at runtime
  const script = document.createElement('script');
  script.textContent = `
    // Find and fix the problematic isFormData function
    (function() {
      try {
        // This script runs in browser context to access global objects and fix the axios issue
        setTimeout(function() {
          // Find all global objects that match axios pattern
          Object.keys(window).forEach(function(key) {
            try {
              // Skip certain objects
              if (key === 'window' || key === 'document') return;
              
              var obj = window[key];
              // Check if this might be axios or has axios within it
              if (obj && typeof obj === 'object') {
                // Fix direct exports
                if (typeof obj.isFormData === 'function' && 
                    obj.isFormData.toString().includes('kind === "object"')) {
                  console.log('Fixed axios isFormData in window.' + key);
                  obj.isFormData = ${fixedIsFormData.toString()};
                }
                
                // Fix utils/helpers
                if (obj.utils && typeof obj.utils.isFormData === 'function' &&
                    obj.utils.isFormData.toString().includes('kind === "object"')) {
                  console.log('Fixed axios utils.isFormData in window.' + key);
                  obj.utils.isFormData = ${fixedIsFormData.toString()};
                }
              }
            } catch(e) {
              // Ignore errors from accessing some properties
            }
          });
        }, 0);
      } catch(e) {
        console.error('Error in fixAxios script:', e);
      }
    })();
  `;
  document.head.appendChild(script);
};

// Run fix immediately
window.fixAxiosFormData();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)