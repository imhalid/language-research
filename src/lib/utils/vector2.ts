import type { CanvasPoint } from '../../types/canvas.types';

export const add = (left: CanvasPoint, right: CanvasPoint): CanvasPoint => ({
  x: left.x + right.x,
  y: left.y + right.y
});

export const subtract = (left: CanvasPoint, right: CanvasPoint): CanvasPoint => ({
  x: left.x - right.x,
  y: left.y - right.y
});

export const scale = (point: CanvasPoint, factor: number): CanvasPoint => ({
  x: point.x * factor,
  y: point.y * factor
});
