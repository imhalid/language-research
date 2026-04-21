import type { CanvasEntityType } from './domain.types';

export interface Connection {
  fromNodeId: number;
  toNodeId: number;
  kind: 'selection' | 'occurrence';
}

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CanvasAnchor {
  entityType: CanvasEntityType;
  entityId: number;
  nodeId: number;
}
