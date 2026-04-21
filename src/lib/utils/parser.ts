import type { SentenceSelection } from '../../types/research.types';

const getTextOffset = (root: HTMLElement, container: Node, localOffset: number): number | null => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let offset = 0;

  while (node) {
    const length = node.textContent?.length ?? 0;

    if (node === container) {
      return offset + localOffset;
    }

    offset += length;
    node = walker.nextNode();
  }

  return null;
};

export const getSelectionOffsets = (
  root: HTMLElement,
  range: Range
): { startOffset: number; endOffset: number } | null => {
  const startOffset = getTextOffset(root, range.startContainer, range.startOffset);
  const endOffset = getTextOffset(root, range.endContainer, range.endOffset);

  if (startOffset == null || endOffset == null) {
    return null;
  }

  return { startOffset, endOffset };
};

export const resolveSentenceSelection = (
  content: string,
  startOffset: number,
  endOffset: number
): SentenceSelection | null => {
  const lower = Math.min(startOffset, endOffset);
  const upper = Math.max(startOffset, endOffset);
  const raw = content.slice(lower, upper);

  if (!raw.trim()) {
    return null;
  }

  const leading = raw.search(/\S/);
  const trailing = raw.length - raw.trimEnd().length;
  const normalizedStart = lower + leading;
  const normalizedEnd = upper - trailing;

  return {
    text: content.slice(normalizedStart, normalizedEnd),
    startOffset: normalizedStart,
    endOffset: normalizedEnd
  };
};
