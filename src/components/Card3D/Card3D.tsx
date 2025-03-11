import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useTexture, Box, Plane, useEnvironment } from '@react-three/drei';
import * as THREE from 'three';
import { CardData } from '@/types';
import { CardTextOverlay } from './CardTextOverlay';
import { PLACEHOLDER_IMAGES } from '@/config/constants';
import { 
  loadOptimizedTexture, 
  createStandardMaterial,
  createHolographicMaterial,
  updateHolographicMaterial,
  cleanupRenderResources 
} from '@/services/renderService';
import { createProxyUrl, isMidjourneyUrl } from '@/utils/imageHelper';

// Create TextureLoader with loading manager for all textures
const textureLoadingManager = new THREE.LoadingManager();

// Local textures for card effects
const PLACEHOLDER_NORMAL = '/cardback.jpg'; // Using the cardback from public folder
const PLACEHOLDER_FULL = '/cardback.jpg';
const CARD_NORMAL_MAP = '/textures/normal_map.jpg';
const CARD_ROUGHNESS_MAP = '/textures/roughness_map.jpg';

// Helper function to create background color based on card type
const getTypeColor = (typeIcon: string): string => {
  switch (typeIcon) {
    case '🔥':
      return '#ffcdd2'; // Fire - light red
    case '💧':
      return '#bbdefb'; // Water - light blue
    case '⚡':
      return '#fff9c4'; // Lightning - light yellow
    case '🪨':
      return '#d7ccc8'; // Earth - light brown
    case '🫘':
    default:
      return '#e8eaf6'; // Default - light purple/blue
  }
};

interface Card3DProps {
  cardData: CardData;
  isFullArt: boolean;
  isLoading: boolean;
  onImageLoadStart?: () => void;
  onImageLoadComplete?: () => void;
  onImageLoadError?: (error: Error) => void;
  showNormalMap?: boolean;
  showRoughnessMap?: boolean;
  showHoloFoil?: boolean;
  showEdgeHighlight?: boolean;
  showParticles?: boolean;
}

