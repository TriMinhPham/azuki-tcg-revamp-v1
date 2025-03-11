import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useTexture, Box, Plane, useEnvironment, Line } from '@react-three/drei';
import * as THREE from 'three';
import { CardData } from '@/types';
import { ThreeEvent } from '@/types/three-extended';
import { createProxyUrl, isMidjourneyUrl } from '@/utils/imageHelper';

// Loading spinner component
const LoadingSpinner = () => {
  const spinnerRef = useRef<THREE.Group>(null);
  
  // Create points for loading spinner circle
  const points = useMemo(() => {
    const circlePoints = [];
    const segments = 24;
    const radius = 0.15;
    
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      circlePoints.push(new THREE.Vector3(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius,
        0
      ));
    }
    
    return circlePoints;
  }, []);
  
  // Animate the loading spinner
  useFrame(({ clock }) => {
    if (spinnerRef.current) {
      // Rotate the spinner
      spinnerRef.current.rotation.z = -clock.getElapsedTime() * 2;
      
      // Pulse effect
      const pulse = Math.sin(clock.getElapsedTime() * 4) * 0.1 + 0.9;
      spinnerRef.current.scale.set(pulse, pulse, 1);
    }
  });
  
  return (
    <group ref={spinnerRef}>
      {/* Circle line */}
      <Line
        points={points}
        color="#ffffff"
        lineWidth={3}
        transparent
        opacity={0.8}
        renderOrder={101}
      />
      
      {/* Highlight segment */}
      <Line
        points={[points[0], points[1], points[2], points[3], points[4]]}
        color="#4fc3f7"
        lineWidth={5}
        transparent
        opacity={1.0}
        renderOrder={102}
      />
    </group>
  );
};

// Use types from the three-extended.d.ts file

// Create TextureLoader with loading manager for all textures
const textureLoadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(textureLoadingManager);

// Shared texture cache to improve performance
const textureCache = new Map<string, THREE.Texture>();

// Use local textures to avoid CORS and network issues
const PLACEHOLDER_IMAGE = '/cardback.jpg'; // Using the cardback from public folder
const HOLO_PATTERN_IMAGE = '/textures/foil_pattern.jpg'; // Holographic pattern texture - using foil_pattern.jpg
const RAINBOW_PATTERN_IMAGE = '/textures/foil_pattern.jpg'; // Rainbow holographic effect - using foil_pattern.jpg as fallback

// Helper function to create background color based on card type
const getTypeColor = (typeIcon: string): string => {
  switch (typeIcon) {
    case '🔥':
      return '#ff5722'; // Fire - vibrant red
    case '💧':
      return '#2196f3'; // Water - vibrant blue
    case '⚡':
      return '#ffc107'; // Lightning - vibrant yellow
    case '🪨':
      return '#795548'; // Earth - vibrant brown
    case '🫘':
    default:
      return '#9c27b0'; // Default - vibrant purple
  }
};

// Helper function to get light color based on card type (for backgrounds)
const getLightTypeColor = (typeIcon: string): string => {
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
      return '#e1bee7'; // Default - light purple
  }
};

// Load texture with fallback to procedural textures
const loadOptimizedTexture = async (
  url: string, 
  options: {
    anisotropy?: number;
    colorSpace?: THREE.ColorSpace;
    generateMipmaps?: boolean;
    flipY?: boolean;
    wrapS?: THREE.Wrapping;
    wrapT?: THREE.Wrapping;
  } = {}
): Promise<THREE.Texture> => {
  // Check if texture is already in cache
  const cacheKey = url + JSON.stringify(options);
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey) as THREE.Texture;
  }
  
  // Load the texture
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        // Apply optimization settings
        texture.anisotropy = options.anisotropy || 16;
        texture.colorSpace = options.colorSpace || THREE.SRGBColorSpace;
        texture.generateMipmaps = options.generateMipmaps !== undefined ? options.generateMipmaps : true;
        texture.flipY = options.flipY !== undefined ? options.flipY : true;
        texture.wrapS = options.wrapS || THREE.ClampToEdgeWrapping;
        texture.wrapT = options.wrapT || THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        
        // Store in cache and resolve
        textureCache.set(cacheKey, texture);
        resolve(texture);
      },
      undefined,
      (error) => {
        console.error(`Failed to load texture: ${url}`, error);
        reject(error);
      }
    );
  });
};

interface LayeredCard3DProps {
  cardData: CardData;
  isFullArt?: boolean;
  isLoading: boolean;
  showHoloFoil?: boolean;
  showNormalMap?: boolean;
  showRoughnessMap?: boolean;
  showEdgeHighlight?: boolean;
  showParticles?: boolean;
  onImageLoadStart?: () => void;
  onImageLoadComplete?: () => void;
  onImageLoadError?: (error: Error) => void;
  quality?: 'low' | 'medium' | 'high';
}

