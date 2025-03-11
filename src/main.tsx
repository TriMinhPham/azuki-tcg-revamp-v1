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
  }
}
window.THREE = THREE;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)