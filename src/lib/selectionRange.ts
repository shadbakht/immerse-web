export interface SelectionPassages {
  startPassageId: string;
  endPassageId: string;
  text: string;
}

/**
 * Resolve a live browser Selection to the data-pid of the paragraphs it starts
 * and ends in, plus its text. Returns null if the selection is collapsed, empty,
 * whitespace-only, or not anchored inside `reader`. Pure — no layout reads, so it
 * is testable in jsdom and shared by the mouse and touch paths in ReaderPanel.
 */
export function resolveSelectionPassages(
  sel: Selection | null,
  reader: HTMLElement | null,
): SelectionPassages | null {
  if (!sel || sel.isCollapsed || !reader) return null;
  const text = sel.toString();
  if (!text.trim()) return null;
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);

  const container = (node: Node): Element | null =>
    (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)) ?? null;

  const startEl = container(range.startContainer)?.closest('[data-pid]') as HTMLElement | null;
  const endEl = container(range.endContainer)?.closest('[data-pid]') as HTMLElement | null;
  if (!startEl || !endEl) return null;
  if (!reader.contains(startEl) || !reader.contains(endEl)) return null;

  return {
    startPassageId: startEl.dataset.pid!,
    endPassageId: endEl.dataset.pid!,
    text,
  };
}
