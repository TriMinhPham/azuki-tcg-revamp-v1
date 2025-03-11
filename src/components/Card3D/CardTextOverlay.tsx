import { Text, Plane, RoundedBox, useTexture, useGLTF, Center } from '@react-three/drei';
import { CardData } from '@/types';
import * as THREE from 'three';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

// Create TextureLoader with loading manager for all textures
const textureLoadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(textureLoadingManager);

// Shared texture cache to improve performance
const textureCache = new Map<string, THREE.Texture>();

// Load texture with proper optimization settings
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

interface CardTextOverlayProps {
  cardData: CardData;
  isFullArt?: boolean;
}

// Helper function to get color based on card type
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

// URL for local textures to avoid CORS issues
const FOIL_PATTERN_URL = '/textures/foil_pattern.jpg';
const CARD_BORDER_PATTERN = '/textures/border_pattern.jpg';

export const CardTextOverlay = ({ cardData, isFullArt = false }: CardTextOverlayProps) => {
  // Texture references for cleanup and reuse
  const cardTextureRef = useRef<THREE.Texture | null>(null);
  const foilTextureRef = useRef<THREE.Texture | null>(null);
  const borderPatternRef = useRef<THREE.Texture | null>(null);
  
  const [cardTextureLoaded, setCardTextureLoaded] = useState(false);
  
  // === TEXT LAYER: Simplified text rendering setup ===
  const textOptions = {
    fontSize: 0.15,                  // Base font size
    letterSpacing: 0.01,             // Slight letter spacing for readability
    lineHeight: 1.1,                 // Comfortable line height
    'material-toneMapped': false,    // Better color reproduction
    'material-transparent': true,    // Allow transparency
    renderOrder: 20                  // Ensure text renders on top
  };
  
  // Load texture patterns for premium effects
  useEffect(() => {
    // Load foil pattern for full art cards
    if (isFullArt) {
      loadOptimizedTexture(FOIL_PATTERN_URL, {
        anisotropy: 16,
        colorSpace: THREE.SRGBColorSpace,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping
      }).then(texture => {
        texture.repeat.set(3, 3);
        foilTextureRef.current = texture;
      }).catch(error => {
        console.error('Failed to load foil texture:', error);
      });
    }
    
    // Load border pattern for all cards
    loadOptimizedTexture(CARD_BORDER_PATTERN, {
      anisotropy: 8,
      colorSpace: THREE.SRGBColorSpace,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    }).then(texture => {
      texture.repeat.set(4, 4);
      borderPatternRef.current = texture;
    }).catch(error => {
      console.error('Failed to load border pattern:', error);
    });
    
    return () => {
      // Don't dispose textures here as they're managed by the cache system
    };
  }, [isFullArt]);

  // Load the image texture using enhanced texture loading
  useEffect(() => {
    if (!cardData.normalImageUrl) return;
    
    // If we already have a texture for this URL in cache, use it
    const cacheKey = cardData.normalImageUrl;
    if (textureCache.has(cacheKey)) {
      cardTextureRef.current = textureCache.get(cacheKey) as THREE.Texture;
      setCardTextureLoaded(true);
      return;
    }
    
    // Check if we need to use the proxy URL for IPFS or other sources
    const isIPFS = cardData.normalImageUrl.includes('ipfs.io');
    const proxyUrl = isIPFS 
      ? `/api/proxy-image?url=${encodeURIComponent(cardData.normalImageUrl)}&timestamp=${Date.now()}&quality=high`
      : cardData.normalImageUrl;
    
    console.debug("Loading card image via:", isIPFS ? "proxy" : "direct", proxyUrl);
    
    loadOptimizedTexture(proxyUrl, {
      anisotropy: 16,
      colorSpace: THREE.SRGBColorSpace
    }).then(texture => {
      console.debug("Card image loaded successfully");
      // Store in ref and cache for reuse
      cardTextureRef.current = texture;
      textureCache.set(cacheKey, texture);
      setCardTextureLoaded(true);
    }).catch(error => {
      console.error("Failed to load card image:", error);
      
      // Try fallback direct loading if proxy fails
      if (isIPFS) {
        console.debug("Trying direct IPFS URL as fallback");
        loadOptimizedTexture(cardData.normalImageUrl, {
          anisotropy: 16,
          colorSpace: THREE.SRGBColorSpace
        }).then(texture => {
          console.debug("Card image loaded successfully via direct URL");
          cardTextureRef.current = texture;
          textureCache.set(cacheKey, texture);
          setCardTextureLoaded(true);
        }).catch(directError => {
          console.error("All loading methods failed:", directError);
        });
      }
    });
    
    return () => {
      // Don't dispose textures here as they're managed by the cache system
    };
  }, [cardData.normalImageUrl]);
  
  // Material for premium elements
  const [holoMaterial, setHoloMaterial] = useState<THREE.Material | null>(null);
  
  // Create simpler material for premium and full-art cards
  useEffect(() => {
    if (!isFullArt) return;
    
    // Instead of complex shader, use simpler MeshBasicMaterial with animation
    const typeColorStr = getTypeColor(cardData.type);
    const color = new THREE.Color(typeColorStr);
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      side: THREE.FrontSide
    });
    
    setHoloMaterial(material);
    
    return () => {
      if (material) material.dispose();
    };
  }, [isFullArt, cardData.type]);
  
  // Animate material color to simulate holographic effect
  useFrame(({ clock }) => {
    if (holoMaterial && holoMaterial instanceof THREE.MeshBasicMaterial) {
      // Simple color animation based on time
      const t = clock.getElapsedTime();
      const hue = (Math.sin(t * 0.5) * 0.1) + 0.5;
      const saturation = 0.7;
      const lightness = 0.6;
      
      // Update color
      holoMaterial.color.setHSL(hue, saturation, lightness);
      holoMaterial.needsUpdate = true;
    }
  });
  
  // Position constants for text elements with improved layout
  const FRONT_OFFSET = 0.02; // Increased Z-offset for better depth separation
  
  // Card dimensions reference
  const cardWidth = 2.5;
  const cardHeight = 3.5;
  const SAFE_MARGIN = 0.15;    // Safe margin from card edges
  
  // Header section - moved inward to avoid edge clipping with clear separation
  const HEADER_Y = 1.45;        // Header Y position
  const NAME_X = -1.05 + SAFE_MARGIN;  // Card name X position - left aligned
  const NAME_END_X = 0.25;      // Where the name section ends
  const NAME_MAX_WIDTH = 1.2;   // Maximum width for name to avoid overlap
  const HP_TYPE_X = 0.6;        // Starting X position for right side elements
  const HP_X = 0.9 - SAFE_MARGIN;   // HP X position - right aligned
  const TYPE_X = 1.1 - SAFE_MARGIN;   // Type icon X position - far right
  
  // Image section for normal mode - reduced size to fit better
  const IMAGE_SIZE = 1.7;       // Square image size (slightly smaller)
  const IMAGE_Y = 0.3;          // Image Y position
  
  // Move section - positioned to avoid clipping at bottom
  const MOVE_BAR_Y = -0.8;      // Move bar Y position
  const MOVE_NAME_X = -0.9 + SAFE_MARGIN; // Move name X position
  const MOVE_DMG_X = 1.1 - SAFE_MARGIN;   // Move damage X position
  
  // Footer section - moved inward from edges
  const FOOTER_Y = -1.4;        // Footer Y position (moved up slightly)
  const WEAKNESS_X = -0.8;      // Weakness X position
  const RESISTANCE_X = 0.0;     // Resistance X position
  const RETREAT_X = 0.8;        // Retreat cost X position
  
  // Text styling - reduced font sizes for better fit
  const textColor = isFullArt ? "#ffffff" : "#000000";
  const textShadowWidth = isFullArt ? 0.02 : 0;
  const textShadowColor = "#000000";
  
  // Font sizes for different elements - consistent sizing
  const TITLE_FONT_SIZE = 0.18;  // Card name
  const HP_FONT_SIZE = 0.16;     // HP value
  const TYPE_ICON_SIZE = 0.25;   // Type emoji
  const MOVE_FONT_SIZE = 0.15;   // Move name 
  const DAMAGE_FONT_SIZE = 0.17; // Damage value
  const FOOTER_FONT_SIZE = 0.13; // Footer text
  
  // Background elements color (based on card type)
  const typeColor = getTypeColor(cardData.type);
  const lightTypeColor = getLightTypeColor(cardData.type);
  
  // Create shared material options
  const sharedMaterialProps = {
    envMapIntensity: 0.2,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  };
  
  // References for animated elements
  const headerRef = useRef<THREE.Mesh>(null);
  const imageFrameRef = useRef<THREE.Mesh>(null);
  const moveBarRef = useRef<THREE.Mesh>(null);
  
  // Subtle animation for card elements
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Very subtle animations for card elements in normal mode
    if (!isFullArt) {
      if (headerRef.current) {
        headerRef.current.position.z = FRONT_OFFSET / 3 + Math.sin(t * 1.5) * 0.002;
      }
      
      if (imageFrameRef.current) {
        imageFrameRef.current.position.z = FRONT_OFFSET / 6 + Math.sin(t * 1.2 + 0.5) * 0.002;
      }
      
      if (moveBarRef.current) {
        moveBarRef.current.position.z = FRONT_OFFSET / 3 + Math.sin(t * 1.3 + 1.0) * 0.002;
      }
    }
  });
  
  // Premium Material Factory
  const createPremiumMaterial = useMemo(() => {
    return (baseColor: string, options: {
      roughness?: number;
      metalness?: number;
      clearcoat?: number;
      opacity?: number;
      map?: THREE.Texture | null;
    } = {}) => {
      return new THREE.MeshPhysicalMaterial({
        ...sharedMaterialProps,
        color: baseColor,
        roughness: options.roughness ?? 0.3,
        metalness: options.metalness ?? 0.2,
        clearcoat: options.clearcoat ?? 0.1,
        map: options.map ?? null,
        opacity: options.opacity ?? 1.0,
      });
    };
  }, []);
  
  return (
    <>
      {/* NORMAL CARD MODE - Square image in center */}
      {!isFullArt && (
        <>
          {/* Pokemon-style header bar with premium border */}
          <Plane
            ref={headerRef}
            args={[cardWidth - 0.2, 0.48]}
            position={[0, HEADER_Y, FRONT_OFFSET / 3]}
            renderOrder={11}
            material={
              new THREE.MeshPhysicalMaterial({
                ...sharedMaterialProps,
                color: "#F5D76E",
                roughness: 0.3,
                metalness: 0.4,
                clearcoat: 0.2,
                clearcoatRoughness: 0.4,
                map: borderPatternRef.current || null
              })
            }
          />
          
          {/* Left side header (name area) - type color background */}
          <Plane
            args={[1.5, 0.38]}
            position={[NAME_END_X - 0.65, HEADER_Y, FRONT_OFFSET / 2.8]}
            renderOrder={12}
            material={createPremiumMaterial(typeColor, {
              roughness: 0.4,
              metalness: 0.2,
            })}
          />
          
          {/* Right side header (HP and type area) - type color background */}
          <Plane
            args={[0.85, 0.38]}
            position={[HP_TYPE_X + 0.1, HEADER_Y, FRONT_OFFSET / 2.7]}
            renderOrder={12}
            material={createPremiumMaterial(typeColor, {
              roughness: 0.4,
              metalness: 0.2,
            })}
          />
          
          {/* Add premium border around entire card */}
          <Plane
            args={[cardWidth - 0.05, cardHeight - 0.05]}
            position={[0, 0, FRONT_OFFSET / 10]}
            renderOrder={10}
            material={
              new THREE.MeshPhysicalMaterial({
                ...sharedMaterialProps,
                color: "#F5D76E",
                roughness: 0.3,
                metalness: 0.4,
                clearcoat: 0.3,
                clearcoatRoughness: 0.4,
                map: borderPatternRef.current || null
              })
            }
          />
          
          {/* Premium border frame for the image */}
          <Plane
            ref={imageFrameRef}
            args={[IMAGE_SIZE + 0.15, IMAGE_SIZE + 0.15]}
            position={[0, IMAGE_Y, FRONT_OFFSET / 6]}
            renderOrder={11}
            material={
              new THREE.MeshPhysicalMaterial({
                ...sharedMaterialProps,
                color: "#F5D76E",
                roughness: 0.3,
                metalness: 0.5,
                clearcoat: 0.3,
                clearcoatRoughness: 0.4,
                map: borderPatternRef.current || null
              })
            }
          />
          
          {/* Inner black line border */}
          <Plane
            args={[IMAGE_SIZE + 0.1, IMAGE_SIZE + 0.1]}
            position={[0, IMAGE_Y, FRONT_OFFSET / 5]}
            renderOrder={12}
            material={
              new THREE.MeshPhysicalMaterial({
                ...sharedMaterialProps,
                color: "#111111",
                roughness: 0.5,
                metalness: 0.0
              })
            }
          />
          
          {/* === ARTWORK LAYER: High-resolution NFT image with premium rendering === */}
          <Plane
            args={[IMAGE_SIZE, IMAGE_SIZE]}
            position={[0, IMAGE_Y, FRONT_OFFSET + 0.001]} // Ensure it's on very top
            renderOrder={15} // Just below text layer
            material={
              cardTextureRef.current ? 
                new THREE.MeshPhysicalMaterial({
                  ...sharedMaterialProps,
                  map: cardTextureRef.current,
                  toneMapped: false,           // Better color reproduction
                  color: 0xffffff,             // Pure white base to show true colors
                  roughness: 0.2,              // Slightly glossy finish for vibrant look
                  metalness: 0.1,              // Very subtle premium quality
                  clearcoat: 0.1,              // Very subtle clearcoat
                  clearcoatRoughness: 0.7,     // Rough clearcoat for paper effect
                  envMapIntensity: 0.4        // Enhanced reflections
                }) : 
                new THREE.MeshPhysicalMaterial({
                  ...sharedMaterialProps,
                  color: lightTypeColor,
                  roughness: 0.3,
                  metalness: 0.1
                })
            }
          />
          
          {/* Move container with premium design */}
          <Plane
            ref={moveBarRef}
            args={[cardWidth - 0.2, 0.5]}
            position={[0, MOVE_BAR_Y, FRONT_OFFSET / 3]}
            renderOrder={11}
            material={
              new THREE.MeshPhysicalMaterial({
                ...sharedMaterialProps,
                color: "#F5D76E",
                roughness: 0.3,
                metalness: 0.4,
                clearcoat: 0.2,
                clearcoatRoughness: 0.4,
                map: borderPatternRef.current || null
              })
            }
          />
          
          {/* Inner move container with light color */}
          <Plane
            args={[cardWidth - 0.3, 0.4]}
            position={[0, MOVE_BAR_Y, FRONT_OFFSET / 2.5]}
            renderOrder={12}
            material={
              new THREE.MeshPhysicalMaterial({
                ...sharedMaterialProps,
                color: "#f8f8f8",
                roughness: 0.5,
                metalness: 0.0,
                clearcoat: 0.05,
                clearcoatRoughness: 0.9
              })
            }
          />
          
          {/* Move type energy symbol */}
          <Plane
            args={[0.25, 0.25]}
            position={[-1.0, MOVE_BAR_Y, FRONT_OFFSET / 2]}
            renderOrder={13}
            material={isFullArt && holoMaterial ? 
              holoMaterial : 
              createPremiumMaterial(typeColor, {
                roughness: 0.3,
                metalness: 0.4,
                clearcoat: 0.2
              })
            }
          />
          
          
          {/* Footer container */}
          <Plane
            args={[cardWidth - 0.3, 0.35]}
            position={[0, FOOTER_Y, FRONT_OFFSET / 3]}
            renderOrder={11}
            material={
              new THREE.MeshPhysicalMaterial({
                ...sharedMaterialProps,
                color: "#f5f5f5",
                roughness: 0.5,
                metalness: 0.0,
                clearcoat: 0.05,
                clearcoatRoughness: 0.9
              })
            }
          />
        </>
      )}
      
      {/* FULL ART MODE - Add subtle premium overlay with holographic effect */}
      {isFullArt && holoMaterial && (
        <Plane
          args={[cardWidth - 0.1, cardHeight - 0.1]}
          position={[0, 0, FRONT_OFFSET / 2]}
          renderOrder={15}
          material={holoMaterial}
        />
      )}
      
      {/* === TEXT ELEMENTS (identical for both modes but with enhanced quality) === */}
      
      {/* === TEXT LAYER: Card Name - ultra-clear text rendering === */}
      <Text 
        {...textOptions}
        position={[NAME_X, HEADER_Y, FRONT_OFFSET + 0.01]} 
        fontSize={cardData.cardName.length > 12 ? TITLE_FONT_SIZE * 0.8 : TITLE_FONT_SIZE}
        color={isFullArt ? "#ffffff" : "#000000"}  // White for full-art, black for normal
        fontWeight="bold"
        anchorX="left"
        maxWidth={NAME_MAX_WIDTH}
        textAlign="left"
        outlineWidth={isFullArt ? 0.025 : 0}  // Enhanced shadow for full-art
        outlineColor={isFullArt ? "#000000" : undefined}
        outlineBlur={isFullArt ? 0.001 : 0}   // Subtle blur for softer edges
        overflowWrap={"break-word"}
        fillOpacity={1}  // Full opacity for clarity
        renderOrder={25}  // Highest render order for text
      >
        {cardData.cardName}
      </Text>
      
      {/* HP text - right aligned in its own section */}
      <Text 
        {...textOptions}
        position={[HP_X, HEADER_Y, FRONT_OFFSET + 0.01]} 
        fontSize={HP_FONT_SIZE}
        color={isFullArt ? "#ffffff" : "#000000"}  // White for full-art, black for normal
        fontWeight="bold"
        anchorX="right"
        outlineWidth={isFullArt ? 0.025 : 0}  // Enhanced shadow for full-art
        outlineColor={isFullArt ? "#000000" : undefined}
        outlineBlur={isFullArt ? 0.001 : 0}   // Subtle blur for softer edges
        renderOrder={25}
      >
        {cardData.hp}
      </Text>
      
      {/* Type icon - far right in its own section - emoji shown as is */}
      <Text 
        {...textOptions}
        position={[TYPE_X, HEADER_Y, FRONT_OFFSET + 0.01]} 
        fontSize={TYPE_ICON_SIZE}
        anchorX="right"
        outlineWidth={0}  // No shadow for emoji
        renderOrder={25}
      >
        {cardData.type}
      </Text>
      
      {/* Move section - Icon, name and damage */}
      <Text 
        {...textOptions}
        position={[-0.7, MOVE_BAR_Y, FRONT_OFFSET + 0.01]} 
        fontSize={MOVE_FONT_SIZE}
        color={isFullArt ? "#ffffff" : "#000000"}  // White for full-art, black for normal
        fontWeight="bold"
        anchorX="left"
        maxWidth={1.4}
        textAlign="left"
        outlineWidth={isFullArt ? 0.025 : 0}  // Enhanced shadow for full-art
        outlineColor={isFullArt ? "#000000" : undefined}
        outlineBlur={isFullArt ? 0.001 : 0}   // Subtle blur for softer edges
        renderOrder={25}
      >
        {cardData.move.name}
      </Text>
      
      <Text 
        {...textOptions}
        position={[MOVE_DMG_X, MOVE_BAR_Y, FRONT_OFFSET + 0.01]} 
        fontSize={DAMAGE_FONT_SIZE}
        color={isFullArt ? "#ffffff" : "#000000"}  // White for full-art, black for normal
        fontWeight="bold"
        anchorX="right"
        outlineWidth={isFullArt ? 0.025 : 0}  // Enhanced shadow for full-art
        outlineColor={isFullArt ? "#000000" : undefined}
        outlineBlur={isFullArt ? 0.001 : 0}   // Subtle blur for softer edges
        renderOrder={25}
      >
        {cardData.move.damage}
      </Text>
      
      {/* Energy type symbol text inside the circle - emoji shown as is */}
      <Text 
        {...textOptions}
        position={[-1.0, MOVE_BAR_Y, FRONT_OFFSET + 0.01]} 
        fontSize={0.15}
        fontWeight="bold"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0}  // No shadow for emoji
        renderOrder={25}
      >
        {cardData.type}
      </Text>
      
      {/* Footer - Weakness, Resistance, Retreat Cost */}
      <Text 
        {...textOptions}
        position={[WEAKNESS_X, FOOTER_Y, FRONT_OFFSET + 0.01]} 
        fontSize={FOOTER_FONT_SIZE}
        color={isFullArt ? "#ffffff" : "#000000"}  // White for full-art, black for normal
        anchorX="center"
        textAlign="center"
        outlineWidth={isFullArt ? 0.025 : 0}  // Enhanced shadow for full-art
        outlineColor={isFullArt ? "#000000" : undefined}
        outlineBlur={isFullArt ? 0.001 : 0}   // Subtle blur for softer edges
        renderOrder={25}
      >
        {cardData.weakness}
      </Text>
      
      <Text 
        {...textOptions}
        position={[RESISTANCE_X, FOOTER_Y, FRONT_OFFSET + 0.01]} 
        fontSize={FOOTER_FONT_SIZE}
        color={isFullArt ? "#ffffff" : "#000000"}  // White for full-art, black for normal
        anchorX="center"
        textAlign="center"
        outlineWidth={isFullArt ? 0.025 : 0}  // Enhanced shadow for full-art
        outlineColor={isFullArt ? "#000000" : undefined}
        outlineBlur={isFullArt ? 0.001 : 0}   // Subtle blur for softer edges
        renderOrder={25}
      >
        {cardData.resistance}
      </Text>
      
      <Text 
        {...textOptions}
        position={[RETREAT_X, FOOTER_Y, FRONT_OFFSET + 0.01]} 
        fontSize={FOOTER_FONT_SIZE}
        color={isFullArt ? "#ffffff" : "#000000"}  // White for full-art, black for normal
        anchorX="center"
        textAlign="center"
        outlineWidth={isFullArt ? 0.025 : 0}  // Enhanced shadow for full-art
        outlineColor={isFullArt ? "#000000" : undefined}
        outlineBlur={isFullArt ? 0.001 : 0}   // Subtle blur for softer edges
        renderOrder={25}
      >
        {cardData.rarity}
      </Text>
      
      {/* Add glow effect for rare cards */}
      {cardData.rarity === '⭐⭐⭐' && (
        <pointLight
          position={[0, 0, 0.5]}
          distance={1.5}
          intensity={0.3}
          color={typeColor}
        />
      )}
    </>
  );
};