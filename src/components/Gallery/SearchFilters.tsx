import React from 'react';
import './Gallery.css';

interface SearchFiltersProps {
  currentFilter: string;
  searchValue: string;
  onFilterChange: (filter: string) => void;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  currentFilter,
  searchValue,
  onFilterChange,
  onSearchChange
}) => {
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'recent', label: 'Recent' },
    { id: 'popular', label: 'Popular' }
  ];

  return (
    <div className="gallery-filters">
      <div className="search-container">
        <input
          type="text"
          className="gallery-search"
          placeholder="Search by Azuki ID..."
          value={searchValue}
          onChange={onSearchChange}
        />
      </div>
      
      <div className="filter-buttons">
        {filters.map(filter => (
          <button
            key={filter.id}
            className={`filter-button ${currentFilter === filter.id ? 'active' : ''}`}
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
};