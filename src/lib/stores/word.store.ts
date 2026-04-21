import { writable } from 'svelte/store';
import type { WordRecord } from '../../types/research.types';

interface WordStoreState {
  words: WordRecord[];
  selectedWordId: number | null;
  hoveredWordId: number | null;
}

const initialState: WordStoreState = {
  words: [],
  selectedWordId: null,
  hoveredWordId: null
};

const { subscribe, update } = writable<WordStoreState>(initialState);

export const wordStore = {
  subscribe,
  reset: () => update(() => initialState),
  setWords: (words: WordRecord[]) =>
    update((state) => ({
      ...state,
      words,
      selectedWordId:
        state.selectedWordId && words.some((word) => word.id === state.selectedWordId)
          ? state.selectedWordId
          : words[0]?.id ?? null
    })),
  selectWord: (wordId: number | null) => update((state) => ({ ...state, selectedWordId: wordId })),
  hoverWord: (wordId: number | null) => update((state) => ({ ...state, hoveredWordId: wordId })),
  patchWord: (wordId: number, data: Partial<WordRecord>) =>
    update((state) => ({
      ...state,
      words: state.words.map((word) => (word.id === wordId ? { ...word, ...data } : word))
    }))
};
