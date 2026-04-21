import { assign, fromPromise, setup } from 'xstate';
import { db } from '../db';
import type { ConnectedEntity, SelectionContext, SelectionEvent } from '../../types/machine.types';

type SelectionInput = NonNullable<SelectionContext['selectedType']> extends infer T
  ? T extends string
    ? { entityType: T; id: number }
    : never
  : never;

const initialContext = {
  selectedType: null,
  selectedId: null,
  connectedIds: []
} satisfies SelectionContext;

const unique = (ids: Array<number | null | undefined>): number[] =>
  [...new Set(ids.filter((value): value is number => value != null))];

const mapConnectedEntities = async (
  groups: Array<{ type: ConnectedEntity['type']; ids: number[] }>
): Promise<ConnectedEntity[]> => {
  const nodes = await db.canvasNodes.toArray();
  const connections: ConnectedEntity[] = [];

  for (const group of groups) {
    const ids = new Set(group.ids);

    for (const node of nodes) {
      if (!node.id || node.entityType !== group.type || !ids.has(node.entityId)) continue;
      connections.push({ type: group.type, id: node.entityId, canvasNodeId: node.id });
    }
  }

  return connections;
};

const resolveConnectedEntities = async (input: SelectionInput): Promise<ConnectedEntity[]> => {
  if (input.entityType === 'word') {
    const occurrences = await db.occurrences.where('wordId').equals(input.id).toArray();
    return mapConnectedEntities([
      { type: 'paragraph', ids: unique(occurrences.map((entry) => entry.paragraphId)) },
      { type: 'sentence', ids: unique(occurrences.map((entry) => entry.sentenceId)) }
    ]);
  }

  if (input.entityType === 'paragraph') {
    const [occurrences, sentences] = await Promise.all([
      db.occurrences.where('paragraphId').equals(input.id).toArray(),
      db.sentences.where('paragraphId').equals(input.id).toArray()
    ]);

    return mapConnectedEntities([
      { type: 'word', ids: unique(occurrences.map((entry) => entry.wordId)) },
      { type: 'sentence', ids: unique(sentences.map((entry) => entry.id)) }
    ]);
  }

  const [sentence, occurrences] = await Promise.all([
    db.sentences.get(input.id),
    db.occurrences.where('sentenceId').equals(input.id).toArray()
  ]);

  return mapConnectedEntities([
    { type: 'paragraph', ids: unique([sentence?.paragraphId]) },
    { type: 'word', ids: unique(occurrences.map((entry) => entry.wordId)) }
  ]);
};

export const selectionMachine = setup({
  types: {
    context: {} as SelectionContext,
    events: {} as SelectionEvent
  },
  actors: {
    loadConnectedEntities: fromPromise(async ({ input }: { input: SelectionInput }) =>
      resolveConnectedEntities(input)
    )
  }
}).createMachine({
  id: 'selection',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        SELECT: {
          target: 'loading',
          actions: assign({
            selectedType: ({ event }) => event.entityType,
            selectedId: ({ event }) => event.id,
            connectedIds: () => []
          })
        },
        DESELECT: {
          actions: assign(() => ({ ...initialContext }))
        }
      }
    },
    loading: {
      invoke: {
        src: 'loadConnectedEntities',
        input: ({ context }) => {
          if (context.selectedType == null || context.selectedId == null) {
            throw new Error('Selection missing');
          }

          return { entityType: context.selectedType, id: context.selectedId };
        },
        onDone: {
          target: 'selected',
          actions: assign({
            connectedIds: ({ event }) => event.output
          })
        },
        onError: {
          target: 'selected',
          actions: assign({
            connectedIds: () => []
          })
        }
      },
      on: {
        SELECT: {
          target: 'loading',
          actions: assign({
            selectedType: ({ event }) => event.entityType,
            selectedId: ({ event }) => event.id,
            connectedIds: () => []
          })
        },
        DESELECT: {
          target: 'idle',
          actions: assign(() => ({ ...initialContext }))
        }
      }
    },
    selected: {
      on: {
        SELECT: {
          target: 'loading',
          actions: assign({
            selectedType: ({ event }) => event.entityType,
            selectedId: ({ event }) => event.id,
            connectedIds: () => []
          })
        },
        DESELECT: {
          target: 'idle',
          actions: assign(() => ({ ...initialContext }))
        }
      }
    }
  }
});
