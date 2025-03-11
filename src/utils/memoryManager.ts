import * as THREE from 'three';

/**
 * Memory management utility for Three.js
 * Helps track and dispose of resources properly to prevent memory leaks
 */

// Track disposable resources
interface DisposableResource {
  resource: THREE.Object3D | THREE.Material | THREE.Texture | THREE.BufferGeometry;
  type: 'object' | 'material' | 'texture' | 'geometry';
  createdAt: number;
  lastUsed: number;
  id: string;
}

class ThreeMemoryManager {
  private resources: Map<string, DisposableResource> = new Map();
  private autoCleanupInterval: number | null = null;
  private enabled: boolean = true;
  
  // Track memory usage
  private stats = {
    geometryCount: 0,
    textureCount: 0,
    materialCount: 0,
    objectCount: 0,
    disposedCount: 0,
    estimatedMemoryUsage: 0
  };

  constructor(autoCleanupIntervalMs: number = 60000) {
    if (autoCleanupIntervalMs > 0) {
      this.enableAutoCleanup(autoCleanupIntervalMs);
    }
    
    // Log initial setup
    console.debug('[MemoryManager] Initialized');
  }

  /**
   * Track a Three.js resource for later disposal
   */
  track<T extends THREE.Object3D | THREE.Material | THREE.Texture | THREE.BufferGeometry>(
    resource: T,
    type: 'object' | 'material' | 'texture' | 'geometry'
  ): T {
    const id = this.generateResourceId(resource, type);
    
    this.resources.set(id, {
      resource,
      type,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      id
    });
    
    // Update stats
    this.updateStats();
    
    return resource;
  }

  /**
   * Track an entire scene graph including all materials, geometries, and textures
   */
  trackSceneGraph(root: THREE.Object3D): void {
    // Track the root object
    this.track(root, 'object');
    
    // Traverse the entire scene graph
    root.traverse((object) => {
      this.track(object, 'object');
      
      // Track materials
      if ('material' in object) {
        const materials = Array.isArray((object as any).material) 
          ? (object as any).material 
          : [(object as any).material];
        
        materials.forEach(material => {
          if (material) {
            this.trackMaterial(material);
          }
        });
      }
      
      // Track geometry
      if ('geometry' in object) {
        const geometry = (object as any).geometry;
        if (geometry && geometry instanceof THREE.BufferGeometry) {
          this.track(geometry, 'geometry');
        }
      }
    });
  }

  /**
   * Track a material and all its textures
   */
  trackMaterial(material: THREE.Material): void {
    if (!material) return;
    
    this.track(material, 'material');
    
    // Track all textures in the material
    const textureProperties = [
      'map', 'normalMap', 'bumpMap', 'displacementMap', 'roughnessMap', 
      'metalnessMap', 'alphaMap', 'aoMap', 'emissiveMap', 'envMap',
      'lightMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
      'transmissionMap', 'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
      'specularIntensityMap', 'specularColorMap', 'anisotropyMap', 'iridescenceMap',
      'iridescenceThicknessMap', 'matcap'
    ];
    
    for (const prop of textureProperties) {
      const texture = (material as any)[prop];
      if (texture && texture instanceof THREE.Texture) {
        this.track(texture, 'texture');
      }
    }
  }

