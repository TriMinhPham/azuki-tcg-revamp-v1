import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useProgress, Html } from '@react-three/drei';
import { Card3D } from '@/components/Card3D';
import { CardData } from '@/types';
import * as THREE from 'three';
import './CardScene.css';

// Simple placeholder card component
function PlaceholderCard() {
  return (
    <mesh rotation={[0, 0.5, 0]} position={[0, 0, 0]}>
      <boxGeometry args={[2.5, 3.5, 0.1]} />
      <meshStandardMaterial color="#3498db" />
    </mesh>
  );
}

interface CardSceneProps {
  cardData: CardData;
  isFullArt: boolean;
  onFullArtToggle: () => void;
  onGenerateNewArt?: () => void;
  isGenerating?: boolean;
}

// Custom loading indicator that doesn't rely on useProgress
function Loader() {
  const [loadingPercent, setLoadingPercent] = useState(0);
  
  // Simulate loading progress
  useEffect(() => {
    let interval: any;
    let currentPercent = 0;
    
    // Increment progress from 0 to 100
    interval = setInterval(() => {
      // Faster at the beginning, slower at the end
      const increment = currentPercent < 70 ? 5 : (currentPercent < 90 ? 2 : 1);
      currentPercent = Math.min(99, currentPercent + increment);
      setLoadingPercent(currentPercent);
      
      // Clear interval at 99% (we'll set 100% when actually loaded)
      if (currentPercent >= 99) {
        clearInterval(interval);
      }
    }, 100);
    
    return () => {
      clearInterval(interval);
      setLoadingPercent(100); // Complete when unmounted
    };
  }, []);
  
  return (
    <Html center>
      <div className="card-scene-loader">
        <div className="loader-spinner"></div>
        <div className="loader-progress">{loadingPercent}%</div>
      </div>
    </Html>
  );
}

export const CardScene = ({
  cardData,
  isFullArt,
  onFullArtToggle,
  onGenerateNewArt,
  isGenerating = false
}: CardSceneProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Debug the component props
  console.debug('CardScene rendered with:', { 
    cardName: cardData.cardName,
    normalImage: cardData.normalImageUrl,
    fullArtImage: cardData.fullArtImageUrl,
    isFullArt,
    isGenerating
  });
  
  // Handle image loading states
  const handleImageLoadStart = () => {
    setIsLoading(true);
    setError(null);
  };
  
  const handleImageLoadComplete = () => {
    setIsLoading(false);
  };
  
  const handleImageLoadError = (error: Error) => {
    setError(error.message);
    setIsLoading(false);
  };

  return (
    <div className="card-scene-container">
      {error && (
        <div className="card-scene-error">
          <p>{error}</p>
        </div>
      )}
      
      <div className="card-scene-canvas">
        <Canvas
          ref={canvasRef}
          shadows
          camera={{ position: [0, 0, 5], fov: 40 }} // Narrower field of view for less distortion
          dpr={[1, 2]} // Responsive to device pixel ratio
          gl={{ 
            antialias: true,  // Ensure antialiasing is enabled
            alpha: true,      // Allow transparency
            preserveDrawingBuffer: true // Needed for screenshots
          }}
        >
          {/* Simple dark background */}
          <color attach="background" args={['#1a1a2e']} />
          
          <Suspense fallback={<Loader />}>
            {/* Show placeholder card during loading */}
            {isLoading ? (
              <PlaceholderCard />
            ) : (
              <Card3D
                cardData={cardData}
                isFullArt={isFullArt}
                isLoading={isLoading}
                onImageLoadStart={handleImageLoadStart}
                onImageLoadComplete={handleImageLoadComplete}
                onImageLoadError={handleImageLoadError}
              />
            )}
            
            {/* Very basic camera controls */}
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              maxDistance={8}
              minDistance={3}
            />
          </Suspense>
        </Canvas>
      </div>
      
      <div className="card-scene-controls">
        <button 
          className="card-toggle-button"
          onClick={onFullArtToggle}
          disabled={isLoading || isGenerating}
        >
          {isFullArt ? 'Show Normal Card' : 'Show Full Art'}
        </button>
        
        {isFullArt && onGenerateNewArt && (
          <button
            className="generate-art-button"
            onClick={onGenerateNewArt}
            disabled={isLoading || isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate New Art'}
          </button>
        )}
      </div>
    </div>
  );
};