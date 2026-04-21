import type { CanvasWorkspaceNode, Connection } from '../../types/canvas.types';
import type { CanvasEntityType } from '../../types/domain.types';
import type { ConnectedEntity, SelectableEntityType } from '../../types/machine.types';

const SELECTABLE_TYPES = new Set<SelectableEntityType>(['paragraph', 'sentence', 'word']);

export const isSelectableEntityType = (value: string): value is SelectableEntityType =>
  SELECTABLE_TYPES.has(value as SelectableEntityType);

export const buildSelectionKey = (
  chapterId: number | null | undefined,
  node: CanvasWorkspaceNode | null
): string =>
  node && isSelectableEntityType(node.entityType) && chapterId != null
    ? `${chapterId}:${node.entityType}:${node.entityId}`
    : '';

export const findCanvasNodeId = (
  nodes: CanvasWorkspaceNode[],
  entityType: CanvasEntityType,
  entityId: number
): number | null =>
  nodes.find((node) => node.entityType === entityType && node.entityId === entityId)?.id ?? null;

export const buildSelectionConnections = (
  nodes: CanvasWorkspaceNode[],
  selectedNodeId: number | null,
  connectedIds: ConnectedEntity[]
): Connection[] => {
  if (!selectedNodeId) return [];

  const nodeIds = new Set(nodes.map((node) => node.id));

  return connectedIds.flatMap((entry) =>
    nodeIds.has(entry.canvasNodeId)
      ? [{ fromNodeId: selectedNodeId, toNodeId: entry.canvasNodeId, kind: 'selection' as const }]
      : []
  );
};