  /**
   * Mark a resource as being used to prevent it from being disposed
   */
  markAsUsed(resource: THREE.Object3D | THREE.Material | THREE.Texture | THREE.BufferGeometry): void {
    const id = this.findResourceId(resource);
    if (id && this.resources.has(id)) {
      const entry = this.resources.get(id)!;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Untrack and dispose a specific resource
   */
  dispose(resource: THREE.Object3D | THREE.Material | THREE.Texture | THREE.BufferGeometry): void {
    const id = this.findResourceId(resource);
    if (!id) return;
    
    const entry = this.resources.get(id);
    if (!entry) return;
    
    this.disposeResource(entry);
    this.resources.delete(id);
    
    // Update stats
    this.stats.disposedCount++;
    this.updateStats();
  }

  /**
   * Dispose resources that haven't been used for a specific time
   */
  disposeUnused(olderThanMs: number = 60000): void {
    if (!this.enabled) return;
    
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [id, entry] of this.resources.entries()) {
      if (now - entry.lastUsed > olderThanMs) {
        this.disposeResource(entry);
        toDelete.push(id);
        this.stats.disposedCount++;
      }
    }
    
    // Remove from tracking
    toDelete.forEach(id => this.resources.delete(id));
    
    // Update stats
    if (toDelete.length > 0) {
      console.debug(`[MemoryManager] Disposed ${toDelete.length} unused resources (older than ${olderThanMs}ms)`);
      this.updateStats();
    }
  }

  /**
   * Dispose all tracked resources
   */
  disposeAll(): void {
    for (const entry of this.resources.values()) {
      this.disposeResource(entry);
      this.stats.disposedCount++;
    }
    
    this.resources.clear();
    console.debug('[MemoryManager] All resources disposed');
    this.updateStats();
  }

  /**
   * Enable automatic cleanup of unused resources
   */
  enableAutoCleanup(intervalMs: number = 60000): void {
    this.disableAutoCleanup(); // Clear any existing interval
    
    this.autoCleanupInterval = window.setInterval(() => {
      this.disposeUnused(intervalMs);
    }, intervalMs) as unknown as number;
    
    this.enabled = true;
    console.debug(`[MemoryManager] Auto-cleanup enabled (${intervalMs}ms interval)`);
  }

  /**
   * Disable automatic cleanup
   */
  disableAutoCleanup(): void {
    if (this.autoCleanupInterval !== null) {
      window.clearInterval(this.autoCleanupInterval);
      this.autoCleanupInterval = null;
      console.debug('[MemoryManager] Auto-cleanup disabled');
    }
  }

  /**
   * Get current memory usage statistics
   */
  getStats(): typeof this.stats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Enable or disable the memory manager
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // Private utility methods

  /**
   * Generate a unique ID for a resource
   */
  private generateResourceId(
    resource: THREE.Object3D | THREE.Material | THREE.Texture | THREE.BufferGeometry,
    type: 'object' | 'material' | 'texture' | 'geometry'
  ): string {
    let id = '';
    
    if (resource instanceof THREE.Object3D) {
      id = `obj_${resource.uuid}`;
    } else if (resource instanceof THREE.Material) {
      id = `mat_${resource.uuid}`;
    } else if (resource instanceof THREE.Texture) {
      id = `tex_${resource.uuid}`;
    } else if (resource instanceof THREE.BufferGeometry) {
      id = `geo_${resource.uuid || resource.id}`;
    } else {
      id = `unknown_${Math.random().toString(36).substring(2, 15)}`;
    }
    
    return id;
  }

  /**
   * Find the ID of a tracked resource
   */
  private findResourceId(
    resource: THREE.Object3D | THREE.Material | THREE.Texture | THREE.BufferGeometry
  ): string | null {
    // Try to find by direct reference
    for (const [id, entry] of this.resources.entries()) {
      if (entry.resource === resource) {
        return id;
      }
    }
    
    // Try to find by UUID
    if ('uuid' in resource) {
      const uuid = (resource as any).uuid;
      
      if (resource instanceof THREE.Object3D) {
        return `obj_${uuid}`;
      } else if (resource instanceof THREE.Material) {
        return `mat_${uuid}`;
      } else if (resource instanceof THREE.Texture) {
        return `tex_${uuid}`;
      }
    }
    
    return null;
  }

  /**
   * Dispose a specific resource properly
   */
  private disposeResource(entry: DisposableResource): void {
    try {
      const { resource, type } = entry;
      
      switch (type) {
        case 'object':
          // Don't call dispose() on Object3D - instead rely on traversal
          if (resource instanceof THREE.Object3D) {
            // For meshes, dispose of materials and geometries
            if (resource instanceof THREE.Mesh) {
              // Find and dispose associated materials
              const materials = Array.isArray(resource.material) 
                ? resource.material 
                : [resource.material];
              
              materials.forEach(material => {
                if (material) {
                  const materialEntry = this.findResourceId(material);
                  if (materialEntry) {
                    this.dispose(material);
                  }
                }
              });
              
              // Find and dispose associated geometry
              if (resource.geometry) {
                const geometryEntry = this.findResourceId(resource.geometry);
                if (geometryEntry) {
                  this.dispose(resource.geometry);
                }
              }
            }
          }
          break;
        
        case 'material':
          if (resource instanceof THREE.Material) {
            // Dispose textures first
            this.disposeMaterialTextures(resource);
            resource.dispose();
          }
          break;
        
        case 'texture':
          if (resource instanceof THREE.Texture) {
            resource.dispose();
          }
          break;
        
        case 'geometry':
          if (resource instanceof THREE.BufferGeometry) {
            resource.dispose();
          }
          break;
      }
    } catch (error) {
      console.warn(`[MemoryManager] Error disposing resource: ${error}`);
    }
  }

  /**
   * Dispose all textures used by a material
   */
  private disposeMaterialTextures(material: THREE.Material): void {
    const textureProperties = [
      'map', 'normalMap', 'bumpMap', 'displacementMap', 'roughnessMap', 
      'metalnessMap', 'alphaMap', 'aoMap', 'emissiveMap', 'envMap',
      'lightMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
      'transmissionMap', 'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
      'specularIntensityMap', 'specularColorMap', 'anisotropyMap', 'iridescenceMap',
      'iridescenceThicknessMap', 'matcap'
    ];
    
    for (const prop of textureProperties) {
      const texture = (material as any)[prop];
      if (texture && texture instanceof THREE.Texture) {
        const textureEntry = this.findResourceId(texture);
        if (textureEntry) {
          this.dispose(texture);
        }
      }
    }
  }

  /**
   * Update memory usage statistics
   */
  private updateStats(): void {
    let geometryCount = 0;
    let textureCount = 0;
    let materialCount = 0;
    let objectCount = 0;
    let estimatedMemoryUsage = 0;
    
    for (const entry of this.resources.values()) {
      switch (entry.type) {
        case 'geometry':
          geometryCount++;
          // Estimate geometry memory usage
          if (entry.resource instanceof THREE.BufferGeometry) {
            const geometry = entry.resource;
            let geometrySize = 0;
            
            // Count size of each attribute
            for (const name in geometry.attributes) {
              const attribute = geometry.attributes[name];
              geometrySize += (attribute.array.byteLength || 0);
            }
            
            // Add index buffer size if it exists
            if (geometry.index) {
              geometrySize += (geometry.index.array.byteLength || 0);
            }
            
            estimatedMemoryUsage += geometrySize;
          }
          break;
        
        case 'texture':
          textureCount++;
          // Estimate texture memory usage (width * height * 4 bytes per pixel)
          if (entry.resource instanceof THREE.Texture && entry.resource.image) {
            const width = entry.resource.image.width || 256;
            const height = entry.resource.image.height || 256;
            const mipmap = entry.resource.generateMipmaps ? 1.33 : 1;
            estimatedMemoryUsage += width * height * 4 * mipmap;
          } else {
            // Default estimate if dimensions unknown
            estimatedMemoryUsage += 512 * 512 * 4;
          }
          break;
        
        case 'material':
          materialCount++;
          // Just a rough estimate for material
          estimatedMemoryUsage += 1024;
          break;
        
        case 'object':
          objectCount++;
          // Just a rough estimate for object
          estimatedMemoryUsage += 256;
          break;
      }
    }
    
    this.stats = {
      geometryCount,
      textureCount,
      materialCount,
      objectCount,
      disposedCount: this.stats.disposedCount,
      estimatedMemoryUsage
    };
  }
}

// Create and export a singleton instance
export const memoryManager = new ThreeMemoryManager();

/**
 * Helper function to safely dispose of Three.js meshes and their resources
 */
export function disposeMesh(mesh: THREE.Mesh | THREE.Group | null | undefined): void {
  if (!mesh) return;
  
  if (mesh instanceof THREE.Mesh) {
    // Dispose geometry
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    
    // Dispose material(s)
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      
      for (const material of materials) {
        if (!material) continue;
        
        // Dispose textures
        for (const propertyName of Object.keys(material)) {
          const value = (material as any)[propertyName];
          
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        }
        
        material.dispose();
      }
    }
  } else if (mesh instanceof THREE.Group) {
    // Handle groups by disposing all children recursively
    mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        disposeMesh(child);
      }
    });
  }
  
  // Clear references
  if (mesh.parent) {
    mesh.parent.remove(mesh);
  }
}

/**
 * Safe cleanup function to call when a component unmounts
 */
export function cleanupThreeResources(scene: THREE.Scene | THREE.Group | null | undefined): void {
  if (!scene) return;
  
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      disposeMesh(object);
    }
  });
  
  memoryManager.disposeUnused(0); // Force cleanup of unused resources
}

// Log memory usage periodically (development only)
if (process.env.NODE_ENV === 'development') {
  window.setInterval(() => {
    const stats = memoryManager.getStats();
    console.debug(`[MemoryStats] Geometries: ${stats.geometryCount}, Materials: ${stats.materialCount}, Textures: ${stats.textureCount}, Objects: ${stats.objectCount}, Memory: ${(stats.estimatedMemoryUsage / (1024 * 1024)).toFixed(2)}MB`);
  }, 10000);
}