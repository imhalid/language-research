import { NODE_HEIGHT, NODE_WIDTH } from './canvas';
import type { CanvasPoint, CanvasWorkspaceNode, Connection } from '../../types/canvas.types';

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

export const buildRopeId = (connection: Connection): string =>
  `${connection.kind}-${connection.fromNodeId}-${connection.toNodeId}`;

export const resolveRopeEndpoints = (
  nodes: CanvasWorkspaceNode[],
  connection: Connection
): { from: CanvasPoint; to: CanvasPoint } | null => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const fromNode = nodeMap.get(connection.fromNodeId);
  const toNode = nodeMap.get(connection.toNodeId);

  if (!fromNode || !toNode) return null;

  return {
    from: resolveAnchor(fromNode, getNodeCenter(toNode)),
    to: resolveAnchor(toNode, getNodeCenter(fromNode))
  };
};

export const resolveCamera = (panX: number, panY: number, zoom: number): CanvasPoint => ({
  x: -panX / zoom,
  y: -panY / zoom
});
