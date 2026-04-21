import { assign, setup } from 'xstate';
import type { WordnetContext, WordnetEvent } from '../../types/machine.types';

const initialContext = {
  status: 'idle',
  progress: 0,
  error: null
} satisfies WordnetContext;

export const wordnetMachine = setup({
  types: {
    context: {} as WordnetContext,
    events: {} as WordnetEvent
  }
}).createMachine({
  id: 'wordnet',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      entry: assign(() => ({ ...initialContext })),
      on: {
        START_SEED: 'checking',
        ERROR: {
          target: 'error',
          actions: assign({
            status: () => 'error' as const,
            error: ({ event }) => event.message
          })
        }
      }
    },
    checking: {
      entry: assign({
        status: () => 'checking' as const,
        progress: () => 0,
        error: () => null
      }),
      on: {
        PROGRESS: {
          target: 'seeding',
          actions: assign({
            progress: ({ event }) => event.value
          })
        },
        DONE: 'done',
        ERROR: {
          target: 'error',
          actions: assign({
            status: () => 'error' as const,
            error: ({ event }) => event.message
          })
        }
      }
    },
    seeding: {
      entry: assign({
        status: () => 'seeding' as const,
        error: () => null
      }),
      on: {
        PROGRESS: {
          actions: assign({
            progress: ({ event }) => event.value
          })
        },
        DONE: 'done',
        ERROR: {
          target: 'error',
          actions: assign({
            status: () => 'error' as const,
            error: ({ event }) => event.message
          })
        }
      }
    },
    done: {
      entry: assign({
        status: () => 'done' as const,
        progress: () => 100,
        error: () => null
      }),
      on: {
        START_SEED: 'checking'
      }
    },
    error: {
      on: {
        START_SEED: 'checking'
      }
    }
  }
});
