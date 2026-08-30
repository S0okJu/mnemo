import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { htmlToMarkdown, renderMarkdown } from "../lib/markdown";
import styles from "./FormattedEditor.module.css";

export interface FormattedEditorHandle {
  getMarkdown: () => string;
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface Props {
  initialBody: string;
  onDirty: () => void;
}

function slugify(text: string, seen: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-") || "section";
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

// Counting from the end of the text (rather than from the start) keeps the
// caret anchored correctly across a DOM swap: these rules only ever consume
// characters strictly before the caret (the markdown marker just typed),
// leaving everything after the caret untouched, so its distance to the end
// of the block stays constant even though the block's total length shrinks.
function getCaretOffsetFromEnd(container: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.endContainer)) return null;

  const afterRange = document.createRange();
  afterRange.selectNodeContents(container);
  afterRange.setStart(range.endContainer, range.endOffset);
  return afterRange.toString().length;
}

function setCaretOffsetFromEnd(container: HTMLElement, offsetFromEnd: number) {
  const total = container.textContent?.length ?? 0;
  let remaining = Math.max(0, total - offsetFromEnd);

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= len;
    node = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

// The element holding the caret that block-level rules should act on:
// either a top-level child of `container` (contentEditable represents each
// line/paragraph as one of these), or an `<li>` if the caret is nested
// inside a list — an `<li>`'s own text is what a marker like "> " gets
// typed into, and it needs to be treated as its own block so that marker
// can convert it (see `replaceListItemBlock`).
function getBlockElement(container: HTMLElement, node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== container) {
    if (current.parentNode === container) {
      return current instanceof HTMLElement ? current : null;
    }
    if (current instanceof HTMLElement && current.tagName === "LI") {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

// Converting a list item into something else (heading, quote, hr, ...)
// can't just replace it in place — a non-<li> direct child of a <ul>/<ol>
// is invalid structurally. Instead split the list around it: everything
// before the item keeps its own list, everything after gets another, and
// the converted node(s) go in between (either half is omitted if empty).
function replaceListItemBlock(li: HTMLElement, converted: Node[]) {
  const list = li.parentElement;
  if (!list) {
    li.replaceWith(...converted);
    return;
  }

  const items = [...list.children];
  const idx = items.indexOf(li);
  const before = items.slice(0, idx);
  const after = items.slice(idx + 1);

  const pieces: Node[] = [];
  if (before.length > 0) {
    const head = list.cloneNode(false) as HTMLElement;
    head.append(...before);
    pieces.push(head);
  }
  pieces.push(...converted);
  if (after.length > 0) {
    const tail = list.cloneNode(false) as HTMLElement;
    tail.append(...after);
    pieces.push(tail);
  }
  list.replaceWith(...pieces);
}

// Converts a freshly-typed block-starting marker ("# ", "- ", "1. ", "> ")
// into the matching element. Skips blocks that are already one of these
// special tags (from the initial render or an earlier keystroke) so it never
// re-fires on the same block; a fresh, not-yet-converted block is a plain
// <p> in most browsers, but Chrome's contentEditable sometimes falls back to
// a bare <div> for a line started after a heading, so both are eligible.
const ALREADY_SPECIAL_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "BLOCKQUOTE"]);

// contentEditable can't hold a caret inside a genuinely childless element —
// browsers only accept text-insertion focus there once it has at least a
// <br> placeholder (the same reason an "empty line" is `<p><br></p>`, not
// `<p></p>`). Converting straight into an empty `<h3></h3>` right after
// typing "### " would silently bounce the caret back to wherever it last
// definitely worked (the previous block), letting the next keystroke land
// there instead — so anything created with no text content gets a `<br>`.
function setTextOrPlaceholder(el: HTMLElement, text: string) {
  if (text) {
    el.textContent = text;
  } else {
    el.append(document.createElement("br"));
  }
}

function applyBlockRule(block: HTMLElement): HTMLElement[] | null {
  if (ALREADY_SPECIAL_TAGS.has(block.tagName)) return null;
  const text = block.textContent ?? "";

  const heading = /^(#{1,6})\s+(.*)$/s.exec(text);
  if (heading) {
    const el = document.createElement(`h${heading[1].length}`);
    setTextOrPlaceholder(el, heading[2]);
    return [el];
  }

  // Skip re-matching "- "/"1. " on a block that's already a list item —
  // being inside a <li> already satisfies that, so retyping the marker
  // (e.g. from pasted text) would otherwise split the list around a
  // redundant single-item list instead of just leaving it alone.
  if (block.tagName !== "LI") {
    const bullet = /^[-*]\s+(.*)$/s.exec(text);
    if (bullet) {
      const ul = document.createElement("ul");
      const li = document.createElement("li");
      setTextOrPlaceholder(li, bullet[1]);
      ul.append(li);
      return [ul];
    }

    const ordered = /^\d+\.\s+(.*)$/s.exec(text);
    if (ordered) {
      const ol = document.createElement("ol");
      const li = document.createElement("li");
      setTextOrPlaceholder(li, ordered[1]);
      ol.append(li);
      return [ol];
    }
  }

  const quote = /^>\s+(.*)$/s.exec(text);
  if (quote) {
    const blockquote = document.createElement("blockquote");
    const p = document.createElement("p");
    setTextOrPlaceholder(p, quote[1]);
    blockquote.append(p);
    return [blockquote];
  }

  // A void element, so it can't hold a caret — the trailing empty paragraph
  // gives typing somewhere to continue after the rule.
  const hr = /^(-{3,}|\*{3,}|_{3,})$/.exec(text);
  if (hr) {
    const rule = document.createElement("hr");
    const next = document.createElement("p");
    next.append(document.createElement("br"));
    return [rule, next];
  }

  return null;
}

function tagWithText(name: "strong" | "em" | "code", text: string): HTMLElement {
  const el = document.createElement(name);
  el.textContent = text;
  return el;
}

function strongEm(text: string): HTMLElement {
  const strong = document.createElement("strong");
  strong.append(tagWithText("em", text));
  return strong;
}

interface InlineRule {
  re: RegExp;
  // Capture group holding the boundary character before the opening marker
  // (empty string at the very start of the text), or null for markers like
  // `` ` `` that don't need one.
  boundaryGroup: number | null;
  innerGroup: number;
  build: (text: string) => HTMLElement;
}

// Converts an inline span that was just closed right at the caret
// ("**bold**", "*italic*", "`code`") into the matching element. Each regex
// is anchored at the end of the pre-caret text and, for the single-marker
// forms, requires the character before the opening marker not to be the
// same marker — otherwise "**bold**" would also spuriously match italic's
// single-"*" pattern on its inner "*bold*" substring. The triple-marker
// (bold+italic) rules are checked first for the same reason: "***x***"
// would otherwise partially satisfy the plain bold or italic pattern.
const INLINE_RULES: InlineRule[] = [
  { re: /(^|[^*])\*\*\*([^*\n]+)\*\*\*$/, boundaryGroup: 1, innerGroup: 2, build: strongEm },
  { re: /(^|[^_])___([^_\n]+)___$/, boundaryGroup: 1, innerGroup: 2, build: strongEm },
  { re: /(^|[^*])\*\*([^*\n]+)\*\*$/, boundaryGroup: 1, innerGroup: 2, build: (t) => tagWithText("strong", t) },
  { re: /(^|[^_])__([^_\n]+)__$/, boundaryGroup: 1, innerGroup: 2, build: (t) => tagWithText("strong", t) },
  { re: /`([^`\n]+)`$/, boundaryGroup: null, innerGroup: 1, build: (t) => tagWithText("code", t) },
  { re: /(^|[^*])\*([^*\n]+)\*$/, boundaryGroup: 1, innerGroup: 2, build: (t) => tagWithText("em", t) },
  { re: /(^|[^_])_([^_\n]+)_$/, boundaryGroup: 1, innerGroup: 2, build: (t) => tagWithText("em", t) },
];

const LINK_RULE = /\[([^\]\n]+)\]\(([^)\s]+)\)$/;

// Replaces `node`'s text from `markerStart` to `caret` with `el`, then parks
// the caret just past it. A caret placed in a *genuinely empty* text node
// right after `el` doesn't reliably stick in Chrome: since an empty node
// renders no visible position, the next typed character lands back inside
// `el`'s own text instead (verified — every further character kept nesting
// one level deeper). A zero-width space gives that spacer node real,
// addressable content so the caret has somewhere unambiguous to sit;
// `htmlToMarkdown` strips it back out before saving.
function replaceInlineSpan(node: Text, markerStart: number, caret: number, el: HTMLElement, selection: Selection) {
  const editRange = document.createRange();
  editRange.setStart(node, markerStart);
  editRange.setEnd(node, caret);
  editRange.deleteContents();
  editRange.insertNode(el);

  const spacer = document.createTextNode("​");
  el.after(spacer);
  const after = document.createRange();
  after.setStart(spacer, 1);
  after.collapse(true);
  selection.removeAllRanges();
  selection.addRange(after);
}

function applyInlineRule(container: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || range.endContainer.nodeType !== Node.TEXT_NODE) return false;
  const node = range.endContainer as Text;
  if (!container.contains(node)) return false;

  const text = node.textContent ?? "";
  const caret = range.endOffset;
  const before = text.slice(0, caret);

  const link = LINK_RULE.exec(before);
  if (link) {
    const a = document.createElement("a");
    a.href = link[2];
    a.textContent = link[1];
    replaceInlineSpan(node, link.index, caret, a, selection);
    return true;
  }

  for (const rule of INLINE_RULES) {
    const match = rule.re.exec(before);
    if (!match) continue;

    const inner = match[rule.innerGroup];
    const boundary = rule.boundaryGroup !== null ? match[rule.boundaryGroup] : "";
    const markerStart = match.index + boundary.length;
    replaceInlineSpan(node, markerStart, caret, rule.build(inner), selection);
    return true;
  }
  return false;
}

// `initialBody` is only used to seed this component's contentEditable region
// on mount (the parent swaps this component in/out of the tree rather than
// updating the prop in place). Afterward, typed markdown syntax is converted
// live via small, targeted DOM edits (`applyBlockRule` / `applyInlineRule`)
// rather than a full markdown round-trip: turndown intentionally *escapes*
// literal look-alike text such as "### " inside a plain <p> (it can't tell
// that was just typed on purpose), so round-tripping the whole block through
// htmlToMarkdown -> renderMarkdown would never actually apply the formatting.
// `getMarkdown()` still uses that round-trip, but only at save time, once
// the DOM already holds real <h1>/<strong>/<li> elements from these edits.
const FormattedEditor = forwardRef<FormattedEditorHandle, Props>(function FormattedEditor(
  { initialBody, onDirty },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const [headings, setHeadings] = useState<Heading[]>([]);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => (containerRef.current ? htmlToMarkdown(containerRef.current.innerHTML) : initialBody),
  }));

  function refreshHeadings() {
    const container = containerRef.current;
    if (!container) return;

    const seen = new Map<string, number>();
    const found: Heading[] = [];
    container.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
      const text = el.textContent?.trim() ?? "";
      const id = slugify(text, seen);
      el.id = id;
      found.push({ id, text, level: Number(el.tagName[1]) });
    });
    setHeadings(found);
  }

  function reformat() {
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0) return;

    const block = getBlockElement(container, selection.getRangeAt(0).endContainer);
    if (!block) return;

    const converted = applyBlockRule(block);
    if (converted) {
      const offsetFromEnd = getCaretOffsetFromEnd(block);
      if (block.tagName === "LI") {
        replaceListItemBlock(block, converted);
      } else {
        block.replaceWith(...converted);
      }
      // Caret lands in the last new node — for a single element that's the
      // only choice; for hr's [<hr>, <p>] pair it's the trailing paragraph,
      // the only one of the two that can actually hold a caret.
      const target = converted[converted.length - 1];
      if (offsetFromEnd !== null && target) setCaretOffsetFromEnd(target, offsetFromEnd);
      refreshHeadings();
      return;
    }

    if (applyInlineRule(block)) {
      refreshHeadings();
    }
  }

  function goTo(id: string) {
    containerRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className={styles.wrap}>
      <div
        ref={(el) => {
          containerRef.current = el;
          if (el && el.childNodes.length === 0) {
            el.innerHTML = renderMarkdown(initialBody);
            refreshHeadings();
          }
        }}
        className={styles.content}
        contentEditable
        suppressContentEditableWarning
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          onDirty();
          reformat();
        }}
        onInput={() => {
          onDirty();
          // Mid-composition (e.g. typing Hangul), leave the DOM alone —
          // replacing it here would cut the IME's composition short.
          if (composingRef.current) return;
          reformat();
        }}
      />
      {headings.length > 0 && (
        <aside className={styles.outline}>
          <div className={styles.outlineTitle}>Outline</div>
          <ul>
            {headings.map((h) => (
              <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 0.7}rem` }}>
                <button type="button" onClick={() => goTo(h.id)}>
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
});

export default FormattedEditor;
