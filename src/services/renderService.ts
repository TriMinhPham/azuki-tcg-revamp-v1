/**
 * Render Service - Manages 3D rendering operations
 * Centralizes rendering logic and provides a clean interface
 */
import * as THREE from 'three';
import { loadTexture, purgeUnusedTextures } from '@/utils/textureLoader';
import { memoryManager, disposeMesh } from '@/utils/memoryManager';
import { createProxyUrl, isMidjourneyUrl } from '@/utils/imageHelper';

// Constants for rendering
const DEFAULT_ANISOTROPY = 4;

/**
 * Load a texture with proper error handling and optimization
 * @param url Texture URL
 * @param options Texture loading options
 */
export async function loadOptimizedTexture(
  url: string,
  options: {
    anisotropy?: number;
    priority?: 'high' | 'normal' | 'low';
    withPlaceholder?: boolean;
    placeholderUrl?: string;
  } = {}
): Promise<THREE.Texture | null> {
  if (!url) {
    console.warn('Empty texture URL provided');
    if (options.withPlaceholder && options.placeholderUrl) {
      return loadTexture(options.placeholderUrl, {
        anisotropy: options.anisotropy || DEFAULT_ANISOTROPY,
        priority: options.priority || 'high'
      });
    }
    return null;
  }
  
  // Process Midjourney URLs specially
  const finalUrl = isMidjourneyUrl(url) 
    ? `/api/proxy-image?url=${encodeURIComponent(url)}&midjourney=true&timestamp=${Date.now()}&quality=high`
    : createProxyUrl(url);
  
  try {
    const texture = await loadTexture(finalUrl, {
      anisotropy: options.anisotropy || DEFAULT_ANISOTROPY,
      priority: options.priority || 'normal'
    });
    
    return texture;
  } catch (error) {
    console.error(`Error loading texture from ${url}:`, error);
    
    // Try with proxy URL as fallback
    if (!finalUrl.includes('/api/proxy-image')) {
      try {
        console.debug('Trying with proxy URL as fallback');
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}&timestamp=${Date.now()}&quality=high`;
        
        const texture = await loadTexture(proxyUrl, {
          anisotropy: options.anisotropy || DEFAULT_ANISOTROPY,
          priority: options.priority || 'normal'
        });
        
        return texture;
      } catch (proxyError) {
        console.error('Failed with proxy URL too:', proxyError);
      }
    }
    
    // Use placeholder if requested
    if (options.withPlaceholder && options.placeholderUrl) {
      try {
        return await loadTexture(options.placeholderUrl, {
          anisotropy: options.anisotropy || DEFAULT_ANISOTROPY,
          priority: options.priority || 'high'
        });
      } catch (placeholderError) {
        console.error('Failed to load placeholder texture:', placeholderError);
      }
    }
    
    return null;
  }
}

/**
 * Create a material with standard settings
 * @param options Material options
 */
export function createStandardMaterial(options: {
  map?: THREE.Texture | null;
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
} = {}): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: options.map || undefined,
    color: options.color !== undefined ? options.color : 0xffffff,
    roughness: options.roughness !== undefined ? options.roughness : 0.5,
    metalness: options.metalness !== undefined ? options.metalness : 0.1,
    envMapIntensity: options.envMapIntensity !== undefined ? options.envMapIntensity : 1.0,
    transparent: options.transparent !== undefined ? options.transparent : false,
    opacity: options.opacity !== undefined ? options.opacity : 1.0,
    side: options.side || THREE.FrontSide
  });
  
  // Register with memory manager
  memoryManager.trackMaterial(material);
  
  return material;
}

/**
 * Create a shader material for holographic effects
 * @param options Shader options including textures and colors
 */
export function createHolographicMaterial(options: {
  holoTexture?: THREE.Texture | null;
  rainbowTexture?: THREE.Texture | null;
  baseColor?: THREE.Color;
  holoIntensity?: number;
} = {}): THREE.ShaderMaterial {
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec3 vNormal;
    
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  
  const fragmentShader = `
    uniform float time;
    uniform sampler2D holoTexture;
    uniform sampler2D rainbowTexture;
    uniform vec3 baseColor;
    uniform float holoIntensity;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec3 vNormal;
    
    // Function to create rainbow color based on position and time
    vec3 rainbowColor(float t) {
      vec3 color = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
      return color;
    }
    
    void main() {
      // Sample the holographic texture with moving coordinates
      vec2 holoUv = vUv;
      holoUv.x += sin(vUv.y * 10.0 + time * 0.5) * 0.02;
      holoUv.y += cos(vUv.x * 10.0 + time * 0.3) * 0.02;
      vec4 holoColor = texture2D(holoTexture, holoUv);
      
      // Sample the rainbow texture with different movement
      vec2 rainbowUv = vUv;
      rainbowUv.x += sin(time * 0.2) * 0.1;
      rainbowUv.y += cos(time * 0.1) * 0.1;
      vec4 rainbowColor = texture2D(rainbowTexture, rainbowUv);
      
      // Calculate view-dependent effect (more visible at glancing angles)
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
      
      // Calculate dynamic rainbow based on position and time
      float rainbowT = vPosition.x * 0.2 + vPosition.y * 0.1 + time * 0.1;
      vec3 dynamicRainbow = rainbowColor(rainbowT);
      
      // Add movement to the effect based on position
      float movement = sin(vPosition.x * 5.0 + vPosition.y * 3.0 + time * 2.0) * 0.5 + 0.5;
      
      // Combine all effects: base color + holo pattern + rainbow + fresnel
      vec3 finalColor = mix(
        baseColor,
        holoColor.rgb * rainbowColor.rgb * dynamicRainbow,
        fresnel * holoIntensity * movement
      );
      
      // Add extra rainbow lines at strong angles
      finalColor += dynamicRainbow * fresnel * fresnel * 0.3 * movement;
      
      gl_FragColor = vec4(finalColor, 0.7 + fresnel * 0.3);
    }
  `;
  
  // Default to blue base color if not specified
  const baseColor = options.baseColor || new THREE.Color("#4f81c7");
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      holoTexture: { value: options.holoTexture || null },
      rainbowTexture: { value: options.rainbowTexture || null },
      baseColor: { value: baseColor },
      holoIntensity: { value: options.holoIntensity || 1.0 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.FrontSide
  });
  
  // Register with memory manager
  memoryManager.track(material, 'material');
  
  return material;
}

/**
 * Update a holographic material's time uniform
 * @param material The shader material to update
 * @param time The current time value
 */
export function updateHolographicMaterial(
  material: THREE.ShaderMaterial | null,
  time: number
): void {
  if (!material || !material.uniforms) return;
  
  material.uniforms.time.value = time;
}

/**
 * Clean up rendering resources to free memory
 * @param meshes Meshes to clean up
 */
export function cleanupRenderResources(
  ...meshes: (THREE.Mesh | THREE.Group | null | undefined)[]
): void {
  // Dispose each mesh
  meshes.forEach(mesh => {
    if (mesh) {
      disposeMesh(mesh);
    }
  });
  
  // Clean unused textures
  purgeUnusedTextures(30000); // 30 seconds
}

/**
 * Get memory usage statistics for rendering
 */
export function getRenderingStats() {
  return memoryManager.getStats();
}