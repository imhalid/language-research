import { assign, setup } from 'xstate';
import type { CanvasContext, CanvasEvent } from '../../types/machine.types';
import { clampZoom } from '../utils/canvas';

const initialContext = {
  zoom: 1,
  panX: 0,
  panY: 0,
  draggingNodeId: null,
  dragOffsetX: 0,
  dragOffsetY: 0
} satisfies CanvasContext;

export const canvasMachine = setup({
  types: {
    context: {} as CanvasContext,
    events: {} as CanvasEvent
  },
  actions: {
    trackDragMove: () => undefined
  }
}).createMachine({
  id: 'canvas',
  context: initialContext,
  on: {
    ZOOM: {
      actions: assign({
        zoom: ({ context, event }) => clampZoom(context.zoom + event.delta)
      })
    },
    PAN: {
      actions: assign({
        panX: ({ context, event }) => context.panX + event.dx,
        panY: ({ context, event }) => context.panY + event.dy
      })
    },
    DRAG_START: {
      actions: assign({
        draggingNodeId: ({ event }) => event.nodeId,
        dragOffsetX: ({ event }) => event.offsetX,
        dragOffsetY: ({ event }) => event.offsetY
      })
    },
    DRAG_MOVE: {
      actions: 'trackDragMove'
    },
    DRAG_END: {
      actions: assign({
        draggingNodeId: () => null,
        dragOffsetX: () => 0,
        dragOffsetY: () => 0
      })
    },
    RESET_VIEW: {
      actions: assign(() => ({ ...initialContext }))
    }
  }
});
