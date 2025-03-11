import React from 'react';
import './Gallery.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  disabled: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  disabled
}) => {
  return (
    <div className="gallery-pagination">
      <button 
        className="pagination-button" 
        onClick={onPrevPage} 
        disabled={currentPage <= 1 || disabled}
      >
        &laquo; Previous
      </button>
      
      <span className="pagination-info">
        Page {currentPage} of {totalPages}
      </span>
      
      <button 
        className="pagination-button" 
        onClick={onNextPage} 
        disabled={currentPage >= totalPages || disabled}
      >
        Next &raquo;
      </button>
    </div>
  );
};