import React, { useState, useEffect, useRef, Suspense } from 'react';
import { CardData } from '@/types';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { memoryManager } from '@/utils/memoryManager';
import { getRenderingStats } from '@/services/renderService';
import './CardScene.css';

// Lazy-loaded component for code-splitting
const LazyLayeredCardScene = React.lazy(() => 
  import('@/components/Card3D').then(module => ({ 
    default: module.LayeredCardScene 
  }))
);

interface LayeredCardSceneWrapperProps {
  cardData: CardData;
  isFullArt: boolean;
  onFullArtToggle: () => void;
  onGenerateNewArt?: () => void;
  isGenerating?: boolean;
  isGlossyCard?: boolean;
  onGlossyToggle?: () => void;
  showNormalMap?: boolean;
  showRoughnessMap?: boolean;
  showEdgeHighlight?: boolean;
  showParticles?: boolean;
  onNormalMapToggle?: () => void;
  onRoughnessMapToggle?: () => void;
  onEdgeHighlightToggle?: () => void;
  onParticlesToggle?: () => void;
  quality?: 'low' | 'medium' | 'high';
  showDebugInfo?: boolean;
}

export const LayeredCardSceneWrapper: React.FC<LayeredCardSceneWrapperProps> = ({
  cardData,
  isFullArt,
  onFullArtToggle,
  onGenerateNewArt,
  isGenerating = false,
  isGlossyCard = true,
  onGlossyToggle,
  showNormalMap = true,
  showRoughnessMap = true,
  showEdgeHighlight = true,
  showParticles = true,
  onNormalMapToggle,
  onRoughnessMapToggle,
  onEdgeHighlightToggle,
  onParticlesToggle,
  quality = 'medium',
  showDebugInfo = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  // Use progressive loading hook
  const { progress, startLoading } = useProgressiveLoading({
    autoStart: true,
    debug: showDebugInfo,
    onComplete: () => setIsLoading(false),
    onError: (err) => setLoadingError(err.message)
  });
  
  // Get memory stats periodically when debug mode is enabled
  useEffect(() => {
    if (!showDebugInfo) return;
    
    const updateStats = () => {
      setStats(getRenderingStats());
    };
    
    const statsInterval = setInterval(updateStats, 2000);
    updateStats(); // Initial update
    
    return () => {
      clearInterval(statsInterval);
    };
  }, [showDebugInfo]);
  
  // Handle image loading states
  const handleImageLoadStart = () => {
    setIsLoading(true);
    setLoadingError(null);
  };
  
  const handleImageLoadComplete = () => {
    setIsLoading(false);
  };
  
  const handleImageLoadError = (error: Error) => {
    setLoadingError(error.message);
    setIsLoading(false);
  };
  
  // Clear caches when unmounting
  useEffect(() => {
    return () => {
      // Clean up memory when component unmounts
      memoryManager.disposeUnused(0); // Force cleanup
    };
  }, []);

  return (
    <div className="card-scene-container">
      {/* Loading indicator */}
      {isLoading && (
        <div className="card-scene-loading">
          <div className="loading-indicator">
            <div className="loading-stage">
              {progress.stage !== 'not-started' && (
                <>Loading {progress.stage} ({Math.round(progress.percent)}%)</>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Error display */}
      {loadingError && (
        <div className="card-scene-error">
          <p>Error: {loadingError}</p>
        </div>
      )}
      
      {/* Debug stats */}
      {showDebugInfo && stats && (
        <div className="card-scene-debug">
          <div>Geometries: {stats.geometryCount}</div>
          <div>Materials: {stats.materialCount}</div>
          <div>Textures: {stats.textureCount}</div>
          <div>Memory: {(stats.estimatedMemoryUsage / (1024 * 1024)).toFixed(2)}MB</div>
        </div>
      )}
      
      <div className="card-scene-canvas">
        <Suspense fallback={<div className="card-scene-loading-fallback">Loading 3D components...</div>}>
          <LazyLayeredCardScene
            cardData={cardData}
            isFullArt={isFullArt}
            isLoading={isLoading}
            showHoloFoil={isGlossyCard}
            showNormalMap={showNormalMap}
            showRoughnessMap={showRoughnessMap}
            showEdgeHighlight={showEdgeHighlight}
            showParticles={showParticles}
            onImageLoadStart={handleImageLoadStart}
            onImageLoadComplete={handleImageLoadComplete}
            onImageLoadError={handleImageLoadError}
            quality={quality}
          />
        </Suspense>
      </div>
      
      <div className="card-scene-controls">
        <button 
          className="card-toggle-button"
          onClick={onFullArtToggle}
          disabled={isLoading || isGenerating}
        >
          {isFullArt ? 'Show Normal Card' : 'Show Full Art'}
        </button>
        
        {onGlossyToggle && (
          <button
            className="card-effect-button"
            onClick={onGlossyToggle}
            disabled={isLoading}
          >
            Glossy: {isGlossyCard ? 'ON' : 'OFF'}
          </button>
        )}
        
        {onNormalMapToggle && (
          <button
            className="card-effect-button"
            onClick={onNormalMapToggle}
            disabled={isLoading}
          >
            Normal: {showNormalMap ? 'ON' : 'OFF'}
          </button>
        )}
        
        {onRoughnessMapToggle && (
          <button
            className="card-effect-button"
            onClick={onRoughnessMapToggle}
            disabled={isLoading}
          >
            Roughness: {showRoughnessMap ? 'ON' : 'OFF'}
          </button>
        )}
        
        {onEdgeHighlightToggle && (
          <button
            className="card-effect-button"
            onClick={onEdgeHighlightToggle}
            disabled={isLoading}
          >
            Edge: {showEdgeHighlight ? 'ON' : 'OFF'}
          </button>
        )}
        
        {onParticlesToggle && (
          <button
            className="card-effect-button"
            onClick={onParticlesToggle}
            disabled={isLoading}
          >
            Particles: {showParticles ? 'ON' : 'OFF'}
          </button>
        )}
        
        {isFullArt && onGenerateNewArt && (
          <button
            className="generate-art-button"
            onClick={onGenerateNewArt}
            disabled={isLoading || isGenerating || (!cardData.fullArtImageUrl && isFullArt)}
          >
            {isGenerating ? 'Generating...' : 'Generate New Art'}
          </button>
        )}
      </div>
    </div>
  );
};