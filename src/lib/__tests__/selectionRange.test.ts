import { resolveSelectionPassages } from '../selectionRange';

function makeReader(html: string) {
  const reader = document.createElement('div');
  reader.innerHTML = html;
  document.body.appendChild(reader);
  return reader;
}

describe('resolveSelectionPassages', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('returns start/end pids and trimmed text for an in-paragraph selection', () => {
    const reader = makeReader('<p data-pid="a1">Hello brave world</p>');
    const t = reader.querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(t, 6);
    range.setEnd(t, 11);
    const sel = { isCollapsed: false, toString: () => 'brave', getRangeAt: () => range, rangeCount: 1 } as unknown as Selection;
    expect(resolveSelectionPassages(sel, reader)).toEqual({
      startPassageId: 'a1', endPassageId: 'a1', text: 'brave',
    });
  });

  it('spans two paragraphs', () => {
    const reader = makeReader('<p data-pid="a1">one</p><p data-pid="a2">two</p>');
    const [p1, p2] = reader.querySelectorAll('p');
    const range = document.createRange();
    range.setStart(p1.firstChild!, 0);
    range.setEnd(p2.firstChild!, 3);
    const sel = { isCollapsed: false, toString: () => 'one\ntwo', getRangeAt: () => range, rangeCount: 1 } as unknown as Selection;
    expect(resolveSelectionPassages(sel, reader)).toEqual({
      startPassageId: 'a1', endPassageId: 'a2', text: 'one\ntwo',
    });
  });

  it('returns null for a collapsed / empty / whitespace selection', () => {
    const reader = makeReader('<p data-pid="a1">hi</p>');
    expect(resolveSelectionPassages({ isCollapsed: true } as Selection, reader)).toBeNull();
    const range = document.createRange();
    range.selectNodeContents(reader.querySelector('p')!);
    const sel = { isCollapsed: false, toString: () => '   ', getRangeAt: () => range, rangeCount: 1 } as unknown as Selection;
    expect(resolveSelectionPassages(sel, reader)).toBeNull();
  });

  it('returns null when the selection is outside the reader element', () => {
    const reader = makeReader('<p data-pid="a1">hi</p>');
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.appendChild(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    const sel = { isCollapsed: false, toString: () => 'elsewhere', getRangeAt: () => range, rangeCount: 1 } as unknown as Selection;
    expect(resolveSelectionPassages(sel, reader)).toBeNull();
  });

  it('returns null when reader is null', () => {
    const sel = { isCollapsed: false, toString: () => 'x', rangeCount: 1 } as unknown as Selection;
    expect(resolveSelectionPassages(sel, null)).toBeNull();
  });
});
