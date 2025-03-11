import * as THREE from 'three';

// Extend Window interface
declare global {
  interface Window {
    THREE: typeof THREE;
    _normalCardCalculatedPositions?: {
      imageY: number;
      setIconY: number;
      moveBoxY: number;
      weaknessY: number;
    };
  }
}

// Extend THREE.Event with point property for pointer events
declare module 'three' {
  interface Event {
    point?: THREE.Vector3;
  }
}

// For React Three Fiber event handling
export interface ThreeEvent<T> extends THREE.Event {
  point: THREE.Vector3;
  object: THREE.Object3D;
  distance: number;
  nativeEvent: T;
}