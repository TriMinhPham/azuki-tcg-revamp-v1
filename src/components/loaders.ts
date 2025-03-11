import { lazy } from 'react';
import { lazyLoad } from '@/utils/lazyLoading';

// Create optimized dynamic imports for the Card3D components
export const Card3D = lazyLoad(() => import('@/components/Card3D/Card3D'));
export const LayeredCard3D = lazyLoad(() => import('@/components/Card3D/LayeredCard3D'));
export const CardTextOverlay = lazyLoad(() => import('@/components/Card3D/CardTextOverlay'));
export const LayeredCardScene = lazyLoad(() => import('@/components/Card3D/LayeredCardScene'));

// Create optimized imports for the scene components
export const CardScene = lazyLoad(() => import('@/components/CardScene/CardScene'));

// Gallery components can be loaded separately
export const GalleryView = lazy(() => import('@/components/Gallery/GalleryView'));
export const GalleryItem = lazy(() => import('@/components/Gallery/GalleryItem'));