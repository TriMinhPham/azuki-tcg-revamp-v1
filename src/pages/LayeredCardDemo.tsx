import { useState, useEffect } from 'react';
import { CardData } from '@/types';
import { LayeredCardScene } from '@/components/Card3D';

// For actual production app, these would be loaded from an API or database
const GALLERY_IMAGES = [
  {
    id: "1834",
    normalUrl: "https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/1834.png",
    fullArtUrl: "https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/1834.png"
  },
  {
    id: "3576", 
    normalUrl: "https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/3576.png",
    fullArtUrl: "https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/3576.png"
  },
  {
    id: "5991",
    normalUrl: "https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/5991.png",
    fullArtUrl: "https://ipfs.io/ipfs/QmYDvPAXtiJg7s8JdRBSLWdgSphQdac8j1YuQNNxcGE1hg/5991.png"
  }
];

// Sample card data for testing for each Azuki
const azukiCardData: { [key: string]: CardData } = {
  "1834": {
    cardName: "Azuki #1834",
    hp: "120",
    type: "🔥", // Fire type
    move: {
      name: "Mystical Blade",
      damage: "80"
    },
    moveDescription: "Channels ancient energy into a devastating strike, cutting through defenses with spiritual precision.",
    weakness: "💧",
    resistance: "🪨",
    retreatCost: "⭐⭐",
    rarity: "⭐⭐⭐",
    normalImageUrl: GALLERY_IMAGES[0].normalUrl,
    fullArtImageUrl: GALLERY_IMAGES[0].fullArtUrl,
    cardColor: "#ff5722",
    traits: "Type: Human, Hair: Red, Eyes: Closed, Mouth: Grin, Clothing: Kimono, Background: Off White Red, Offhand: Dagger, Special: BEANZ, Headgear: Straw Hat, Rarity: Rare"
  },
  "3576": {
    cardName: "Azuki #3576",
    hp: "90",
    type: "💧", // Water type
    move: {
      name: "Spirit Surge",
      damage: "60"
    },
    moveDescription: "Summons a wave of spiritual energy that flows like water, washing away opponents with its tranquil force.",
    weakness: "⚡",
    resistance: "🔥",
    retreatCost: "⭐",
    rarity: "⭐⭐",
    normalImageUrl: GALLERY_IMAGES[1].normalUrl,
    fullArtImageUrl: GALLERY_IMAGES[1].fullArtUrl,
    cardColor: "#2196f3",
    traits: "Type: Human, Hair: Blonde, Eyes: Dizzy, Mouth: Triangle, Clothing: Qipao, Background: Cool Gray, Offhand: Fan, Special: None, Headgear: Flower Pin, Rarity: Uncommon"
  },
  "5991": {
    cardName: "Azuki #5991",
    hp: "150",
    type: "🪨", // Earth type
    move: {
      name: "Mountain Slam",
      damage: "100"
    },
    moveDescription: "Harnesses the raw power of the earth, creating a tremor that shakes the battlefield and stuns opponents.",
    weakness: "🔥",
    resistance: "⚡",
    retreatCost: "⭐⭐⭐",
    rarity: "⭐⭐⭐⭐",
    normalImageUrl: GALLERY_IMAGES[2].normalUrl,
    fullArtImageUrl: GALLERY_IMAGES[2].fullArtUrl,
    cardColor: "#795548",
    traits: "Type: Human, Hair: Pink, Eyes: Suspicious, Mouth: Frown, Clothing: Jacket, Background: Off White Purple, Offhand: Katana, Special: Blue Spirit, Headgear: None, Rarity: Ultra Rare"
  }
};

// Default to the first Azuki in the gallery
const sampleCardData: CardData = azukiCardData["1834"];

export const LayeredCardDemo = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [cardData, setCardData] = useState<CardData>(sampleCardData);
  const [isFullArt, setIsFullArt] = useState(true);
  const [showHoloFoil, setShowHoloFoil] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Update card data when gallery image changes
  useEffect(() => {
    const currentImage = GALLERY_IMAGES[currentImageIndex];
    const currentId = currentImage.id;
    setIsLoading(true);
    
    // Use the predefined card data for this Azuki
    const selectedCardData = azukiCardData[currentId];
    console.log("Loading card data:", selectedCardData);
    console.log("Move description:", selectedCardData.moveDescription);
    setCardData(selectedCardData);
    
    // Simulate loading complete after short delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [currentImageIndex]);
  
  // Handle loading events
  const handleLoadStart = () => {
    console.log('Card image loading started');
  };
  
  const handleLoadComplete = () => {
    console.log('Card image loading completed');
  };
  
  const handleLoadError = (error: Error) => {
    console.error('Card image loading error:', error);
  };
  
  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f0f0f0'
    }}>
      <h1>Layered 3D Card Demo</h1>
      
      <div style={{ 
        width: '500px', 
        height: '700px', 
        border: '1px solid #ccc',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <LayeredCardScene
          cardData={cardData}
          isLoading={isLoading}
          isFullArt={isFullArt}
          showHoloFoil={showHoloFoil}
          onImageLoadStart={handleLoadStart}
          onImageLoadComplete={handleLoadComplete}
          onImageLoadError={handleLoadError}
        />
      </div>
      
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p>Card Type: {cardData.type} | HP: {cardData.hp} | Rarity: {cardData.rarity}</p>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={() => setIsFullArt(!isFullArt)} 
            style={{ 
              padding: '10px 20px', 
              background: '#ff5722', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isFullArt ? 'Show Normal Card' : 'Show Full Art Card'}
          </button>
          
          <button 
            onClick={() => setShowHoloFoil(!showHoloFoil)} 
            style={{ 
              padding: '10px 20px', 
              background: showHoloFoil ? '#4caf50' : '#9e9e9e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showHoloFoil ? 'Hide Holo Effect' : 'Show Holo Effect'}
          </button>
          
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={() => setCurrentImageIndex(prev => (prev - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length)} 
            style={{ 
              padding: '10px 20px', 
              background: '#2196f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Previous Card
          </button>
          
          <button 
            onClick={() => setCurrentImageIndex(prev => (prev + 1) % GALLERY_IMAGES.length)} 
            style={{ 
              padding: '10px 20px', 
              background: '#2196f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Next Card
          </button>
        </div>
        
        <p style={{ marginTop: '10px' }}>
          Viewing Card {currentImageIndex + 1} of {GALLERY_IMAGES.length}: Azuki #{GALLERY_IMAGES[currentImageIndex].id}
        </p>
      </div>
    </div>
  );
};