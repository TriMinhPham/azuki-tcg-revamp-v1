/**
 * Gallery hook for managing gallery data and state
 */
import { useState, useEffect, useCallback } from 'react';
import { GalleryItem, Pagination } from '@/types';
import { fetchGalleryItems } from '@/services/galleryService';

/**
 * Props for the useGallery hook
 */
interface UseGalleryProps {
  initialPage?: number;
  initialLimit?: number;
  initialFilter?: string;
  initialSearch?: string;
}

/**
 * Custom hook to manage gallery data and pagination
 */
export const useGallery = ({
  initialPage = 1,
  initialLimit = 12,
  initialFilter = 'all',
  initialSearch = ''
}: UseGalleryProps = {}) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: initialPage,
    limit: initialLimit,
    totalItems: 0,
    totalPages: 1
  });
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState(initialSearch);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch gallery data with current pagination, filter, and search parameters
   */
  const loadGallery = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchGalleryItems(
        pagination.page, 
        pagination.limit, 
        filter, 
        search
      );
      
      // Ensure we have valid data
      if (!response || !response.data) {
        throw new Error('Invalid gallery response format');
      }
      
      setItems(response.data);
      setPagination({
        page: response.pagination.page,
        limit: response.pagination.limit,
        totalItems: response.pagination.totalItems,
        totalPages: response.pagination.totalPages || 1
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gallery data');
      console.error('Error fetching gallery:', err);
      
      // Set empty items as fallback
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filter, search]);

  /**
   * Change the current page
   */
  const goToPage = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  }, [pagination.totalPages]);

  /**
   * Go to the next page
   */
  const nextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [pagination]);

  /**
   * Go to the previous page
   */
  const prevPage = useCallback(() => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  }, [pagination]);

  /**
   * Change the items per page
   */
  const changeLimit = useCallback((newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  }, []);

  /**
   * Change the filter
   */
  const changeFilter = useCallback((newFilter: string) => {
    setFilter(newFilter);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Update the search term
   */
  const updateSearch = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Refresh the gallery with current parameters
   */
  const refreshGallery = useCallback(() => {
    loadGallery();
  }, [loadGallery]);

  // Load gallery when parameters change
  useEffect(() => {
    loadGallery();
  }, [pagination.page, pagination.limit, filter, search, loadGallery]);

  return {
    items,
    pagination,
    filter,
    search,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    changeLimit,
    changeFilter,
    updateSearch,
    refreshGallery
  };
};