export const LayeredCard3D = ({
  cardData,
  isFullArt = false,
  isLoading,
  showHoloFoil = true,
  showNormalMap = true,
  showRoughnessMap = true,
  showEdgeHighlight = true,
  showParticles = true,
  onImageLoadStart,
  onImageLoadComplete,
  onImageLoadError,
  quality = 'medium'
}: LayeredCard3DProps) => {
  // Get the renderer for setting pixelRatio
  const { gl } = useThree();
  
  // Use a simple environment map for reflections
  const envMap = useEnvironment({ preset: 'city' });
  
  // Texture states
  const [normalImageTextureLoaded, setNormalImageTextureLoaded] = useState(false);
  const [fullArtImageTextureLoaded, setFullArtImageTextureLoaded] = useState(false);
  const [holoTextureLoaded, setHoloTextureLoaded] = useState(false);
  const [rainbowTextureLoaded, setRainbowTextureLoaded] = useState(false);
  
  // Texture references for cleanup and reuse
  const normalImageTextureRef = useRef<THREE.Texture | null>(null);
  const fullArtImageTextureRef = useRef<THREE.Texture | null>(null);
  const holoTextureRef = useRef<THREE.Texture | null>(null);
  const rainbowTextureRef = useRef<THREE.Texture | null>(null);
  
  // Create texture URLs with proper handling
  const normalImageUrl = useMemo(() => {
    return createProxyUrl(cardData.normalImageUrl);
  }, [cardData.normalImageUrl]);
  
  const fullArtImageUrl = useMemo(() => {
    if (!cardData.fullArtImageUrl) return null;
    return createProxyUrl(cardData.fullArtImageUrl);
  }, [cardData.fullArtImageUrl]);
  
  // Card dimensions
  const cardWidth = 2.5;
  const cardHeight = 3.5;
  const cardDepth = 0.05; // Changed from 0.1 to 0.05 as requested
  
  // Rounded corners are simulated using overlapping planes
  
  // Layer positions
  const LAYER_SPACING = 0.01; // Reduced spacing to move text closer to image
  const BACKGROUND_LAYER_Z = 0;
  const CARD_THICKNESS = 0.05; // Thicker card base like paper
  const IMAGE_LAYER_Z = BACKGROUND_LAYER_Z + LAYER_SPACING;
  const HOLO_LAYER_Z = IMAGE_LAYER_Z + LAYER_SPACING;
  const TEXT_LAYER_Z = IMAGE_LAYER_Z + LAYER_SPACING; // Text directly above image, skipping holo layer
  
  // References to maintain card 3D model
  const meshRef = useRef<THREE.Group>(null);
  
  // Set maximum anisotropy for all textures based on GPU capabilities
  useEffect(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    textureLoadingManager.onLoad = () => {
      console.debug('All textures loaded successfully');
    };
    console.debug(`Max anisotropy: ${maxAnisotropy}`);
    
    // Load holographic pattern textures
    loadOptimizedTexture(HOLO_PATTERN_IMAGE, {
      anisotropy: 16,
      colorSpace: THREE.SRGBColorSpace,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    }).then(texture => {
      console.debug('Holographic pattern texture loaded successfully');
      holoTextureRef.current = texture;
      texture.repeat.set(3, 3); // Repeat the pattern
      setHoloTextureLoaded(true);
    }).catch(error => {
      console.error('Failed to load holographic pattern texture:', error);
      // Create a procedural holographic texture as fallback
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Create a radial gradient with rainbow colors
        const gradient = ctx.createRadialGradient(
          canvas.width/2, canvas.height/2, 0,
          canvas.width/2, canvas.height/2, canvas.width/2
        );
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.2, '#ffff00');
        gradient.addColorStop(0.4, '#00ff00');
        gradient.addColorStop(0.6, '#00ffff');
        gradient.addColorStop(0.8, '#0000ff');
        gradient.addColorStop(1, '#ff00ff');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some noise
        for (let i = 0; i < 10000; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.2})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      const fallbackTexture = new THREE.CanvasTexture(canvas);
      fallbackTexture.repeat.set(3, 3);
      fallbackTexture.wrapS = THREE.RepeatWrapping;
      fallbackTexture.wrapT = THREE.RepeatWrapping;
      holoTextureRef.current = fallbackTexture;
      setHoloTextureLoaded(true);
    });
    
    // Always create a procedural rainbow texture instead of loading from file
    console.debug('Creating procedural rainbow pattern texture');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Create a linear gradient with rainbow colors
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#ff0000');
      gradient.addColorStop(0.17, '#ff7f00');
      gradient.addColorStop(0.33, '#ffff00');
      gradient.addColorStop(0.5, '#00ff00');
      gradient.addColorStop(0.67, '#0000ff');
      gradient.addColorStop(0.83, '#4b0082');
      gradient.addColorStop(1, '#9400d3');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add diagonal stripes
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 5;
      for (let i = -canvas.height; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + canvas.height, canvas.height);
        ctx.stroke();
      }
      
      // Add some noise/sparkle effect
      for (let i = 0; i < 2000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2 + 1;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
        ctx.fillRect(x, y, size, size);
      }
    }
    const rainbowTexture = new THREE.CanvasTexture(canvas);
    rainbowTexture.repeat.set(2, 2);
    rainbowTexture.wrapS = THREE.RepeatWrapping;
    rainbowTexture.wrapT = THREE.RepeatWrapping;
    rainbowTextureRef.current = rainbowTexture;
    setRainbowTextureLoaded(true);
    console.debug('Procedural rainbow pattern texture created successfully');
    
  }, [gl]);
  
  // Load normal and full-art image textures
  useEffect(() => {
    if (onImageLoadStart) onImageLoadStart();
    
    // --- Load normal image texture ---
    console.debug('Loading normal image texture:', normalImageUrl);
    
    // Add extra checks for URL validity
    if (!normalImageUrl) {
      console.error('Normal image URL is null or empty!');
      if (onImageLoadError) onImageLoadError(new Error('Normal image URL is missing'));
      return;
    }
    
    console.log('[DEBUG-CARD3D] Using normal image URL:', normalImageUrl);
    
    // Check if URL is from Midjourney and add special handling
    const finalNormalImageUrl = isMidjourneyUrl(normalImageUrl) 
      ? `/api/proxy-image?url=${encodeURIComponent(normalImageUrl)}&midjourney=true&timestamp=${Date.now()}&quality=high`
      : normalImageUrl;
    
    loadOptimizedTexture(finalNormalImageUrl, {
      anisotropy: 16,
      colorSpace: THREE.SRGBColorSpace
    }).then(texture => {
      console.debug('Normal image texture loaded successfully');
      normalImageTextureRef.current = texture;
      setNormalImageTextureLoaded(true);
      if (onImageLoadComplete) onImageLoadComplete();
    }).catch(error => {
      console.error('Normal image texture load error:', error);
      
      // Try with proxy URL as fallback
      console.debug('Trying with proxy URL for normal image texture');
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(normalImageUrl)}&timestamp=${Date.now()}&quality=high`;
      
      loadOptimizedTexture(proxyUrl, {
        anisotropy: 16,
        colorSpace: THREE.SRGBColorSpace
      }).then(texture => {
        console.debug('Normal image texture loaded successfully via proxy');
        normalImageTextureRef.current = texture;
        setNormalImageTextureLoaded(true);
        if (onImageLoadComplete) onImageLoadComplete();
      }).catch(proxyError => {
        console.error('Proxy normal image texture load error:', proxyError);
        if (onImageLoadError) onImageLoadError(new Error('Failed to load normal image'));
        
        // Use placeholder as last resort
        loadOptimizedTexture(PLACEHOLDER_IMAGE, {
          anisotropy: 16,
          colorSpace: THREE.SRGBColorSpace
        }).then(texture => {
          normalImageTextureRef.current = texture;
          setNormalImageTextureLoaded(true);
        });
      });
    });
    
    // --- Load full-art image texture if available ---
    if (fullArtImageUrl) {
      console.debug('Loading full-art image texture:', fullArtImageUrl);
      console.log('[DEBUG-CARD3D] Full art image URL is available:', fullArtImageUrl);
      
      // Check if URL is from Midjourney and add special handling
      const finalFullArtImageUrl = isMidjourneyUrl(fullArtImageUrl) 
        ? `/api/proxy-image?url=${encodeURIComponent(fullArtImageUrl)}&midjourney=true&timestamp=${Date.now()}&quality=high`
        : fullArtImageUrl;
      
      console.log('[DEBUG-CARD3D] Using final full art URL:', finalFullArtImageUrl);
      
      loadOptimizedTexture(finalFullArtImageUrl, {
        anisotropy: 16,
        colorSpace: THREE.SRGBColorSpace
      }).then(texture => {
        console.debug('Full-art image texture loaded successfully');
        fullArtImageTextureRef.current = texture;
        setFullArtImageTextureLoaded(true);
      }).catch(error => {
        console.error('Full-art image texture load error:', error);
        
        // Try with proxy URL as fallback
        console.debug('Trying with proxy URL for full-art image texture');
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(fullArtImageUrl)}&timestamp=${Date.now()}&quality=high`;
        
        loadOptimizedTexture(proxyUrl, {
          anisotropy: 16,
          colorSpace: THREE.SRGBColorSpace
        }).then(texture => {
          console.debug('Full-art image texture loaded successfully via proxy');
          fullArtImageTextureRef.current = texture;
          setFullArtImageTextureLoaded(true);
        }).catch(proxyError => {
          console.error('Proxy full-art image texture load error:', proxyError);
          
          // If full-art image fails to load, we just won't show full-art mode
          // This is not a critical error, so we don't call onImageLoadError
        });
      });
    }
    
    // Cleanup function
    return () => {
      // Textures will be automatically disposed by the cache management
    };
  }, [normalImageUrl, fullArtImageUrl, onImageLoadComplete, onImageLoadError, onImageLoadStart]);

  // Create holographic shader material
  const [holoShaderMaterial, setHoloShaderMaterial] = useState<THREE.ShaderMaterial | null>(null);

  // Initialize holographic shader
  useEffect(() => {
    // Create holographic shader material for the foil effect
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
    
    // Get base color from the card type
    const typeColorStr = getTypeColor(cardData.type);
    const baseColor = new THREE.Color(typeColorStr);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        holoTexture: { value: null },
        rainbowTexture: { value: null },
        baseColor: { value: baseColor },
        holoIntensity: { value: cardData.rarity.length / 3 } // More intense for higher rarity
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.FrontSide
    });
    
    setHoloShaderMaterial(material);
    
    return () => {
      if (material) material.dispose();
    };
  }, [cardData.type, cardData.rarity]);
  
  // Update shader uniforms each frame
  useFrame(({ clock }) => {
    if (holoShaderMaterial) {
      holoShaderMaterial.uniforms.time.value = clock.getElapsedTime();
      
      // Update textures if needed
      if (holoTextureRef.current && 
          holoShaderMaterial.uniforms.holoTexture.value !== holoTextureRef.current) {
        holoShaderMaterial.uniforms.holoTexture.value = holoTextureRef.current;
      }
      
      if (rainbowTextureRef.current && 
          holoShaderMaterial.uniforms.rainbowTexture.value !== rainbowTextureRef.current) {
        holoShaderMaterial.uniforms.rainbowTexture.value = rainbowTextureRef.current;
      }
    }
  });

  // Animation using useFrame with smooth transitions
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
      mesh.position.y = Math.sin(t * 0.5) * 0.03; // Vertical hover
      mesh.position.x = Math.sin(t * 0.3) * 0.015; // Horizontal slight movement
      
      // Apply natural idle animation for rotation
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
  });

  // Enhanced mouse interaction (tilt effect with smooth transitions)
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
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
  };

  // Reset rotation when pointer leaves with smooth transition
  const handlePointerLeave = () => {
    if (!meshRef.current || isLoading) return;
    
    // Reset target to neutral but don't immediately snap
    meshRef.current.userData.targetRotationY = 0;
    meshRef.current.userData.targetRotationX = 0;
    meshRef.current.userData.isInteractive = false;
  };

  // Card text constants
  const typeColorStr = getTypeColor(cardData.type);
  const lightTypeColorStr = getLightTypeColor(cardData.type);
  const FRONT_OFFSET = 0.02; // Z-offset for text layer

  // Position constants - Normal card mode
  const HEADER_Y = 1.45;
  const NAME_X = -0.9;
  const HP_X = 0.7;
  const TYPE_X = 1.1;
  
  const MOVE_BAR_Y = -0.7;
  const MOVE_NAME_X = -0.7;
  const MOVE_DMG_X = 0.9;
  
  const FOOTER_Y = -1.3;
  const WEAKNESS_X = -0.8;
  const RESISTANCE_X = 0.0;
  const RETREAT_X = 0.8;
  
  // Position constants - Full art card mode with aligned sections
  // Using coordinates from the top-left corner as origin point (0,0) at (-cardWidth/2, -cardHeight/2)
  // Margins & Padding (converted from mm to scene units)
  const OUTER_MARGIN = 0.05; // 2mm clean frame
  const ARTWORK_PADDING = 0.04; // 1.5mm around artwork
  const INNER_PADDING = 0.025; // 1mm for text boxes
  
  // Title area: X from 0.05 to 2.45, Y from 0.05 to 0.40 (0.35 units tall)
  const FULL_ART_TITLE_Y = cardHeight/2 - 0.225; // Center of title area (0.05 + 0.35/2 = 0.225)
  
  // Element positions - using fixed coordiantes for clear layout
  // Starting from the bottom:
  // Set icon area aligned to bottom (0.3 units tall for 2 lines), just above the border
  const SET_ICON_HEIGHT = 0.3;
  const FULL_ART_SET_ICON_Y = -cardHeight/2 + SET_ICON_HEIGHT/2 + OUTER_MARGIN + 0.03; // Aligned to bottom edge + border offset
  
  // Stats area aligned to top of set icon (0.4 units tall) - for weakness/resistance
  const STATS_HEIGHT = 0.4;
  const FULL_ART_STATS_Y = FULL_ART_SET_ICON_Y + SET_ICON_HEIGHT/2 + STATS_HEIGHT/2; // Top-aligned with set icon
  
  // Move box positioned directly above stats area (0.5 units tall) - description is hidden
  const MOVE_BOX_HEIGHT = 0.4; // Reduced height since move description is hidden
  
  // Keep the MOVE_DESCRIPTION_Y variable for compatibility, but it's not used now
  const MOVE_DESCRIPTION_Y = FULL_ART_STATS_Y + STATS_HEIGHT/2 + 0.4; 
  
  // Move name/damage positioned above stats area
  const MOVE_NAME_Y = FULL_ART_STATS_Y + STATS_HEIGHT/2 + 0.2; // Move name directly above stats

  // Typography settings (converted from points to scene units)
  const TITLE_FONT_SIZE = 0.18; // 16pt, bold, for card name
  const EFFECT_FONT_SIZE = 0.1;  // 9pt, for move descriptions
  const ATTRIBUTE_FONT_SIZE = 0.11; // 10pt, for stats and attributes
  const TEXT_FONT_SIZE = 0.15; // Legacy font size - keeping for backward compatibility

  return (
    <>
      {/* Card shadow on background plane */}
      <mesh 
        position={[0, -0.1, -0.5]}
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[10, 10]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
      
      {/* Main card container */}
      <group 
        ref={meshRef}
        visible={!isLoading}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* LAYER 0: Background layer with type-based color and paper thickness */}
        {/* Card base with thickness (back side) */}
        <Box
          args={[cardWidth, cardHeight, CARD_THICKNESS]}
          position={[0, 0, BACKGROUND_LAYER_Z - CARD_THICKNESS/2]}
        >
          <meshStandardMaterial
            color={cardData.type === '🫘' ? "#f8f6f2" : lightTypeColorStr} // Off-white for bean type
            roughness={0.6}
            metalness={0.1}
            envMap={envMap}
            envMapIntensity={0.2}
          />
        </Box>
        
        {/* Card edges */}
        <Box
          args={[cardWidth, cardHeight, CARD_THICKNESS]}
          position={[0, 0, BACKGROUND_LAYER_Z - CARD_THICKNESS/2]}
        >
          <meshStandardMaterial
            color={"#e0e0e0"} 
            roughness={0.5}
            metalness={0.2}
            envMap={envMap}
            envMapIntensity={0.3}
            side={THREE.BackSide}
          />
        </Box>
        
        {/* Front face - smooth surface with type color */}
        <Plane
          args={[cardWidth, cardHeight]}
          position={[0, 0, BACKGROUND_LAYER_Z]}
        >
          <meshStandardMaterial
            color={cardData.type === '🫘' ? "#f8f6f2" : lightTypeColorStr} // Off-white for bean type
            roughness={0.4}
            metalness={0.15}
            envMap={envMap}
            envMapIntensity={0.25}
          />
        </Plane>
        
        {/* LAYER 1: Image layer with frame - NORMAL MODE (shown when !isFullArt) */}
        {!isFullArt && (
          <>
            {/* Calculate image position to align with title area and other adjustments */}
            {(() => {
              // Calculate dimensions - increase by 10% from previous 80% = 88% of original
              const imageWidth = (cardWidth * 0.9) * 0.88;
              const imageHeight = (cardHeight * 0.65) * 0.88;
              
              // Title area is at FULL_ART_TITLE_Y
              // To align the top of the image with the bottom of the title area,
              // we need to position the image at:
              // FULL_ART_TITLE_Y - (imageHeight/2) - some small gap
              
              const titleToImageGap = 0.05; // Small gap between title and image
              const imageY = FULL_ART_TITLE_Y - titleToImageGap - (imageHeight/2);
              
              // Calculate the bottom position of the image area to align the set icon area
              const imageBottomY = imageY - (imageHeight/2);
              const setIconGap = 0.05; // Small gap between image and set icon
              const setIconY = imageBottomY - setIconGap - 0.15; // 0.15 is half height of set icon area
              
              // Calculate move box position - align to bottom of set icon area
              const setIconHeight = 0.3; // Height of set icon area
              const moveBoxGap = 0.05; // Small gap between set icon and move box
              const moveBoxY = setIconY - (setIconHeight/2) - moveBoxGap - 0.2; // 0.2 is half height of move box
              
              // Calculate weakness/resistance position - align to bottom of card
              const weaknessY = -cardHeight/2 + 0.25; // 0.25 from bottom of card
              
              // Store these calculated positions for use in other components
              const calculatedPositions = {
                imageY,
                setIconY,
                moveBoxY,
                weaknessY
              };
              
              // Expose these calculated positions for use in other text elements
              if (typeof window !== 'undefined') {
                window._normalCardCalculatedPositions = calculatedPositions;
              }
              
              return (
                <>
                  {/* Gray border for entire card - using multiple planes for the border */}
                  {/* Top border */}
                  <Plane
                    args={[cardWidth, 0.05]}
                    position={[0, cardHeight/2 - 0.025, IMAGE_LAYER_Z - 0.002]}
                  >
                    <meshStandardMaterial
                      color="#dedede"
                      roughness={0.5}
                      metalness={0.2}
                      envMap={envMap}
                      envMapIntensity={0.2}
                    />
                  </Plane>
                  
                  {/* Bottom border */}
                  <Plane
                    args={[cardWidth, 0.05]}
                    position={[0, -cardHeight/2 + 0.025, IMAGE_LAYER_Z - 0.002]}
                  >
                    <meshStandardMaterial
                      color="#dedede"
                      roughness={0.5}
                      metalness={0.2}
                      envMap={envMap}
                      envMapIntensity={0.2}
                    />
                  </Plane>
                  
                  {/* Left border */}
                  <Plane
                    args={[0.05, cardHeight - 0.1]}
                    position={[-cardWidth/2 + 0.025, 0, IMAGE_LAYER_Z - 0.002]}
                  >
                    <meshStandardMaterial
                      color="#dedede"
                      roughness={0.5}
                      metalness={0.2}
                      envMap={envMap}
                      envMapIntensity={0.2}
                    />
                  </Plane>
                  
                  {/* Right border */}
                  <Plane
                    args={[0.05, cardHeight - 0.1]}
                    position={[cardWidth/2 - 0.025, 0, IMAGE_LAYER_Z - 0.002]}
                  >
                    <meshStandardMaterial
                      color="#dedede"
                      roughness={0.5}
                      metalness={0.2}
                      envMap={envMap}
                      envMapIntensity={0.2}
                    />
                  </Plane>
                  
                  {/* Image frame/border - scaled and aligned with title */}
                  <Plane
                    args={[imageWidth + 0.05, imageHeight + 0.05]}
                    position={[0, imageY, IMAGE_LAYER_Z - 0.001]}
                  >
                    <meshStandardMaterial
                      color="#f0f0f0"
                      roughness={0.4}
                      metalness={0.3}
                      envMap={envMap}
                      envMapIntensity={0.25}
                    />
                  </Plane>
                  
                  {/* NFT Image - scaled and aligned with title */}
                  <Plane
                    args={[imageWidth, imageHeight]}
                    position={[0, imageY, IMAGE_LAYER_Z]}
                  >
                    <meshStandardMaterial
                      map={normalImageTextureRef.current || undefined}
                      color={normalImageTextureRef.current ? 0xffffff : lightTypeColorStr}
                      roughness={0.2}
                      metalness={0.1}
                      envMap={envMap}
                      envMapIntensity={0.2}
                      transparent={true}
                    />
                  </Plane>
                  
                  {/* Image reflection overlay for glossy effect */}
                  <Plane
                    args={[imageWidth, imageHeight]}
                    position={[0, imageY, IMAGE_LAYER_Z + 0.001]}
                  >
                    <meshPhysicalMaterial
                      color="#ffffff"
                      roughness={0.1}
                      metalness={0.1}
                      clearcoat={1.0}
                      clearcoatRoughness={0.2}
                      envMap={envMap}
                      envMapIntensity={0.5}
                      transparent={true}
                      opacity={0.1}
                    />
                  </Plane>
                </>
              );
            })()}
          </>
        )}
        
        {/* LAYER 1: FULL ART MODE (shown when isFullArt and full art image is available) */}
        {isFullArt && fullArtImageTextureRef.current && (
          <>
            {/* Premium edge glow - outer margin (2mm) */}
            <Plane
              args={[cardWidth - OUTER_MARGIN*2, cardHeight - OUTER_MARGIN*2]}
              position={[0, 0, IMAGE_LAYER_Z - 0.003]}
            >
              <meshStandardMaterial
                color={typeColorStr}
                roughness={0.3}
                metalness={0.6}
                envMap={envMap}
                envMapIntensity={0.4}
                transparent={true}
                opacity={0.4}
              />
            </Plane>
            
            {/* Card frame/border - clean frame with inner padding */}
            <Plane
              args={[cardWidth - OUTER_MARGIN*2 - 0.02, cardHeight - OUTER_MARGIN*2 - 0.02]}
              position={[0, 0, IMAGE_LAYER_Z - 0.002]}
            >
              <meshStandardMaterial
                color="#ffffff"
                roughness={0.2}
                metalness={0.5}
                envMap={envMap}
                envMapIntensity={0.5}
                transparent={true}
                opacity={0.5}
              />
            </Plane>
            
            {/* Full art image - with artwork padding (1.5mm) */}
            <Plane
              args={[cardWidth - OUTER_MARGIN*2 - ARTWORK_PADDING*2, cardHeight - OUTER_MARGIN*2 - ARTWORK_PADDING*2]}
              position={[0, 0, IMAGE_LAYER_Z]}
            >
              <meshStandardMaterial
                map={fullArtImageTextureRef.current}
                roughness={0.2}
                metalness={0.3}
                envMap={envMap}
                envMapIntensity={0.3}
                transparent={true}
              />
            </Plane>
            
            {/* Premium holographic overlay - matching artwork size */}
            <Plane
              args={[cardWidth - OUTER_MARGIN*2 - ARTWORK_PADDING*2, cardHeight - OUTER_MARGIN*2 - ARTWORK_PADDING*2]}
              position={[0, 0, IMAGE_LAYER_Z + 0.001]}
            >
              <meshPhysicalMaterial
                color="#ffffff"
                roughness={0.1}
                metalness={0.4}
                clearcoat={1.0}
                clearcoatRoughness={0.1}
                envMap={envMap}
                envMapIntensity={0.8}
                transparent={true}
                opacity={0.15}
              />
            </Plane>
          </>
        )}
        
        {/* Fallback to normal image if full art requested but not available */}
        {isFullArt && !fullArtImageTextureRef.current && (
          <>
            {/* Premium edge glow */}
            <Plane
              args={[cardWidth - OUTER_MARGIN*2, cardHeight - OUTER_MARGIN*2]}
              position={[0, 0, IMAGE_LAYER_Z - 0.003]}
            >
              <meshStandardMaterial
                color={typeColorStr}
                roughness={0.3}
                metalness={0.6}
                envMap={envMap}
                envMapIntensity={0.4}
                transparent={true}
                opacity={0.4}
              />
            </Plane>
            
            {/* Card frame/border with inner padding */}
            <Plane
              args={[cardWidth - OUTER_MARGIN*2 - 0.02, cardHeight - OUTER_MARGIN*2 - 0.02]}
              position={[0, 0, IMAGE_LAYER_Z - 0.002]}
            >
              <meshStandardMaterial
                color="#ffffff"
                roughness={0.2}
                metalness={0.5}
                envMap={envMap}
                envMapIntensity={0.5}
                transparent={true}
                opacity={0.5}
              />
            </Plane>
            
            {/* Normal Image as fallback */}
            <Plane
              args={[cardWidth - OUTER_MARGIN*2 - ARTWORK_PADDING*2, cardHeight - OUTER_MARGIN*2 - ARTWORK_PADDING*2]}
              position={[0, 0, IMAGE_LAYER_Z]}
            >
              <meshStandardMaterial
                map={normalImageTextureRef.current || undefined}
                color={normalImageTextureRef.current ? 0xffffff : lightTypeColorStr}
                roughness={0.2}
                metalness={0.3}
                envMap={envMap}
                envMapIntensity={0.3}
                transparent={true}
              />
            </Plane>
            
            {/* Add "Full Art Coming Soon" text only if cardData has a fullArtImageUrl field but it failed to load */}
            {cardData.fullArtImageUrl && (
              <Text
                position={[0, 0, IMAGE_LAYER_Z + 0.01]}
                fontSize={0.15}
                color="#ffffff"
                fontWeight="bold"
                anchorX="center"
                anchorY="middle"
                maxWidth={2}
                textAlign="center"
                material-toneMapped={false}
                material-transparent={true}
                renderOrder={20}
                outlineWidth={0.03}
                outlineColor="#000000"
              >
                Full Art Coming Soon
              </Text>
            )}
          </>
        )}
        
        {/* HOLO EFFECT DISABLED */}
        
        {/* LAYER 2: Text layer - NORMAL MODE (only show when not in full art mode) - using full art text layout */}
        {!isFullArt && (
          <>
            {/* Title/Header Section with same layout as full art */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              
              {/* Card Name - left side of title area with enhanced auto-scaling font size - no outlines */}
              <Text
                position={[-cardWidth/2 + 0.15, FULL_ART_TITLE_Y, 0]}
                // font="/fonts/PlayfairDisplay-Bold.ttf" // Serif font for title (commented until fonts are added)
                color="#000000"
                fontWeight="bold"
                anchorX="left"
                anchorY="middle"
                maxWidth={cardWidth * 0.58} // 58% of card width for name
                textAlign="left"
                material-toneMapped={false}
                material-transparent={true}
                renderOrder={20}
                fillOpacity={1.0}
                children={cardData.cardName || "Card Name"}
                // Enhanced dynamic font size calculation with more aggressive scaling
                // for long names to ensure single line text
                fontSize={(() => {
                  const nameLength = (cardData.cardName || "Card Name").length;
                  if (nameLength <= 12) {
                    // Short names use full size
                    return TITLE_FONT_SIZE;
                  } else if (nameLength <= 18) {
                    // Medium names scale linearly down to 75%
                    return TITLE_FONT_SIZE * (1 - (nameLength - 12) * 0.042);
                  } else if (nameLength <= 25) {
                    // Longer names scale more aggressively
                    return TITLE_FONT_SIZE * (0.75 - (nameLength - 18) * 0.036);
                  } else {
                    // Very long names get minimum size
                    return TITLE_FONT_SIZE * 0.5;
                  }
                })()}
              />
              
              {/* Type - right-aligned to card edge - no outlines */}
              <Text
                position={[1.2, FULL_ART_TITLE_Y, 0]} // X = 1.2 from full art mode
                fontSize={TITLE_FONT_SIZE * 1.3}
                anchorX="right" // Right-aligned
                anchorY="middle"
                maxWidth={cardWidth * 0.1} // 10% of card width = 0.25
                textAlign="right"
                material-toneMapped={false}
                material-transparent={true}
                renderOrder={20}
              >
                {cardData.type}
              </Text>
              
              {/* HP - right-aligned next to Type with specified positioning - no outlines */}
              <Text
                position={[0.9, FULL_ART_TITLE_Y, 0]} // X = 0.9 from full art mode
                // Dynamically calculate font size based on HP value length
                fontSize={Math.min(
                  TITLE_FONT_SIZE * 1.1, 
                  TITLE_FONT_SIZE * 1.1 * (5 / Math.max(3, (cardData.hp || "120").length))
                )}
                color="#000000"
                fontWeight="bold"
                anchorX="right" // Right-aligned
                anchorY="middle"
                maxWidth={cardWidth * 0.25} // 25% of card width = 0.625
                textAlign="right" // Ensure right alignment
                material-toneMapped={false}
                material-transparent={true}
                depthWrite={false}
                renderOrder={20}
              >
                {cardData.hp}
              </Text>
            </group>
            
            {/* Move Box aligned to the bottom of the set icon area */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              {(() => {
                // Use the calculated position from the image layout
                // If window object isn't available (server side), use a fallback position
                const moveBoxY = (typeof window !== 'undefined' && window._normalCardCalculatedPositions) 
                  ? window._normalCardCalculatedPositions.moveBoxY 
                  : -0.4;
                
                // Add a move box background
                return (
                  <>
                    {/* Move box background removed as requested */}
                    
                    {/* Move Name - Left side of move box - with higher render order and no outline */}
                    <Text
                      position={[-cardWidth/2 + 0.25, moveBoxY, TEXT_LAYER_Z + 0.003]}
                      fontSize={EFFECT_FONT_SIZE * 1.2}
                      // font="/fonts/OpenSans-Bold.ttf" // Sans-serif for readability (commented until fonts are added)
                      color="#000000"
                      fontWeight="bold"
                      anchorX="left"
                      anchorY="middle"
                      maxWidth={cardWidth - 0.6}
                      textAlign="left"
                      material-toneMapped={false}
                      material-transparent={true}
                      renderOrder={30} // Higher render order to appear on top
                      letterSpacing={0.01}
                    >
                      {cardData.move.name}
                    </Text>
                    
                    {/* Move Damage - right side of move box - with higher render order and no outline */}
                    <Text
                      position={[cardWidth/2 - 0.25, moveBoxY, TEXT_LAYER_Z + 0.003]}
                      fontSize={EFFECT_FONT_SIZE * 1.2}
                      color="#000000"
                      fontWeight="bold"
                      anchorX="right"
                      anchorY="middle"
                      material-toneMapped={false}
                      material-transparent={true}
                      renderOrder={30} // Higher render order to appear on top
                    >
                      {cardData.move.damage}
                    </Text>
                  </>
                );
              })()}
            </group>
            
            {/* Weakness/Resistance Section aligned to bottom of card */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              {(() => {
                // Use the calculated position from the image layout
                // If window object isn't available (server side), use a fallback position
                const weaknessY = (typeof window !== 'undefined' && window._normalCardCalculatedPositions) 
                  ? window._normalCardCalculatedPositions.weaknessY 
                  : -1.5;
                
                return (
                  <>
                    {/* Weakness - Left side - no outlines */}
                    <Text
                      position={[-cardWidth * 0.25, weaknessY, 0]}
                      fontSize={ATTRIBUTE_FONT_SIZE * 0.9}
                      color="#000000"
                      fontWeight="bold"
                      anchorX="center"
                      anchorY="middle"
                      material-toneMapped={false}
                      material-transparent={true}
                      depthWrite={false}
                      renderOrder={20}
                    >
                      Weakness: {cardData.weakness || "💧 x2"}
                    </Text>
                    
                    {/* Resistance - Right - no outlines */}
                    <Text
                      position={[cardWidth * 0.25, weaknessY, 0]}
                      fontSize={ATTRIBUTE_FONT_SIZE * 0.9}
                      color="#000000"
                      fontWeight="bold"
                      anchorX="center"
                      anchorY="middle"
                      material-toneMapped={false}
                      material-transparent={true}
                      depthWrite={false}
                      renderOrder={20}
                    >
                      Resistance: {cardData.resistance || "🪨 -20"}
                    </Text>
                  </>
                );
              })()}
            </group>
            
            {/* Set Icon/Info Area aligned to the bottom of the image */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              {(() => {
                // Extract just the trait values (after the colon)
                const extractTraitValues = (traitsStr: string) => {
                  return traitsStr.split(',')
                    .map(trait => {
                      const parts = trait.split(':');
                      // Return the value part (after colon), or the whole trait if no colon
                      return parts.length > 1 ? parts[1].trim() : trait.trim();
                    })
                    .filter(val => val) // Remove any empty strings
                    .join(', ');
                };
                
                const traitValues = extractTraitValues(cardData.traits || "Human, Samurai, Rare");
                const formattedTraits = traitValues.split(', ').join(' \u2022 '); // Join with bullet points
                
                // Extract Azuki number from traits string (format: "Azuki #123 - traits...")
                const azukiNumberMatch = cardData.traits && cardData.traits.match(/Azuki #(\d+)/);
                const azukiNumber = azukiNumberMatch ? "#" + azukiNumberMatch[1] : "#1834";
                
                // Determine if we need one or two lines based on width constraints
                // Each character takes roughly 0.02 units of width at our current font size
                const maxCharsPerLine = Math.floor((cardWidth - 0.4) / 0.02);
                
                // Calculate how much space the Azuki number plus first bullet takes
                const prefixLength = azukiNumber.length + 3; // "#1834 • " length
                const availableChars = maxCharsPerLine - prefixLength;
                
                let line1, line2;
                
                if (formattedTraits.length <= availableChars) {
                  // Everything fits on one line
                  line1 = formattedTraits;
                  line2 = "";
                } else {
                  // Need to split into two lines - find a good break point at a bullet
                  // Try to find a break point that puts most content on first line without overflow
                  let breakIndex = -1;
                  let lastBullet = 0;
                  
                  // Find the last bullet point that would still fit on line 1
                  while (true) {
                    const nextBullet = formattedTraits.indexOf(' \u2022 ', lastBullet + 1);
                    if (nextBullet === -1 || nextBullet > availableChars) {
                      break;
                    }
                    breakIndex = nextBullet;
                    lastBullet = nextBullet + 3;
                  }
                  
                  if (breakIndex > 0) {
                    line1 = formattedTraits.substring(0, breakIndex);
                    line2 = formattedTraits.substring(breakIndex + 3); // Skip the bullet point
                  } else {
                    // No good bullet point break found, cut at available chars
                    line1 = formattedTraits.substring(0, availableChars);
                    line2 = formattedTraits.substring(availableChars);
                    
                    // Try to avoid cutting in the middle of a word
                    if (line1.charAt(line1.length - 1) !== " " && line2.charAt(0) !== " ") {
                      const lastSpace = line1.lastIndexOf(" ");
                      if (lastSpace > availableChars * 0.7) { // Only adjust if we don't lose too much space
                        line1 = formattedTraits.substring(0, lastSpace);
                        line2 = formattedTraits.substring(lastSpace + 1);
                      }
                    }
                  }
                }
                
                // Use the calculated position from the image layout
                // If window object isn't available (server side), use a fallback position
                const setIconY = (typeof window !== 'undefined' && window._normalCardCalculatedPositions) 
                  ? window._normalCardCalculatedPositions.setIconY 
                  : -0.8;
                
                return (
                  <>
                    {/* Azuki Number and First Line of Traits */}
                    <Text
                      position={[-cardWidth/2 + 0.12, setIconY + (line2 ? 0.07 : 0), 0]}
                      fontSize={EFFECT_FONT_SIZE * 0.68}
                      // font="/fonts/OpenSans-SemiBold.ttf"
                      color="#000000"
                      anchorX="left"
                      anchorY="middle"
                      maxWidth={cardWidth - 0.25}
                      textAlign="left"
                      material-toneMapped={false}
                      material-transparent={true}
                      depthWrite={false}
                      renderOrder={20}
                      fontWeight="bold"
                      letterSpacing={0.004}
                    >
                      {azukiNumber} {" • "} {line1}
                    </Text>
                    
                    {/* Second Line of Traits (if needed) */}
                    {line2 && (
                      <Text
                        position={[-cardWidth/2 + 0.12, setIconY - 0.07, 0]}
                        fontSize={EFFECT_FONT_SIZE * 0.68}
                        // font="/fonts/OpenSans-Italic.ttf"
                        color="#000000"
                        anchorX="left"
                        anchorY="middle"
                        maxWidth={cardWidth - 0.25}
                        textAlign="left"
                        material-toneMapped={false}
                        material-transparent={true}
                        depthWrite={false}
                        renderOrder={20}
                        fontWeight="bold"
                        letterSpacing={0.004}
                      >
                        {line2}
                      </Text>
                    )}
                  </>
                );
              })()}
            </group>
          </>
        )}
        
        {/* FULL ART MODE: clean text overlay with precise layout distribution and improved typography */}
        {isFullArt && (
          <>
            {/* Title/Header Section - X: 0.05 to 2.45, Y: 0.05 to 0.40 (0.35 units tall) */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              
              {/* Card Name - left side of title area with enhanced auto-scaling font size */}
              <Text
                position={[-cardWidth/2 + 0.15, FULL_ART_TITLE_Y, 0]}
                // font="/fonts/PlayfairDisplay-Bold.ttf" // Serif font for title (commented until fonts are added)
                color="#000000"
                fontWeight="bold"
                anchorX="left"
                anchorY="middle"
                maxWidth={cardWidth * 0.58} // 58% of card width for name (slightly increased from 55%)
                textAlign="left"
                material-toneMapped={false}
                material-transparent={true}
                depthWrite={false}
                renderOrder={20}
                outlineColor="#ffffff"
                fillOpacity={1.0}
                children={cardData.cardName || "Card Name"}
                // Enhanced dynamic font size calculation with more aggressive scaling
                // for long names to ensure single line text
                fontSize={(() => {
                  const nameLength = (cardData.cardName || "Card Name").length;
                  if (nameLength <= 12) {
                    // Short names use full size
                    return TITLE_FONT_SIZE;
                  } else if (nameLength <= 18) {
                    // Medium names scale linearly down to 75%
                    return TITLE_FONT_SIZE * (1 - (nameLength - 12) * 0.042);
                  } else if (nameLength <= 25) {
                    // Longer names scale more aggressively
                    return TITLE_FONT_SIZE * (0.75 - (nameLength - 18) * 0.036);
                  } else {
                    // Very long names get minimum size
                    return TITLE_FONT_SIZE * 0.5;
                  }
                })()}
                // Dynamic outline width based on font size
                outlineWidth={(() => {
                  const nameLength = (cardData.cardName || "Card Name").length;
                  const scaleFactor = nameLength <= 12 ? 1 : 
                                    nameLength <= 18 ? (1 - (nameLength - 12) * 0.042) :
                                    nameLength <= 25 ? (0.75 - (nameLength - 18) * 0.036) : 0.5;
                  return 0.028 * scaleFactor;
                })()}
              />
              
              {/* Type - right-aligned to card edge */}
              <Text
                // X-position: cardWidth/2 - border = 1.25 - 0.05 = 1.2
                position={[1.2, FULL_ART_TITLE_Y, 0]}
                fontSize={TITLE_FONT_SIZE * 1.3}
                anchorX="right" // Right-aligned
                anchorY="middle"
                maxWidth={cardWidth * 0.1} // 10% of card width = 0.25
                textAlign="right"
                material-toneMapped={false}
                material-transparent={true}
                depthWrite={false}
                renderOrder={20}
              >
                {cardData.type}
              </Text>
              
              {/* HP - right-aligned next to Type with specified positioning */}
              <Text
                // X-position: Type X - Type max width - spacing
                // 1.2 - 0.25 - 0.05 = 0.9
                position={[0.9, FULL_ART_TITLE_Y, 0]}
                // Dynamically calculate font size based on HP value length
                fontSize={Math.min(
                  TITLE_FONT_SIZE * 1.1, 
                  TITLE_FONT_SIZE * 1.1 * (5 / Math.max(3, (cardData.hp || "120").length))
                )}
                color="#000000"
                fontWeight="bold"
                anchorX="right" // Right-aligned
                anchorY="middle"
                maxWidth={cardWidth * 0.25} // 25% of card width = 0.625
                textAlign="right" // Ensure right alignment
                material-toneMapped={false}
                material-transparent={true}
                renderOrder={20}
                // Dynamic outline width based on font size
                outlineWidth={Math.min(0.028, 0.028 * (5 / Math.max(3, (cardData.hp || "120").length)))}
                outlineColor="#ffffff"
              >
                {cardData.hp}
              </Text>
            </group>
            
            {/* Move Box - X: 0.10 to 2.40, Y: 2.25 to 3.00 (0.75 units tall) */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              
              {/* Move Name - Above the move description */}
              <Text
                position={[-cardWidth/2 + 0.25, MOVE_NAME_Y, 0]}
                fontSize={EFFECT_FONT_SIZE * 1.2}
                // font="/fonts/OpenSans-Bold.ttf" // Sans-serif for readability (commented until fonts are added)
                color="#000000"
                fontWeight="bold"
                anchorX="left"
                anchorY="middle"
                maxWidth={cardWidth - 0.6}
                textAlign="left"
                material-toneMapped={false}
                material-transparent={true}
                depthWrite={false}
                renderOrder={20}
                outlineWidth={0.011} // Reduced outline by half
                outlineColor="#ffffff"
                letterSpacing={0.01}
              >
                {cardData.move.name}
              </Text>
              
              {/* Move Damage - right side of move name */}
              <Text
                position={[cardWidth/2 - 0.25, MOVE_NAME_Y, 0]}
                fontSize={EFFECT_FONT_SIZE * 1.2}
                color="#000000"
                fontWeight="bold"
                anchorX="right"
                anchorY="middle"
                material-toneMapped={false}
                material-transparent={true}
                depthWrite={false}
                renderOrder={20}
                outlineWidth={0.011} // Reduced outline by half
                outlineColor="#ffffff"
              >
                {cardData.move.damage}
              </Text>
              
              {/* Move Description is hidden as requested */}
              {/* Debug text is also removed */}
            </group>
            
            {/* Set Icon/Info Area - Full width at bottom */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              
              {/* Helper function to extract trait values and format text */}
              {(() => {
                // Extract just the trait values (after the colon)
                const extractTraitValues = (traitsStr: string) => {
                  return traitsStr.split(',')
                    .map(trait => {
                      const parts = trait.split(':');
                      // Return the value part (after colon), or the whole trait if no colon
                      return parts.length > 1 ? parts[1].trim() : trait.trim();
                    })
                    .filter(val => val) // Remove any empty strings
                    .join(', ');
                };
                
                const traitValues = extractTraitValues(cardData.traits || "Human, Samurai, Rare");
                const formattedTraits = traitValues.split(', ').join(' \u2022 '); // Join with bullet points
                
                // Extract Azuki number from traits string (format: "Azuki #123 - traits...")
                const azukiNumberMatch = cardData.traits && cardData.traits.match(/Azuki #(\d+)/);
                const azukiNumber = azukiNumberMatch ? "#" + azukiNumberMatch[1] : "#1834";
                
                // Determine if we need one or two lines based on width constraints
                // Each character takes roughly 0.02 units of width at our current font size
                const maxCharsPerLine = Math.floor((cardWidth - 0.4) / 0.02);
                
                // Calculate how much space the Azuki number plus first bullet takes
                const prefixLength = azukiNumber.length + 3; // "#1834 • " length
                const availableChars = maxCharsPerLine - prefixLength;
                
                let line1, line2;
                
                if (formattedTraits.length <= availableChars) {
                  // Everything fits on one line
                  line1 = formattedTraits;
                  line2 = "";
                } else {
                  // Need to split into two lines - find a good break point at a bullet
                  // Try to find a break point that puts most content on first line without overflow
                  let breakIndex = -1;
                  let lastBullet = 0;
                  
                  // Find the last bullet point that would still fit on line 1
                  while (true) {
                    const nextBullet = formattedTraits.indexOf(' \u2022 ', lastBullet + 1);
                    if (nextBullet === -1 || nextBullet > availableChars) {
                      break;
                    }
                    breakIndex = nextBullet;
                    lastBullet = nextBullet + 3;
                  }
                  
                  if (breakIndex > 0) {
                    line1 = formattedTraits.substring(0, breakIndex);
                    line2 = formattedTraits.substring(breakIndex + 3); // Skip the bullet point
                  } else {
                    // No good bullet point break found, cut at available chars
                    line1 = formattedTraits.substring(0, availableChars);
                    line2 = formattedTraits.substring(availableChars);
                    
                    // Try to avoid cutting in the middle of a word
                    if (line1.charAt(line1.length - 1) !== " " && line2.charAt(0) !== " ") {
                      const lastSpace = line1.lastIndexOf(" ");
                      if (lastSpace > availableChars * 0.7) { // Only adjust if we don't lose too much space
                        line1 = formattedTraits.substring(0, lastSpace);
                        line2 = formattedTraits.substring(lastSpace + 1);
                      }
                    }
                  }
                }
                
                return (
                  <>
                    {/* Azuki Number and First Line of Traits */}
                    <Text
                      position={[-cardWidth/2 + 0.12, FULL_ART_SET_ICON_Y + (line2 ? 0.07 : 0), 0]}
                      fontSize={EFFECT_FONT_SIZE * 0.68}
                      // font="/fonts/OpenSans-SemiBold.ttf"
                      color="#000000"
                      anchorX="left"
                      anchorY="middle"
                      maxWidth={cardWidth - 0.25}
                      textAlign="left"
                      material-toneMapped={false}
                      material-transparent={true}
                      renderOrder={20}
                      outlineWidth={0.006} // Reduced outline by half
                      outlineColor="#ffffff"
                      fontWeight="bold"
                      letterSpacing={0.004}
                    >
                      {azukiNumber} {" • "} {line1}
                    </Text>
                    
                    {/* Second Line of Traits (if needed) */}
                    {line2 && (
                      <Text
                        position={[-cardWidth/2 + 0.12, FULL_ART_SET_ICON_Y - 0.07, 0]}
                        fontSize={EFFECT_FONT_SIZE * 0.68}
                        // font="/fonts/OpenSans-Italic.ttf"
                        color="#000000"
                        anchorX="left"
                        anchorY="middle"
                        maxWidth={cardWidth - 0.25}
                        textAlign="left"
                        material-toneMapped={false}
                        material-transparent={true}
                        renderOrder={20}
                        outlineWidth={0.006} // Reduced outline by half
                        outlineColor="#ffffff"
                        fontWeight="bold"
                        letterSpacing={0.004}
                      >
                        {line2}
                      </Text>
                    )}
                  </>
                );
              })()}
            </group>
            
            {/* Weakness/Resistance Section */}
            <group position={[0, 0, TEXT_LAYER_Z + FRONT_OFFSET]}>
              
              {/* Weakness - Left side */}
              <Text
                position={[-cardWidth * 0.25, FULL_ART_STATS_Y, 0]}
                fontSize={ATTRIBUTE_FONT_SIZE * 0.9}
                color="#000000"
                fontWeight="bold"
                anchorX="center"
                anchorY="middle"
                material-toneMapped={false}
                material-transparent={true}
                renderOrder={20}
                outlineWidth={0.006} // Reduced outline by half
                outlineColor="#ffffff"
              >
                Weakness: {cardData.weakness || "💧 x2"}
              </Text>
              
              {/* Resistance - Right */}
              <Text
                position={[cardWidth * 0.25, FULL_ART_STATS_Y, 0]}
                fontSize={ATTRIBUTE_FONT_SIZE * 0.9}
                color="#000000"
                fontWeight="bold"
                anchorX="center"
                anchorY="middle"
                material-toneMapped={false}
                material-transparent={true}
                renderOrder={20}
                outlineWidth={0.006} // Reduced outline by half
                outlineColor="#ffffff"
              >
                Resistance: {cardData.resistance || "🪨 -20"}
              </Text>
              
            </group>
          </>
        )}
        
        {/* Loading indicators - use separate indicators for normal and full art modes */}
        {isLoading && (
          <>
            {/* Loading text */}
            <Text
              position={[0, 0, 0.1]}
              fontSize={0.2}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#000000"
              renderOrder={100}
            >
              Loading...
            </Text>
            
            {/* Animated loading spinner */}
            <group position={[0, -0.5, 0.1]}>
              <LoadingSpinner />
            </group>
          </>
        )}
        
        {/* Show loading indicator for full art mode */}
        {!isLoading && isFullArt && !fullArtImageTextureLoaded && cardData.fullArtImageUrl && (
          <>
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
            
            {/* Animated loading spinner */}
            <group position={[0, -0.3, 0.1]}>
              <LoadingSpinner />
            </group>
          </>
        )}
        
        {/* Show loading indicator for normal card mode */}
        {!isLoading && !isFullArt && !normalImageTextureLoaded && (
          <>
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
            
            {/* Animated loading spinner */}
            <group position={[0, -0.3, 0.1]}>
              <LoadingSpinner />
            </group>
          </>
        )}
      </group>
    </>
  );
};