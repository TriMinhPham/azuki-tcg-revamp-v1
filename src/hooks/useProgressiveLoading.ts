import { useState, useEffect, useRef, useCallback } from 'react';
import { preloadTextures } from '@/utils/textureLoader';

/**
 * Loading stage types for progressive loading
 */
export type LoadingStage = 
  | 'not-started' 
  | 'layout-ready'
  | 'basic-textures' 
  | 'full-textures'
  | 'effects-ready'
  | 'complete';

/**
 * Progress state for loading resources
 */
export interface ProgressState {
  stage: LoadingStage;
  percent: number;
  isLoading: boolean;
  isComplete: boolean;
  error: string | null;
}

/**
 * Configuration for progressive loading behavior
 */
export interface ProgressiveLoadingConfig {
  /** Initial delay before starting to load (ms) */
  initialDelay?: number;
  /** Whether to start loading automatically */
  autoStart?: boolean;
  /** Enable verbose logging */
  debug?: boolean;
  /** Callback when loading completes */
  onComplete?: () => void;
  /** Callback when loading errors */
  onError?: (error: Error) => void;
}

/**
 * Hook to implement progressive loading of 3D content
 */
export function useProgressiveLoading(config: ProgressiveLoadingConfig = {}) {
  // Merge with default config
  const defaultConfig = {
    initialDelay: 100,
    autoStart: true,
    debug: false
  };
  
  const {
    initialDelay,
    autoStart,
    debug,
    onComplete,
    onError
  } = { ...defaultConfig, ...config };
  
  // Loading state
  const [progress, setProgress] = useState<ProgressState>({
    stage: 'not-started',
    percent: 0,
    isLoading: false,
    isComplete: false,
    error: null
  });
  
  // References for resource URLs
  const basicTextures = useRef<string[]>([]);
  const fullTextures = useRef<string[]>([]);
  const effectTextures = useRef<string[]>([]);
  
  // Track loading stages
  const loadingTimeouts = useRef<number[]>([]);
  
  // Log progress if debug is enabled
  useEffect(() => {
    if (debug) {
      console.debug(`[ProgressiveLoading] Stage: ${progress.stage}, Progress: ${progress.percent}%`);
    }
  }, [progress, debug]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      loadingTimeouts.current.forEach(id => window.clearTimeout(id));
    };
  }, []);
  
  // Start loading process
  const startLoading = useCallback(async () => {
    if (progress.isLoading || progress.isComplete) return;
    
    try {
      // Mark as loading
      setProgress(prev => ({
        ...prev,
        isLoading: true,
        stage: 'layout-ready',
        percent: 10
      }));
      
      // Stage 1: Load basic textures
      if (debug) console.debug('[ProgressiveLoading] Loading basic textures...');
      
      const stage1Timeout = window.setTimeout(async () => {
        try {
          // Load basic textures (card frame, background)
          if (basicTextures.current.length > 0) {
            await preloadTextures(basicTextures.current, { priority: 'high' });
          }
          
          setProgress(prev => ({
            ...prev,
            stage: 'basic-textures',
            percent: 30
          }));
          
          // Stage 2: Load full textures
          if (debug) console.debug('[ProgressiveLoading] Loading full textures...');
          
          const stage2Timeout = window.setTimeout(async () => {
            try {
              // Load main textures (card image)
              if (fullTextures.current.length > 0) {
                await preloadTextures(fullTextures.current, { priority: 'normal' });
              }
              
              setProgress(prev => ({
                ...prev,
                stage: 'full-textures',
                percent: 70
              }));
              
              // Stage 3: Load effects
              if (debug) console.debug('[ProgressiveLoading] Loading effects...');
              
              const stage3Timeout = window.setTimeout(async () => {
                try {
                  // Load effect textures (holographic effects, particles)
                  if (effectTextures.current.length > 0) {
                    await preloadTextures(effectTextures.current, { priority: 'low' });
                  }
                  
                  // Mark as complete
                  setProgress({
                    stage: 'complete',
                    percent: 100,
                    isLoading: false,
                    isComplete: true,
                    error: null
                  });
                  
                  if (onComplete) onComplete();
                  if (debug) console.debug('[ProgressiveLoading] Loading complete!');
                } catch (error) {
                  handleError(error as Error);
                }
              }, 100); // Short delay before effects
              
              loadingTimeouts.current.push(stage3Timeout as unknown as number);
            } catch (error) {
              handleError(error as Error);
            }
          }, 100); // Short delay between textures
          
          loadingTimeouts.current.push(stage2Timeout as unknown as number);
        } catch (error) {
          handleError(error as Error);
        }
      }, initialDelay);
      
      loadingTimeouts.current.push(stage1Timeout as unknown as number);
    } catch (error) {
      handleError(error as Error);
    }
  }, [progress.isLoading, progress.isComplete, initialDelay, debug, onComplete, onError]);
  
  // Handle errors
  const handleError = useCallback((error: Error) => {
    if (debug) console.error('[ProgressiveLoading] Error:', error);
    
    setProgress(prev => ({
      ...prev,
      isLoading: false,
      error: error.message
    }));
    
    if (onError) onError(error);
  }, [debug, onError]);
  
  // Register textures for loading
  const registerTextures = useCallback((
    basic: string[] = [],
    full: string[] = [],
    effects: string[] = []
  ) => {
    basicTextures.current = [...basicTextures.current, ...basic];
    fullTextures.current = [...fullTextures.current, ...full];
    effectTextures.current = [...effectTextures.current, ...effects];
    
    if (debug) {
      console.debug(`[ProgressiveLoading] Registered textures: ${basic.length} basic, ${full.length} full, ${effects.length} effects`);
    }
  }, [debug]);
  
  // Auto-start loading if configured
  useEffect(() => {
    if (autoStart && progress.stage === 'not-started') {
      const startTimeout = window.setTimeout(() => {
        startLoading();
      }, 50);
      
      loadingTimeouts.current.push(startTimeout);
    }
  }, [autoStart, progress.stage, startLoading]);
  
  return {
    progress,
    registerTextures,
    startLoading
  };
}

/**
 * Helper hook to create a throttled loading state for complex scenes
 * This prevents too many objects from being loaded at once
 */
export function useThrottledLoading(
  batchSize: number = 3,
  delayBetweenBatches: number = 100
) {
  const [queue, setQueue] = useState<(() => void)[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  
  // Process the queue in batches
  const processQueue = useCallback(async () => {
    if (processingRef.current || queue.length === 0) return;
    
    processingRef.current = true;
    setIsProcessing(true);
    
    try {
      // Process a batch of loaders
      const batch = queue.slice(0, batchSize);
      const remainingQueue = queue.slice(batchSize);
      
      // Update the queue
      setQueue(remainingQueue);
      
      // Execute the batch loaders
      for (const loader of batch) {
        loader();
      }
      
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      
      // Continue processing if more items in queue
      processingRef.current = false;
      setIsProcessing(false);
      
      if (remainingQueue.length > 0) {
        processQueue();
      }
    } catch (error) {
      console.error('Error in throttled loading:', error);
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [queue, batchSize, delayBetweenBatches]);
  
  // Start processing when the queue changes
  useEffect(() => {
    if (queue.length > 0 && !isProcessing) {
      processQueue();
    }
  }, [queue, isProcessing, processQueue]);
  
  // Add a loader to the queue
  const queueLoader = useCallback((loader: () => void) => {
    setQueue(prev => [...prev, loader]);
  }, []);
  
  return {
    queueLoader,
    isProcessing,
    queueLength: queue.length
  };
}