import { assign, setup } from 'xstate';
import { db } from '../db';
import type { ChapterContext, ChapterEvent } from '../../types/machine.types';

const initialContext = {
  activeChapterId: null,
  expandedIds: [],
  sidebarOpen: true
} satisfies ChapterContext;

export const chapterMachine = setup({
  types: {
    context: {} as ChapterContext,
    events: {} as ChapterEvent
  },
  actions: {
    persistSelectedChapter: (_, params: { id: number }) => {
      void db.settings.put({ key: 'selectedChapterId', value: params.id });
    }
  }
}).createMachine({
  id: 'chapter',
  context: initialContext,
  on: {
    SELECT_CHAPTER: {
      actions: [
        assign({
          activeChapterId: ({ event }) => event.id
        }),
        {
          type: 'persistSelectedChapter',
          params: ({ event }) => ({ id: event.id })
        }
      ]
    },
    TOGGLE_EXPAND: {
      actions: assign({
        expandedIds: ({ context, event }) =>
          context.expandedIds.includes(event.id)
            ? context.expandedIds.filter((id) => id !== event.id)
            : [...context.expandedIds, event.id]
      })
    },
    TOGGLE_SIDEBAR: {
      actions: assign({
        sidebarOpen: ({ context }) => !context.sidebarOpen
      })
    },
    CLOSE_SIDEBAR: {
      actions: assign({
        sidebarOpen: () => false
      })
    }
  }
});
