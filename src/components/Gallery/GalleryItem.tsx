import { memo } from 'react';
import { GalleryItem as GalleryItemType } from '@/types';
import { createProxyUrl, isTheApiUrl, isMidjourneyUrl } from '@/utils/imageHelper';
import './Gallery.css';

interface GalleryItemProps {
  item: GalleryItemType;
  onClick: (tokenId: string) => void;
}

export const GalleryItem = memo(({ item, onClick }: GalleryItemProps) => {
  // Format date for display
  const formattedDate = new Date(item.timestamp).toLocaleDateString() + ' ' +
    new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Create optimal proxy URLs based on the image source
  const createOptimalProxyUrl = (url: string) => {
    const isMj = isMidjourneyUrl(url);
    const isApi = isTheApiUrl(url);
    const timestamp = Date.now();
    
    // For safety and clarity, log the URL being processed
    console.log(`Processing gallery image URL: ${url?.substring(0, 50)}...`);
    
    if (!url) {
      console.error('Received empty URL in gallery item');
      return 'https://placehold.co/300x400/333/FFF?text=Missing+Image';
    }
    
    if (isApi) {
      return createProxyUrl(url, false);
    } else if (isMj) {
      // For gallery view, use a direct Midjourney URL with special parameters
      return `/api/proxy-image?url=${encodeURIComponent(url)}&midjourney=true&timestamp=${timestamp}`;
    } else {
      return createProxyUrl(url, false);
    }
  };
  
  // Handle click on gallery item
  const handleClick = () => {
    onClick(item.tokenId);
  };
  
  return (
    <div className="gallery-item" onClick={handleClick}>
      {item.quadrants && item.quadrants.length > 0 ? (
        // Render variant grid if available (these are separate images)
        <div className="quadrant-grid">
          {/* Make sure we display all 4 quadrants */}
          {item.quadrants.slice(0, 4).map((quadrant, idx) => {
            // Safely log URLs
            const urlPreview = quadrant.url ? quadrant.url.substring(0, 50) : "undefined";
            console.log(`Rendering variant ${idx + 1} with URL: ${urlPreview}...`);
            return (
              <img
                key={`${item.tokenId}-variant-${idx}`}
                src={quadrant.url ? createOptimalProxyUrl(quadrant.url) : `https://placehold.co/300x400/333/FFF?text=Variant+${idx + 1}`}
                alt={`Azuki #${item.tokenId} Variant ${idx + 1}`}
                className="quadrant-image"
                loading="lazy"
                onError={(e) => {
                  // Fallback on error
                  console.error(`Failed to load variant ${idx + 1} image for token ${item.tokenId}`);
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = `https://placehold.co/300x400/333/FFF?text=Variant+${idx + 1}`;
                }}
              />
            );
          })}
          
          {/* If we have fewer than 4 quadrants, fill with placeholders */}
          {item.quadrants.length < 4 && Array.from({ length: 4 - item.quadrants.length }).map((_, idx) => (
            <div 
              key={`${item.tokenId}-placeholder-${idx}`}
              className="quadrant-placeholder"
              style={{
                backgroundColor: '#333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '14px'
              }}
            >
              No Variant {idx + item.quadrants.length + 1}
            </div>
          ))}
        </div>
      ) : (
        // Render single full art image
        <img
          src={createOptimalProxyUrl(item.url)}
          alt={`Azuki #${item.tokenId} Full Art`}
          className="full-art-image"
          loading="lazy"
          onError={(e) => {
            // Fallback on error
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.src = `https://placehold.co/300x400/333/FFF?text=Azuki+%23${item.tokenId}`;
          }}
        />
      )}
      
      <div className="gallery-item-info">
        <span className="gallery-item-id">Azuki #{item.tokenId}</span>
        <span className="gallery-item-date">{formattedDate}</span>
        {item.isFallback && <span className="gallery-item-fallback">Fallback</span>}
        {item.version > 1 && <span className="gallery-item-version">v{item.version}</span>}
        {item.quadrants && item.quadrants.length > 1 && 
          <span className="gallery-item-variants">{item.quadrants.length} variants</span>}
      </div>
    </div>
  );
});