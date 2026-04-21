export interface CanvasContext {
  zoom: number;
  panX: number;
  panY: number;
  draggingNodeId: number | null;
  dragOffsetX: number;
  dragOffsetY: number;
}

export type CanvasEvent =
  | { type: 'ZOOM'; delta: number }
  | { type: 'SET_ZOOM'; value: number }
  | { type: 'PAN'; dx: number; dy: number }
  | { type: 'DRAG_START'; nodeId: number; offsetX: number; offsetY: number }
  | { type: 'DRAG_MOVE'; x: number; y: number }
  | { type: 'DRAG_END' }
  | { type: 'RESET_VIEW' };

export interface ChapterContext {
  activeChapterId: number | null;
  expandedIds: number[];
  sidebarOpen: boolean;
}

export type ChapterEvent =
  | { type: 'SELECT_CHAPTER'; id: number }
  | { type: 'TOGGLE_EXPAND'; id: number }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'CLOSE_SIDEBAR' };

export type SelectableEntityType = 'paragraph' | 'sentence' | 'word';

export interface ConnectedEntity {
  type: SelectableEntityType;
  id: number;
  canvasNodeId: number;
}

export interface SelectionContext {
  selectedType: SelectableEntityType | null;
  selectedId: number | null;
  connectedIds: ConnectedEntity[];
}

export type SelectionEvent =
  | { type: 'SELECT'; entityType: SelectableEntityType; id: number }
  | { type: 'DESELECT' };

export type WordnetState = 'idle' | 'checking' | 'seeding' | 'done' | 'error';

export interface WordnetContext {
  status: WordnetState;
  progress: number;
  error: string | null;
}

export type WordnetEvent =
  | { type: 'START_SEED' }
  | { type: 'PROGRESS'; value: number }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string };

export type WordnetWorkerCommand = { type: 'START' };

export type WordnetWorkerMessage =
  | { type: 'PROGRESS'; value: number }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string };
