import { useGallery } from '@/hooks';
import { GalleryItem } from './GalleryItem';
import { Pagination } from './Pagination';
import { SearchFilters } from './SearchFilters';
import { useState, useEffect } from 'react';
import './Gallery.css';

interface GalleryViewProps {
  onSelectItem: (tokenId: string) => void;
  onClose: () => void;
}

export const GalleryView = ({ onSelectItem, onClose }: GalleryViewProps) => {
  const [debounceSearch, setDebounceSearch] = useState('');
  
  // Initialize gallery hook
  const {
    items,
    pagination,
    filter,
    search,
    isLoading,
    error,
    nextPage,
    prevPage,
    changeFilter,
    updateSearch,
    refreshGallery
  } = useGallery();
  
  // Debounce search input to prevent too many API calls
  useEffect(() => {
    const timerId = setTimeout(() => {
      updateSearch(debounceSearch);
    }, 500);
    
    return () => clearTimeout(timerId);
  }, [debounceSearch, updateSearch]);
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDebounceSearch(e.target.value);
  };
  
  // Handle filter button click
  const handleFilterChange = (newFilter: string) => {
    changeFilter(newFilter);
  };
  
  // Select an item from the gallery
  const handleSelectItem = (tokenId: string) => {
    onSelectItem(tokenId);
  };

  return (
    <div className="gallery-modal">
      <div className="gallery-content">
        <div className="gallery-header">
          <h2>Full Art Gallery</h2>
          <button className="gallery-close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="gallery-body">
          <SearchFilters
            currentFilter={filter}
            searchValue={debounceSearch}
            onFilterChange={handleFilterChange}
            onSearchChange={handleSearchChange}
          />
          
          {isLoading ? (
            <div className="gallery-loading">
              <div className="gallery-spinner"></div>
              <p>Loading gallery...</p>
            </div>
          ) : error ? (
            <div className="gallery-error">
              <p>{error}</p>
              <button className="gallery-retry-button" onClick={refreshGallery}>
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="gallery-empty">
              <p>No images found. Generate some cards first!</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {items.map(item => (
                <GalleryItem
                  key={`${item.tokenId}-${item.timestamp}`}
                  item={item}
                  onClick={handleSelectItem}
                />
              ))}
            </div>
          )}
          
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onNextPage={nextPage}
            onPrevPage={prevPage}
            disabled={isLoading}
          />
        </div>
        
        <div className="gallery-footer">
          <button className="gallery-refresh-button" onClick={refreshGallery} disabled={isLoading}>
            Refresh Gallery
          </button>
          <button className="gallery-close-button-text" onClick={onClose}>
            Close Gallery
          </button>
        </div>
      </div>
    </div>
  );
};