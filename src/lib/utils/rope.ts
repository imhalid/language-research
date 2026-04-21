import { NODE_HEIGHT, NODE_WIDTH } from './canvas';
import type { CanvasPoint, CanvasWorkspaceNode, Connection } from '../../types/canvas.types';

export interface RopeSegment {
  id: string;
  kind: Connection['kind'];
  d: string;
  from: CanvasPoint;
  to: CanvasPoint;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const getNodeCenter = (node: CanvasWorkspaceNode): CanvasPoint => ({
  x: node.x + NODE_WIDTH / 2,
  y: node.y + NODE_HEIGHT / 2
});

const resolveAnchor = (node: CanvasWorkspaceNode, target: CanvasPoint): CanvasPoint => {
  const center = getNodeCenter(node);
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? node.x + NODE_WIDTH : node.x,
      y: center.y
    };
  }

  return {
    x: center.x,
    y: dy >= 0 ? node.y + NODE_HEIGHT : node.y
  };
};

export const buildRopePath = (from: CanvasPoint, to: CanvasPoint): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const curve = clamp(distance * 0.34, 52, 220);
  const sway = clamp(distance * 0.12, 14, 72);

  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = dx >= 0 ? 1 : -1;
    const arc = dy === 0 ? sway : Math.sign(dy) * sway;

    return [
      `M ${from.x} ${from.y}`,
      `C ${from.x + curve * direction} ${from.y + arc}`,
      `${to.x - curve * direction} ${to.y - arc}`,
      `${to.x} ${to.y}`
    ].join(' ');
  }

  const direction = dy >= 0 ? 1 : -1;
  const arc = dx === 0 ? sway : Math.sign(dx) * sway;

  return [
    `M ${from.x} ${from.y}`,
    `C ${from.x + arc} ${from.y + curve * direction}`,
    `${to.x - arc} ${to.y - curve * direction}`,
    `${to.x} ${to.y}`
  ].join(' ');
};

export const buildRopeSegments = (
  nodes: CanvasWorkspaceNode[],
  connections: Connection[]
): RopeSegment[] => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return connections.flatMap((connection) => {
    const fromNode = nodeMap.get(connection.fromNodeId);
    const toNode = nodeMap.get(connection.toNodeId);

    if (!fromNode || !toNode) return [];

    const from = resolveAnchor(fromNode, getNodeCenter(toNode));
    const to = resolveAnchor(toNode, getNodeCenter(fromNode));

    return [
      {
        id: `${connection.kind}-${connection.fromNodeId}-${connection.toNodeId}`,
        kind: connection.kind,
        d: buildRopePath(from, to),
        from,
        to
      }
    ];
  });
};
