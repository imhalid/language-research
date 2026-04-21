import type {
  CanvasBounds,
  CanvasPoint,
  CanvasViewport,
  CanvasWorkspaceNode,
  MinimapModel,
  ViewState
} from '../../types/canvas.types';
import { add, scale, subtract } from './vector2';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 116;

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.6;
const WORLD_PADDING = 160;

export const clampZoom = (value: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export const wheelDeltaToZoom = (deltaY: number): number => (deltaY < 0 ? 0.14 : -0.14);

export const clientToWorld = (
  client: CanvasPoint,
  rect: Pick<DOMRect, 'left' | 'top'>,
  view: ViewState
): CanvasPoint =>
  scale(
    subtract(subtract(client, { x: rect.left, y: rect.top }), { x: view.panX, y: view.panY }),
    1 / view.zoom
  );

export const getZoomCompensation = (
  client: CanvasPoint,
  rect: Pick<DOMRect, 'left' | 'top'>,
  view: ViewState,
  delta: number
): CanvasPoint => {
  const nextZoom = clampZoom(view.zoom + delta);

  if (nextZoom === view.zoom) {
    return { x: 0, y: 0 };
  }

  const worldPoint = clientToWorld(client, rect, view);
  const screenPoint = subtract(client, { x: rect.left, y: rect.top });
  const nextPan = subtract(screenPoint, scale(worldPoint, nextZoom));

  return subtract(nextPan, { x: view.panX, y: view.panY });
};

const getViewportWorldRect = (view: ViewState, viewport: CanvasViewport): CanvasBounds => {
  const minX = -view.panX / view.zoom;
  const minY = -view.panY / view.zoom;
  const width = viewport.width / view.zoom;
  const height = viewport.height / view.zoom;

  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
    width,
    height
  };
};

export const getWorldBounds = (
  nodes: CanvasWorkspaceNode[],
  view: ViewState,
  viewport: CanvasViewport
): CanvasBounds => {
  const viewportRect = getViewportWorldRect(view, viewport);
  const seeded = {
    minX: viewportRect.minX,
    minY: viewportRect.minY,
    maxX: viewportRect.maxX,
    maxY: viewportRect.maxY
  };

  const bounds = nodes.reduce(
    (accumulator, node) => ({
      minX: Math.min(accumulator.minX, node.x),
      minY: Math.min(accumulator.minY, node.y),
      maxX: Math.max(accumulator.maxX, node.x + NODE_WIDTH),
      maxY: Math.max(accumulator.maxY, node.y + NODE_HEIGHT)
    }),
    seeded
  );

  const paddedMin = subtract({ x: bounds.minX, y: bounds.minY }, { x: WORLD_PADDING, y: WORLD_PADDING });
  const paddedMax = add({ x: bounds.maxX, y: bounds.maxY }, { x: WORLD_PADDING, y: WORLD_PADDING });

  return {
    minX: paddedMin.x,
    minY: paddedMin.y,
    maxX: paddedMax.x,
    maxY: paddedMax.y,
    width: Math.max(1, paddedMax.x - paddedMin.x),
    height: Math.max(1, paddedMax.y - paddedMin.y)
  };
};

export const buildMinimapModel = (
  nodes: CanvasWorkspaceNode[],
  view: ViewState,
  viewport: CanvasViewport,
  size: CanvasViewport
): MinimapModel => {
  const bounds = getWorldBounds(nodes, view, viewport);
  const scaleFactor = Math.min(size.width / bounds.width, size.height / bounds.height);
  const offsetX = (size.width - bounds.width * scaleFactor) / 2;
  const offsetY = (size.height - bounds.height * scaleFactor) / 2;
  const project = (point: CanvasPoint): CanvasPoint => ({
    x: offsetX + (point.x - bounds.minX) * scaleFactor,
    y: offsetY + (point.y - bounds.minY) * scaleFactor
  });
  const viewportRect = getViewportWorldRect(view, viewport);
  const viewportOrigin = project({ x: viewportRect.minX, y: viewportRect.minY });

  return {
    nodes: nodes.map((node) => {
      const origin = project({ x: node.x, y: node.y });

      return {
        id: node.id,
        entityType: node.entityType,
        x: origin.x,
        y: origin.y,
        width: Math.max(6, NODE_WIDTH * scaleFactor),
        height: Math.max(4, NODE_HEIGHT * scaleFactor)
      };
    }),
    viewport: {
      x: viewportOrigin.x,
      y: viewportOrigin.y,
      width: viewportRect.width * scaleFactor,
      height: viewportRect.height * scaleFactor
    }
  };
};
