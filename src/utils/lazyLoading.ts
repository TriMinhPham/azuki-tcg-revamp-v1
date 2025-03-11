import React, { lazy, Suspense } from 'react';

/**
 * Utility for lazy loading components with customizable loading component
 * and error handling. Used primarily for Three.js components that should
 * be loaded only when needed.
 */

interface LazyLoadOptions {
  /** Fallback component to show while loading */
  fallback?: React.ReactNode;
  /** Component to show on error */
  errorComponent?: React.ComponentType<{ error: Error }>;
  /** Function to call when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Creates a lazy-loaded component with error boundaries
 * 
 * @param importFn Dynamic import function for the component
 * @param options Loading and error options
 */
export function lazyLoad<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): React.LazyExoticComponent<T> {
  const LazyComponent = lazy(() => {
    return importFn().catch((error) => {
      console.error('Error loading component:', error);
      if (options.onError) {
        options.onError(error);
      }
      
      // If an error component is provided, return it instead
      if (options.errorComponent) {
        return { 
          default: options.errorComponent as any 
        };
      }
      
      // Otherwise, pass the error to the next error boundary
      throw error;
    });
  });
  
  return LazyComponent;
}

/**
 * Wrapper component that provides suspense and error boundaries
 * for lazy loaded components.
 */
export function LazyLoadWrapper({
  children,
  fallback = <div>Loading...</div>,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

// Default loading state component for 3D assets
export function Card3DLoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
      fontSize: '14px',
      color: '#666',
      textAlign: 'center',
      padding: '20px',
    }}>
      <div>
        <div style={{ marginBottom: '10px' }}>Loading 3D card...</div>
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#eee',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div 
            style={{
              width: '40%',
              height: '100%',
              backgroundColor: '#4a90e2',
              borderRadius: '2px',
              animation: 'loading 1.5s infinite ease-in-out',
            }}
          />
        </div>
        <style>
          {`
            @keyframes loading {
              0% { width: 5%; margin-left: 0; }
              50% { width: 40%; margin-left: 60%; }
              100% { width: 5%; margin-left: 95%; }
            }
          `}
        </style>
      </div>
    </div>
  );
}

// Example usage:
// const LazyCard3D = lazyLoad(() => import('@/components/Card3D/Card3D'));
// function MyComponent() {
//   return (
//     <LazyLoadWrapper fallback={<Card3DLoadingFallback />}>
//       <LazyCard3D {...props} />
//     </LazyLoadWrapper>
//   );
// }