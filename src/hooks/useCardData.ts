/**
 * Hook for managing card data fetching and state
 */
import { useState, useEffect, useCallback } from 'react';
import { CardData, CardResponse } from '@/types';
import { 
  fetchCard, 
  checkCardStatus, 
  generateNewCardArt, 
  transformResponseToCardData 
} from '@/services/cardService';

/**
 * Custom hook to manage card data fetching and status polling
 * @param tokenId The Azuki token ID to fetch
 * @returns Object containing card data and status information
 */
export const useCardData = (tokenId: string | null) => {
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [fullArtReady, setFullArtReady] = useState(false);
  
  // Function to fetch initial card data
  const loadCardData = useCallback(async () => {
    if (!tokenId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`[DEBUG] Fetching card data for token #${tokenId}`);
      const response = await fetchCard(tokenId);
      
      // DEBUG: Log the full response to understand what we're getting
      console.log('[DEBUG] Card API response:', response);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch card data');
      }
      
      // Check for important fields
      if (!response.nftImage) {
        console.warn('[DEBUG] Missing nftImage in response!', response);
      }
      
      const newCardData = transformResponseToCardData(response, tokenId);
      console.log('[DEBUG] Transformed card data:', newCardData);
      setCardData(newCardData);
      
      // Start polling if full art is being processed
      if (response.fullArtProcessing) {
        setIsPolling(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching card data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tokenId]);
  
  // Function to poll for full art status
  const pollFullArtStatus = useCallback(async () => {
    if (!tokenId || !isPolling) return;
    
    try {
      console.debug('Polling for full art status for token', tokenId);
      const response = await checkCardStatus(tokenId);
      
      if (!response.success) {
        console.warn('Full art status check failed:', response.error);
        return;
      }
      
      console.debug('Full art status response:', response);
      
      // If we have a progress indicator, update the UI (could add a progress state here)
      if (response && response.progress !== undefined) {
        console.debug(`Generation progress: ${response.progress}%`);
      }
      
      // Check various conditions that indicate completion
      const isCompleted = 
        (response.imageStatus === 'complete') ||
        (response.completed === true) ||
        (response.processing === false && response.fullArtUrl) ||
        (response.progress === 100 && response.fullArtUrl);
      
      if (response.fullArtUrl) {
        console.log('Full art is now available:', response.fullArtUrl);
        
        // Update the current card data with the new full art URL
        if (cardData) {
          const updatedCardData = {
            ...cardData,
            fullArtImageUrl: response.fullArtUrl,
            // Also include all image variants if available
            ...(response.allImageUrls && response.allImageUrls.length > 0 
              ? { allArtImageUrls: response.allImageUrls } 
              : {})
          };
          
          setCardData(updatedCardData);
          console.log('Updated existing card data with new full art URL');
          
          // If the generation is complete, stop polling and signal full art is ready
          if (isCompleted) {
            setIsPolling(false);
            setFullArtReady(true); // Signal that full art is ready to display
            console.log('Full art generation complete, stopping polling');
          }
        } else {
          // If we don't have card data yet, fetch fresh card data
          console.log('No existing card data, fetching fresh card data');
          
          try {
            // Directly fetch the card data
            const cardResponse = await fetchCard(tokenId);
            
            if (cardResponse.success) {
              // Create card data with the full art URL included
              const newCardData = transformResponseToCardData({
                ...cardResponse,
                fullArtUrl: response.fullArtUrl  // Use the URL from the status check
              }, tokenId);
              
              setCardData(newCardData);
              setIsPolling(false);
              console.log('Created new card data with full art URL');
            } else {
              console.warn('Failed to fetch card data during polling');
            }
          } catch (fetchError) {
            console.error('Error fetching card data during polling:', fetchError);
          }
        }
      } else {
        console.debug('Full art not yet available, continuing to poll');
        
        // Even if no full art URL is available yet, check if polling should stop
        if (isCompleted) {
          setIsPolling(false);
          console.log('Art generation process completed but no full art URL available, stopping polling');
        }
      }
    } catch (err) {
      console.error('Error checking full art status:', err);
    }
  }, [tokenId, isPolling, cardData]);
  
  // Function to generate new art
  const generateNewArtForCard = useCallback(async () => {
    if (!tokenId) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await generateNewCardArt(tokenId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate new art');
      }
      
      // Check if the generation is happening in the background
      if (response.processingStarted) {
        console.log('Art generation started in background, enabling polling...');
        setIsPolling(true);
        
        // Show a notification to the user
        alert('Art generation has been started in the background. The card will update automatically when ready. You can check the status in the gallery.');
        
      } else if (response.message && response.message.includes('already in progress')) {
        console.log('Art generation already in progress, enabling polling...');
        setIsPolling(true);
        
        // Show a notification to the user
        alert('Art generation is already in progress. The card will update automatically when ready. You can check the status in the gallery.');
      } else {
        // If the response contains completed art, reload the card data
        await loadCardData();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate new art';
      setError(errorMessage);
      console.error('Error generating new art:', err);
      
      // Check if it's a timeout error and provide a special message
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        alert('The art generation request is taking longer than expected. The process will continue in the background and you can check the gallery later for the new art.');
        setIsPolling(true); // Enable polling anyway to check for updates
      }
    } finally {
      setIsGenerating(false);
    }
  }, [tokenId, loadCardData]);
  
  // Load card data when tokenId changes
  useEffect(() => {
    if (tokenId) {
      // Reset fullArtReady flag when loading a new card
      setFullArtReady(false);
      setIsLoading(true); // Start loading immediately to show loading state
      loadCardData();
    }
  }, [tokenId, loadCardData]);
  
  // Poll for full art status
  useEffect(() => {
    if (!isPolling) return;
    
    // Initial poll immediately when polling starts
    pollFullArtStatus();
    
    // Then continue with regular interval
    const pollInterval = setInterval(pollFullArtStatus, 4000);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [isPolling, pollFullArtStatus]);
  
  return {
    cardData,
    isLoading,
    isGenerating,
    isPolling,
    error,
    fullArtReady,
    setFullArtReady, // Allow components to reset this state
    refreshCardData: loadCardData,
    generateNewArtForCard
  };
};