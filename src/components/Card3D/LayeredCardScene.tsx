import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { LayeredCard3D } from './LayeredCard3D';
import { CardData } from '@/types';

interface LayeredCardSceneProps {
  cardData: CardData;
  isLoading?: boolean;
  isFullArt?: boolean;
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

export const LayeredCardScene = ({
  cardData,
  isLoading = false,
  isFullArt = false,
  showHoloFoil = true,
  showNormalMap = true,
  showRoughnessMap = true,
  showEdgeHighlight = true,
  showParticles = true,
  onImageLoadStart,
  onImageLoadComplete,
  onImageLoadError,
  quality = 'medium'
}: LayeredCardSceneProps) => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)' }}
      >
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 6]}
          fov={40}
        />
        
        <ambientLight intensity={0.5} />
        
        {/* Main light */}
        <directionalLight
          position={[10, 10, 10]}
          intensity={0.8}
          castShadow
        />
        
        {/* Fill light for card edges */}
        <pointLight
          position={[-5, -5, 3]}
          intensity={0.3}
          distance={15}
          color="#ffffff"
        />
        
        {/* Accent light for glossy effect */}
        <spotLight
          position={[0, 5, 8]}
          intensity={0.5}
          angle={0.5}
          penumbra={0.8}
          distance={20}
          color="#f0f0ff"
        />
        
        <Suspense fallback={null}>
          <LayeredCard3D
            cardData={cardData}
            isFullArt={isFullArt}
            isLoading={isLoading}
            showHoloFoil={showHoloFoil}
            showNormalMap={showNormalMap}
            showRoughnessMap={showRoughnessMap}
            showEdgeHighlight={showEdgeHighlight}
            showParticles={showParticles}
            onImageLoadStart={onImageLoadStart}
            onImageLoadComplete={onImageLoadComplete}
            onImageLoadError={onImageLoadError}
            quality={quality}
          />
        </Suspense>
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={8}
        />
      </Canvas>
    </div>
  );
};