export const Card3D = ({
  cardData,
  isFullArt,
  isLoading,
  onImageLoadStart,
  onImageLoadComplete,
  onImageLoadError,
  showNormalMap = true,
  showRoughnessMap = true,
  showHoloFoil = true,
  showEdgeHighlight = true,
  showParticles = true
}: Card3DProps) => {
  // Get the renderer for setting pixelRatio
  const { gl } = useThree();
  
  // Use a simple environment map for reflections
  const envMap = useEnvironment({ preset: 'city' }); // City preset is more reliable
  
  // Texture states with refs to prevent memory leaks
  const [normalTextureLoaded, setNormalTextureLoaded] = useState(false);
  const [fullArtTextureLoaded, setFullArtTextureLoaded] = useState(false);
  
  // Texture references for cleanup and reuse
  const normalTextureRef = useRef<THREE.Texture | null>(null);
  const fullArtTextureRef = useRef<THREE.Texture | null>(null);
  const backTextureRef = useRef<THREE.Texture | null>(null);
  const normalMapRef = useRef<THREE.Texture | null>(null);
  const roughnessMapRef = useRef<THREE.Texture | null>(null);
  
  // Create texture URLs with proper handling for different image sources
  const normalImageUrl = useMemo(() => {
    return createProxyUrl(cardData.normalImageUrl);
  }, [cardData.normalImageUrl]);
  
  const fullArtImageUrl = useMemo(() => {
    if (!cardData.fullArtImageUrl) return null;
    
    const isMJ = isMidjourneyUrl(cardData.fullArtImageUrl);
    
    // For Midjourney URLs, we'll load thumbnails and high-quality versions separately,
    // so just return the direct URL here for flexibility
    return createProxyUrl(
      cardData.fullArtImageUrl,
      isMJ,
      { quality: 'high' }
    );
  }, [cardData.fullArtImageUrl]);

  // Card dimensions with improved proportions
  const cardWidth = 2.5;
  const cardHeight = 3.5;
  const cardThickness = 0.04; // Increased thickness for better edge visibility and 3D feel

  // Reference to maintain card 3D model between mode switches
  const meshRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  
  // Set maximum anisotropy for all textures based on GPU capabilities
  useEffect(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    textureLoadingManager.onLoad = () => {
      console.debug('All textures loaded successfully');
    };
    console.debug(`Max anisotropy: ${maxAnisotropy}`);
  }, [gl]);
  
  // Load shared material maps (normal, roughness) and card back
  useEffect(() => {
    // Load normal map for embossed card effect
    loadOptimizedTexture(CARD_NORMAL_MAP, {
      anisotropy: 8,
      priority: 'high',
      withPlaceholder: true
    }).then(texture => {
      if (texture) {
        texture.repeat.set(1, 1);
        normalMapRef.current = texture;
      }
    });
    
    // Load roughness map for realistic surface
    loadOptimizedTexture(CARD_ROUGHNESS_MAP, {
      anisotropy: 8,
      priority: 'high',
      withPlaceholder: true
    }).then(texture => {
      if (texture) {
        texture.repeat.set(1, 1);
        roughnessMapRef.current = texture;
      }
    });
    
    // Load card back texture (most reliable)
    loadOptimizedTexture(PLACEHOLDER_NORMAL, {
      anisotropy: 16,
      priority: 'high'
    }).then(texture => {
      if (texture) {
        backTextureRef.current = texture;
      }
    });
    
    // Cleanup function when component unmounts
    return () => {
      cleanupRenderResources(meshRef.current || undefined);
      
      // Clear texture references
      [normalMapRef, roughnessMapRef, backTextureRef, normalTextureRef, fullArtTextureRef].forEach(ref => {
        if (ref.current) {
          ref.current = null;
        }
      });
    };
  }, []);
  
  // Load card textures with optimal settings
  useEffect(() => {
    // Notify loading started if callback provided
    if (onImageLoadStart) onImageLoadStart();
    
    // Load normal card texture
    console.debug('Loading normal texture:', normalImageUrl);
    
    // Load the normal card texture with fallback handling built into the service
    loadOptimizedTexture(normalImageUrl, {
      anisotropy: 16,
      priority: 'high',
      withPlaceholder: true,
      placeholderUrl: PLACEHOLDER_NORMAL
    }).then(texture => {
      if (texture) {
        console.debug('Normal texture loaded successfully');
        normalTextureRef.current = texture;
        setNormalTextureLoaded(true);
        if (onImageLoadComplete) onImageLoadComplete();
      }
    }).catch(error => {
      console.error('All normal texture loading methods failed:', error);
      if (onImageLoadError) onImageLoadError(new Error('Failed to load card image'));
    });
    
    // Load full art texture if available
    if (fullArtImageUrl) {
      console.debug('Loading full art texture:', fullArtImageUrl);
      
      // Use a small delay for loading full art to prioritize normal texture
      setTimeout(() => {
        loadOptimizedTexture(fullArtImageUrl, {
          anisotropy: 16,
          priority: 'normal',
          withPlaceholder: true,
          placeholderUrl: PLACEHOLDER_FULL
        }).then(texture => {
          if (texture) {
            console.debug('Full art texture loaded successfully');
            fullArtTextureRef.current = texture;
            setFullArtTextureLoaded(true);
          }
        }).catch(error => {
          console.error('All full art texture loading methods failed:', error);
          if (onImageLoadError) onImageLoadError(new Error('Failed to load full art image'));
        });
      }, 500); // Small delay to load normal texture first
    } 
    // Don't load placeholder for full art when there's no URL provided
    // When switching to full art mode without fullArtImageUrl, we'll use the normal image as fallback
    
    // Return cleanup function
    return () => {
      // Just null the references - actual disposal is handled by the memory manager
    };
  }, [normalImageUrl, fullArtImageUrl, onImageLoadComplete, onImageLoadError, onImageLoadStart]);

  // Create holographic effect for full-art and rare cards
  const [shaderMaterial, setShaderMaterial] = useState<THREE.ShaderMaterial | null>(null);
  
  // Initialize holographic shader for premium cards using the render service
  useEffect(() => {
    if (!isFullArt) return;
    
    // Get card type color for holographic effect
    const baseColor = new THREE.Color(cardData.cardColor || "#ff5722");
    
    // Calculate intensity based on card rarity
    const holoIntensity = cardData.rarity.length / 5; // 0.2 for ★, 0.4 for ★★, etc.
    
    // Create holographic material using our service
    const material = createHolographicMaterial({
      baseColor,
      holoIntensity
    });
    
    setShaderMaterial(material);
    
    return () => {
      if (material) {
        material.dispose();
      }
    };
  }, [isFullArt, cardData.rarity, cardData.cardColor]);
  
  // Update shader uniforms each frame
  useFrame(({ clock }) => {
    // Update holographic material time
    updateHolographicMaterial(shaderMaterial, clock.getElapsedTime());
    
    // Update holographic textures if available
    if (shaderMaterial && shaderMaterial.uniforms) {
      // Update base texture
      if (isFullArt && fullArtTextureRef.current && 
          shaderMaterial.uniforms.baseTexture && 
          shaderMaterial.uniforms.baseTexture.value !== fullArtTextureRef.current) {
        shaderMaterial.uniforms.baseTexture.value = fullArtTextureRef.current;
      }
      
      // Update holo texture if it's not set
      if (shaderMaterial.uniforms.holoTexture && 
          !shaderMaterial.uniforms.holoTexture.value) {
        // Load holo texture if needed
        loadOptimizedTexture('/textures/foil_pattern.jpg', {
          priority: 'low'
        }).then(texture => {
          if (texture && shaderMaterial && shaderMaterial.uniforms.holoTexture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(3, 3);
            shaderMaterial.uniforms.holoTexture.value = texture;
          }
        });
      }
      
      // Update rainbow texture if it's not set
      if (shaderMaterial.uniforms.rainbowTexture && 
          !shaderMaterial.uniforms.rainbowTexture.value) {
        // Load rainbow texture if needed
        loadOptimizedTexture('/textures/border_pattern.jpg', {
          priority: 'low'
        }).then(texture => {
          if (texture && shaderMaterial && shaderMaterial.uniforms.rainbowTexture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            shaderMaterial.uniforms.rainbowTexture.value = texture;
          }
        });
      }
    }
  });
  
  // Pre-create and cache materials to avoid recreation during switching
  const materialsRef = useRef<THREE.Material[]>([]);
  
  // Prepare materials using the render service
  const materials = useMemo(() => {
    // Check if we have textures available
    const hasNormalTexture = normalTextureRef.current !== null;
    const hasFullArtTexture = fullArtTextureRef.current !== null;
    
    // Get the correct texture based on mode
    const cardTexture = isFullArt && hasFullArtTexture ? 
                        fullArtTextureRef.current : 
                        (hasNormalTexture ? normalTextureRef.current : null);
    
    // Create front material
    const frontMaterial = createStandardMaterial({
      map: cardTexture || undefined,
      color: cardTexture ? 0xffffff : getTypeColor(cardData.type),
      roughness: 0.5,
      metalness: 0.1,
      envMapIntensity: 0.3,
      side: THREE.FrontSide
    });
    
    // Create back material
    const backMaterial = createStandardMaterial({
      color: 0x774936, // Brown cardback
      roughness: 0.5,
      metalness: 0.1,
      envMapIntensity: 0.3,
      side: THREE.FrontSide
    });
    
    // Create edge material
    const edgeColor = isFullArt ? 0xD4AF37 : 0xF5D76E; // Gold or yellow
    const edgeMaterial = createStandardMaterial({
      color: edgeColor,
      roughness: 0.4,
      metalness: 0.2,
      envMapIntensity: 0.3,
      side: THREE.FrontSide
    });
    
    // Create the materials array (order: right, left, top, bottom, front, back)
    const newMaterials = [
      edgeMaterial, // right edge
      edgeMaterial, // left edge
      edgeMaterial, // top edge
      edgeMaterial, // bottom edge
      frontMaterial, // front face
      backMaterial, // back face
    ];
    
    // Store for reuse
    materialsRef.current = newMaterials;
    
    return newMaterials;
  }, [isFullArt, normalTextureRef.current, fullArtTextureRef.current, cardData.type]);

  // Enhanced particle system for premium holographic effect
  const particles = useMemo(() => {
    if (!isFullArt) return null;
    
    // Create enhanced particles for premium full art cards
    const particleCount = 350; // Increased count for better visual density
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount); // New: individual speed per particle
    const offsets = new Float32Array(particleCount); // New: animation offset for more natural movement
    
    // Create a more sophisticated distribution of particles based on card type
    const typeColorStr = getTypeColor(cardData.type);
    // Extract base color from type for particle color variation
    const baseR = parseInt(typeColorStr.substr(1, 2), 16) / 255;
    const baseG = parseInt(typeColorStr.substr(3, 2), 16) / 255;
    const baseB = parseInt(typeColorStr.substr(5, 2), 16) / 255;
    
    // Generate particles with improved distribution and properties
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // More sophisticated particle distribution
      // Use different patterns for different areas of the card
      let x, y, z;
      
      // 70% of particles follow card edges for enhanced border effect
      if (i < particleCount * 0.7) {
        // Edge particles - distribute along the borders
        const edgeRand = Math.random();
        
        if (edgeRand < 0.25) {
          // Top edge
          x = (Math.random() - 0.5) * cardWidth * 0.95;
          y = cardHeight * 0.47; // Top edge
          z = 0.02 + Math.random() * 0.08; // Varied depth
        } else if (edgeRand < 0.5) {
          // Bottom edge
          x = (Math.random() - 0.5) * cardWidth * 0.95;
          y = -cardHeight * 0.47; // Bottom edge
          z = 0.02 + Math.random() * 0.08;
        } else if (edgeRand < 0.75) {
          // Left edge
          x = -cardWidth * 0.47; // Left edge
          y = (Math.random() - 0.5) * cardHeight * 0.95;
          z = 0.02 + Math.random() * 0.08;
        } else {
          // Right edge
          x = cardWidth * 0.47; // Right edge
          y = (Math.random() - 0.5) * cardHeight * 0.95;
          z = 0.02 + Math.random() * 0.08;
        }
      } 
      // 20% of particles form a glowing outline around the card art area
      else if (i < particleCount * 0.9) {
        // Art area outline (center rectangle)
        const angle = Math.random() * Math.PI * 2;
        const artWidth = cardWidth * 0.6;
        const artHeight = cardHeight * 0.4;
        
        // Position on the art rectangle
        if (Math.random() < 0.5) {
          // Horizontal edges of the art
          x = (Math.random() - 0.5) * artWidth;
          y = (Math.random() < 0.5 ? 0.5 : -0.5) * artHeight;
        } else {
          // Vertical edges of the art
          x = (Math.random() < 0.5 ? 0.5 : -0.5) * artWidth;
          y = (Math.random() - 0.5) * artHeight;
        }
        
        z = 0.05 + Math.random() * 0.1; // Slightly higher than edge particles
      }
      // 10% of particles are freely floating for sparkle effect
      else {
        // Random particles for general sparkle
        x = (Math.random() - 0.5) * cardWidth * 0.9;
        y = (Math.random() - 0.5) * cardHeight * 0.9;
        z = 0.05 + Math.random() * 0.15; // More varied depths
      }
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      
      // Color - enhanced holographic effect with card type influence
      // Base color determined by card type with more variation
      let hue, saturation, lightness;
      
      if (Math.random() < 0.3) {
        // 30% of particles use type-based color for cohesion
        const hslObject = { h: 0, s: 0, l: 0 };
        const typeHue = new THREE.Color(baseR, baseG, baseB).getHSL(hslObject);
        hue = typeHue.h + (Math.random() * 0.1 - 0.05); // Slight variation
        saturation = 0.8 + Math.random() * 0.2; // High saturation
        lightness = 0.5 + Math.random() * 0.3; // Brighter
      } else {
        // 70% use full rainbow spectrum for holographic effect
        hue = Math.random();
        saturation = 0.7 + Math.random() * 0.3; // High saturation
        lightness = 0.4 + Math.random() * 0.4; // Wider range of brightness
      }
      
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      
      // Size - more varied with larger max size
      sizes[i] = Math.random() * 0.04 + 0.01;
      
      // Animation speeds and offsets for more natural movement
      speeds[i] = 0.5 + Math.random() * 1.5; // Random speed multiplier
      offsets[i] = Math.random() * Math.PI * 2; // Random phase offset
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    particleGeometry.setAttribute('offset', new THREE.BufferAttribute(offsets, 1));
    
    // Enhanced particle shader material with better glow
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pointTexture: { value: new THREE.TextureLoader().load('/textures/particle.png') },
        cardType: { value: new THREE.Color(baseR, baseG, baseB) }
      },
      vertexShader: /* glsl */`
        attribute float size;
        attribute float speed;
        attribute float offset;
        varying vec3 vColor;
        uniform float time;
        uniform vec3 cardType;
        
        // Improved noise function for more organic movement
        float noise(vec2 p) {
          return sin(p.x * 10.0) * sin(p.y * 10.0) * 0.5 + 0.5;
        }
        
        void main() {
          vColor = color;
          
          // More complex and organic animation
          vec3 pos = position;
          
          // Primary wave motion with individual speed and offset
          float adjustedTime = time * speed + offset;
          
          // Horizontal wave based on position and time
          pos.x += sin(adjustedTime + position.y * 4.0) * 0.03;
          
          // Vertical wave based on position and time with phase shift
          pos.y += cos(adjustedTime * 0.8 + position.x * 5.0) * 0.03;
          
          // Depth oscillation for parallax effect
          pos.z += sin(adjustedTime * 0.6) * 0.01;
          
          // Secondary micro-motion for sparkle effect
          float noise1 = noise(vec2(position.x * 100.0 + time, position.y * 100.0));
          float noise2 = noise(vec2(position.y * 100.0 + time, position.x * 100.0));
          
          pos.x += noise1 * 0.005;
          pos.y += noise2 * 0.005;
          
          // Dynamic size animation - more organic breathing effect
          float breathe = sin(adjustedTime * 1.5) * 0.5 + 0.5;
          float sizeFactor = 0.7 + breathe * 0.6;
          
          // Proximity effect: particles get bigger when closer to camera
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float distance = -mvPosition.z;
          
          // Combine size factors with base size and apply distance scaling
          float finalSize = size * sizeFactor * (300.0 / distance);
          
          gl_PointSize = finalSize;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D pointTexture;
        uniform float time;
        uniform vec3 cardType;
        varying vec3 vColor;
        
        void main() {
          // Improved texture sampling with sharper center
          vec4 texColor = texture2D(pointTexture, gl_PointCoord);
          
          // Enhanced glow effect
          vec3 finalColor = vColor;
          
          // Pulsating brightness for subtle shimmer
          float brightness = 0.8 + 0.2 * sin(time * 3.0 + vColor.r * 10.0);
          finalColor *= brightness;
          
          // Add slight color shifting over time for rainbow effect
          float hueShift = sin(time * 0.2) * 0.1;
          float r = finalColor.r;
          finalColor.r = mix(finalColor.r, finalColor.g, hueShift);
          finalColor.g = mix(finalColor.g, finalColor.b, hueShift);
          finalColor.b = mix(finalColor.b, r, hueShift);
          
          // Mix with card type color for cohesion
          finalColor = mix(finalColor, cardType, 0.1);
          
          // Apply alpha from texture
          gl_FragColor = vec4(finalColor, texColor.a);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      vertexColors: true
    });
    
    return { geometry: particleGeometry, material: particleMaterial };
  }, [isFullArt, cardWidth, cardHeight, cardData.type]);
  
  // Update particle animation
  useFrame(({ clock }) => {
    if (particles && particles.material.uniforms && particlesRef.current) {
      particles.material.uniforms.time.value = clock.getElapsedTime();
    }
  });

  // Advanced animation using useFrame with smooth transitions and interactive mode
  useFrame((state) => {
    if (!meshRef.current || isLoading) return;
    
    // Calculate elapsed time for animations
    const t = state.clock.elapsedTime;
    
    // Get the mesh and set default values if needed
    const mesh = meshRef.current;
    mesh.userData.targetRotationY = mesh.userData.targetRotationY !== undefined ? mesh.userData.targetRotationY : 0;
    mesh.userData.targetRotationX = mesh.userData.targetRotationX !== undefined ? mesh.userData.targetRotationX : 0;
    mesh.userData.isInteractive = mesh.userData.isInteractive !== undefined ? mesh.userData.isInteractive : false;
    
    // Enhanced hovering animation with multi-axis movement (only when not in interactive mode)
    if (!mesh.userData.isInteractive) {
      mesh.position.y = Math.sin(t * 0.5) * 0.03; // Increased amplitude
      mesh.position.x = Math.sin(t * 0.3) * 0.015; // Increased amplitude
      
      // Apply natural idle animation for rotation too (less strong than user interaction)
      const idleRotationY = Math.sin(t * 0.4) * 0.05;
      const idleRotationX = Math.sin(t * 0.45) * 0.02;
      const idleRotationZ = Math.sin(t * 0.5) * 0.008;
      
      // Smooth transition for rotation
      mesh.rotation.y += (idleRotationY - mesh.rotation.y) * 0.05;
      mesh.rotation.x += (idleRotationX - mesh.rotation.x) * 0.05;
      mesh.rotation.z += (idleRotationZ - mesh.rotation.z) * 0.05;
    } else {
      // In interactive mode, smoothly interpolate to target rotation (mouse controlled)
      mesh.rotation.y += (mesh.userData.targetRotationY - mesh.rotation.y) * 0.1;
      mesh.rotation.x += (mesh.userData.targetRotationX - mesh.rotation.x) * 0.1;
      
      // Maintain slight z-axis rotation for visual interest
      mesh.rotation.z = Math.sin(t * 0.5) * 0.005;
    }
    
    // Update particle system with improved effects
    if (particlesRef.current) {
      const particles = particlesRef.current;
      
      // Copy base position from card
      particles.position.copy(mesh.position);
      
      // Add breathing effect to particles with z-offset
      particles.position.z += Math.sin(t * 0.7) * 0.01 + 0.01;
      
      // Copy rotation with slight offset for depth effect
      if (particles.userData.isInteractive) {
        particles.rotation.y += (particles.userData.targetRotationY - particles.rotation.y) * 0.12; // Slightly faster than card
        particles.rotation.x += (particles.userData.targetRotationX - particles.rotation.x) * 0.12;
      } else {
        particles.rotation.copy(mesh.rotation);
      }
    }
  });

  // Enhanced mouse interaction (tilt effect with smooth transitions)
  const handlePointerMove = (e: THREE.Event) => {
    if (!meshRef.current || isLoading) return;

    // Calculate normalized pointer position
    const x = (e.point.x / 5) * 2;
    const y = (e.point.y / 5) * 2;

    // Apply rotation with improved limits for better interaction
    const maxRotation = 0.25; // About 14 degrees - more dynamic for better 3D effect
    const targetRotationY = x * maxRotation;
    const targetRotationX = y * maxRotation;
    
    // Use GSAP-like smooth interpolation (implemented manually)
    meshRef.current.userData.targetRotationY = targetRotationY;
    meshRef.current.userData.targetRotationX = targetRotationX;
    
    // Flag that we're in interactive mode
    meshRef.current.userData.isInteractive = true;
    
    // If we have particles, store targets there too
    if (particlesRef.current) {
      particlesRef.current.userData.targetRotationY = targetRotationY;
      particlesRef.current.userData.targetRotationX = targetRotationX;
      particlesRef.current.userData.isInteractive = true;
    }
  };

  // Reset rotation when pointer leaves with smooth transition
  const handlePointerLeave = () => {
    if (!meshRef.current || isLoading) return;
    
    // Reset target to neutral but don't immediately snap
    meshRef.current.userData.targetRotationY = 0;
    meshRef.current.userData.targetRotationX = 0;
    meshRef.current.userData.isInteractive = false;
    
    // Reset particles if they exist
    if (particlesRef.current) {
      particlesRef.current.userData.targetRotationY = 0;
      particlesRef.current.userData.targetRotationX = 0;
      particlesRef.current.userData.isInteractive = false;
    }
  };

  // Create and cache the geometry to avoid recreation
  const cardGeometryRef = useRef<THREE.BoxGeometry | null>(null);
  if (!cardGeometryRef.current) {
    // Create a simpler geometry with fewer segments to ensure reliable rendering
    cardGeometryRef.current = new THREE.BoxGeometry(
      cardWidth, cardHeight, cardThickness, 
      2, 2, 2 // Simplified for more reliable rendering
    );
  }

  // Use a memo to prevent CardTextOverlay from being recreated unnecessarily
  const cardTextOverlay = useMemo(() => {
    if (!normalTextureLoaded) return null;
    return <CardTextOverlay cardData={cardData} isFullArt={isFullArt} />;
  }, [cardData, isFullArt, normalTextureLoaded]);

  return (
    <>
      {/* Super simplified lighting for better reliability */}
      <ambientLight intensity={0.8} color="#ffffff" />
      
      {/* Single directional light for basic shading */}
      <directionalLight 
        position={[5, 5, 5]}
        intensity={0.7}
        color="#ffffff"
      />
      
      {/* Main card mesh - simplified */}
      <mesh
        ref={meshRef}
        geometry={cardGeometryRef.current}
        material={materials}
        visible={!isLoading}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Add card text overlay - only recreated when necessary */}
        {cardTextOverlay}
        
        {/* Loading indicators - use separate indicators for normal and full art modes */}
        {isLoading && (
          <Text
            position={[0, 0, 0.1]}
            fontSize={0.2}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Loading...
          </Text>
        )}
        
        {/* Show loading indicator for full art mode */}
        {!isLoading && isFullArt && !fullArtTextureLoaded && fullArtImageUrl && (
          <Text
            position={[0, 0, 0.1]}
            fontSize={0.15}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
            renderOrder={100}
          >
            Loading Full Art...
          </Text>
        )}
        
        {/* Show loading indicator for normal card mode */}
        {!isLoading && !isFullArt && !normalTextureLoaded && (
          <Text
            position={[0, 0, 0.1]}
            fontSize={0.15}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
            renderOrder={100}
          >
            Loading Card Image...
          </Text>
        )}
      </mesh>
    </>
  );
};