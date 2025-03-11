import { useState, useEffect } from 'react';
import { CardScene, LayeredCardSceneWrapper } from '@/components/CardScene';
import { GalleryView } from '@/components/Gallery';
import { useCardData } from '@/hooks';
import { PLACEHOLDER_IMAGES } from '@/config/constants';
import api from '@/utils/api';
import { useParams, useNavigate } from 'react-router-dom';
import './HomePage.css';

export const HomePage = () => {
  // Get URL parameter if available
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  // Initialize with URL parameter or default token
  const [tokenId, setTokenId] = useState<string | null>(id || '1834');
  const [tokenIdInput, setTokenIdInput] = useState(id || '1834');
  const [isFullArt, setIsFullArt] = useState(false);
  const [isGlossyCard, setIsGlossyCard] = useState(true); // Default to glossy enabled
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // Use the card data hook
  const {
    cardData,
    isLoading,
    isGenerating,
    isPolling,
    error,
    fullArtReady,
    setFullArtReady,
    refreshCardData,
    generateNewArtForCard
  } = useCardData(tokenId);
  
  // Create a placeholder card for initial state
  const placeholderCard = {
    cardName: 'Enter an Azuki ID',
    hp: '100 HP',
    type: '🔥',
    move: {
      name: 'Flame Dance',
      damage: '40'
    },
    weakness: '💧 x2',
    resistance: '🪨 -20',
    retreatCost: '🌟',
    rarity: '★★★',
    normalImageUrl: PLACEHOLDER_IMAGES.NORMAL,
    fullArtImageUrl: null,
    cardColor: '#ff5722',
    traits: 'Enter an Azuki ID to generate a card'
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate token ID
    const tokenIdValue = parseInt(tokenIdInput.trim());
    if (isNaN(tokenIdValue) || tokenIdValue < 0 || tokenIdValue > 9999) {
      // TODO: Show error message
      return;
    }
    
    // Set token ID to trigger data fetching
    const newTokenId = tokenIdValue.toString();
    setTokenId(newTokenId);
    
    // Update URL without reloading the page
    navigate(`/nft/${newTokenId}`, { replace: true });
  };
  
  // Effect to sync with URL parameters when they change
  useEffect(() => {
    if (id && id !== tokenId) {
      setTokenId(id);
      setTokenIdInput(id);
    }
  }, [id]);
  
  // Effect to automatically switch to full art view when full art is ready
  useEffect(() => {
    if (fullArtReady && cardData?.fullArtImageUrl) {
      setIsFullArt(true);
      // Reset the flag to avoid repeating this effect if component re-renders
      setFullArtReady(false);
    }
  }, [fullArtReady, cardData?.fullArtImageUrl]);
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenIdInput(e.target.value);
  };
  
  // Toggle full art view
  const handleFullArtToggle = () => {
    setIsFullArt(!isFullArt);
  };
  
  // Toggle card effects
  const [showNormalMap, setShowNormalMap] = useState(true);
  const [showRoughnessMap, setShowRoughnessMap] = useState(true);
  const [showEdgeHighlight, setShowEdgeHighlight] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  
  // Toggle glossy card effect
  const handleGlossyToggle = () => {
    setIsGlossyCard(!isGlossyCard);
  };
  
  // Toggle normal map effect
  const handleNormalMapToggle = () => {
    setShowNormalMap(!showNormalMap);
  };
  
  // Toggle roughness map effect
  const handleRoughnessMapToggle = () => {
    setShowRoughnessMap(!showRoughnessMap);
  };
  
  // Toggle edge highlight effect
  const handleEdgeHighlightToggle = () => {
    setShowEdgeHighlight(!showEdgeHighlight);
  };
  
  // Toggle particles effect
  const handleParticlesToggle = () => {
    setShowParticles(!showParticles);
  };
  
  // Generate new art
  const handleGenerateNewArt = () => {
    if (tokenId) {
      // Show a confirm dialog explaining this might take time
      if (window.confirm(
        "Generating new art may take some time (up to 1-2 minutes or more). " +
        "The button will show 'Generating...' while it's processing. " +
        "Would you like to continue?"
      )) {
        // Auto-switch to normal card mode when generating to show progress indicators
        setIsFullArt(false);
        generateNewArtForCard();
      }
    }
  };
  
  // Open gallery
  const handleOpenGallery = () => {
    setIsGalleryOpen(true);
  };
  
  // Close gallery
  const handleCloseGallery = () => {
    setIsGalleryOpen(false);
  };
  
  // Select an item from the gallery
  const handleSelectGalleryItem = (selectedTokenId: string) => {
    // First close the gallery
    setIsGalleryOpen(false);
    
    // Wait for current data to be cleared before setting new token
    setTimeout(() => {
      // Reset any previous full art flag to avoid race conditions
      setFullArtReady(false);
      
      // Update token ID input and state
      setTokenIdInput(selectedTokenId);
      setTokenId(selectedTokenId);
      
      // Update URL to reflect the selected token
      navigate(`/nft/${selectedTokenId}`, { replace: true });
      
      // Add a slight delay before showing full art to ensure data has loaded properly
      setTimeout(() => {
        setIsFullArt(true); // Show full art after a small delay
      }, 100);
    }, 50);
  };
  
  // No unused functions
  
  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Azuki TCG Generator</h1>
        <span className="version-badge">v1.0.0</span>
        {isPolling && (
          <div className="global-status-indicator">
            <span className="status-spinner"></span>
            <span>AI generating art...</span>
          </div>
        )}
      </header>
      
      <main className="home-main">
        <section className="card-section">
          <form className="card-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="number"
                id="token-id"
                value={tokenIdInput}
                onChange={handleInputChange}
                placeholder="Enter Azuki ID (0-9999)"
                min="0"
                max="9999"
                required
              />
              <button 
                type="submit" 
                className={`primary-button ${isLoading ? 'loading-button' : ''}`}
                disabled={isLoading || isGenerating}
              >
                {isLoading ? (
                  <>
                    <span className="button-spinner"></span>
                    <span>Loading...</span>
                  </>
                ) : 'Generate Card'}
              </button>
            </div>
            
            <div className="action-buttons">
              <button 
                type="button"
                className="secondary-button"
                onClick={handleOpenGallery}
                disabled={isLoading || isGenerating}
              >
                <span className="button-icon">🖼️</span> Gallery
              </button>
              
              {isGenerating && (
                <div className="generating-status">
                  <span className="status-spinner"></span>
                  <span>Generating card art, please wait...</span>
                </div>
              )}
            </div>
          </form>
          
          <div className="card-display">
            {error ? (
              <div className="error-message">
                <div className="error-icon">❌</div>
                <p>{error}</p>
                <button 
                  onClick={() => tokenId && refreshCardData()}
                  className="retry-button"
                >
                  Retry
                </button>
              </div>
            ) : (
              <LayeredCardSceneWrapper
                cardData={cardData || placeholderCard}
                isFullArt={isFullArt}
                onFullArtToggle={handleFullArtToggle}
                onGenerateNewArt={handleGenerateNewArt}
                isGenerating={isGenerating}
                isGlossyCard={isGlossyCard}
                onGlossyToggle={handleGlossyToggle}
                showNormalMap={showNormalMap}
                showRoughnessMap={showRoughnessMap}
                showEdgeHighlight={showEdgeHighlight}
                showParticles={showParticles}
                onNormalMapToggle={handleNormalMapToggle}
                onRoughnessMapToggle={handleRoughnessMapToggle}
                onEdgeHighlightToggle={handleEdgeHighlightToggle}
                onParticlesToggle={handleParticlesToggle}
              />
            )}
            
            {isPolling && (
              <div className="polling-indicator">
                <span className="polling-spinner"></span>
                <span>AI generating full art... please wait</span>
              </div>
            )}
          </div>
          
          <div className="card-info">
            {cardData && (
              <>
                <div className="card-info-header">
                  <div className="nft-id">Azuki #{tokenId}</div>
                  {cardData.normalImageUrl && (
                    <div className="nft-image-container">
                      <img 
                        src={cardData.normalImageUrl} 
                        alt={`Azuki #${tokenId}`} 
                        className="nft-preview-image" 
                      />
                    </div>
                  )}
                </div>
                
                <div className="card-details">
                  <h3 className="details-header">Traits</h3>
                  <div className="traits">{cardData.traits}</div>
                </div>
                
                <div className="card-stats">
                  <div className="stat-item">
                    <span className="stat-label">Type</span>
                    <span className="stat-value">{cardData.type}</span>
                  </div>
                  
                  <div className="stat-item">
                    <span className="stat-label">HP</span>
                    <span className="stat-value">{cardData.hp}</span>
                  </div>
                  
                  <div className="stat-item">
                    <span className="stat-label">Move</span>
                    <span className="stat-value">{cardData.move.name} ({cardData.move.damage})</span>
                  </div>
                  
                  <div className="stat-item">
                    <span className="stat-label">Weakness</span>
                    <span className="stat-value">{cardData.weakness}</span>
                  </div>
                  
                  <div className="stat-item">
                    <span className="stat-label">Resistance</span>
                    <span className="stat-value">{cardData.resistance}</span>
                  </div>
                </div>
                
                {isPolling && (
                  <div className="card-info-status">
                    <div className="progress-bar">
                      <div className="progress-fill"></div>
                    </div>
                    <div className="status-message">AI is generating full art using the character description...</div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      
      {isGalleryOpen && (
        <GalleryView
          onSelectItem={handleSelectGalleryItem}
          onClose={handleCloseGallery}
        />
      )}
    </div>
  );
};