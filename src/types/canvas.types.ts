import type { CanvasEntityType, CanvasNode } from './domain.types';

export interface Connection {
  fromNodeId: number;
  toNodeId: number;
  kind: 'selection' | 'occurrence';
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CanvasViewport {
  width: number;
  height: number;
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface CanvasAnchor {
  entityType: CanvasEntityType;
  entityId: number;
  nodeId: number;
}

export interface CanvasWorkspaceNode extends Omit<CanvasNode, 'id'> {
  id: number;
  title: string;
  subtitle: string;
}

export interface MinimapNode {
  id: number;
  entityType: CanvasEntityType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MinimapModel {
  nodes: MinimapNode[];
  viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
