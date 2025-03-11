/**
 * API utility for backend communication
 * Provides a consistent interface for making HTTP requests
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// Default configuration
const DEFAULT_CONFIG: AxiosRequestConfig = {
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Create a configured axios instance
 */
function createApiInstance(config: AxiosRequestConfig = {}): AxiosInstance {
  // Merge default config with provided config
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    headers: {
      ...DEFAULT_CONFIG.headers,
      ...config.headers,
    },
  };
  
  // Create instance
  const instance = axios.create(finalConfig);
  
  // Add response interceptor for error logging
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error)) {
        console.error('API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message
        });
        
        // Check for specific error types
        if (error.response?.status === 504 || 
            (error.message && error.message.includes('ECONNREFUSED'))) {
          console.error('Proxy or Connection Error: The API server may not be running correctly');
        }
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
}

// Create default API instance
const defaultInstance = createApiInstance();

/**
 * API utility object with HTTP methods and instance creation
 */
const api = {
  // Default instance methods
  get: defaultInstance.get,
  post: defaultInstance.post,
  put: defaultInstance.put,
  delete: defaultInstance.delete,
  patch: defaultInstance.patch,
  
  // Create a new instance with custom config
  getInstance: (config: AxiosRequestConfig = {}) => createApiInstance(config),
  
  // Default instance for direct access
  instance: defaultInstance
};

export default api;