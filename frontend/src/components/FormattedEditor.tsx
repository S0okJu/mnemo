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

// `initialBody` is only used to seed this component's contentEditable region
// on mount (the parent swaps this component in/out of the tree rather than
// updating the prop in place). Edits afterward live directly in the DOM;
// `getMarkdown()` reads them back out on demand via a ref handle instead of
// syncing through React state on every keystroke, which would otherwise
// reset the innerHTML and the caret position on each input.
const FormattedEditor = forwardRef<FormattedEditorHandle, Props>(function FormattedEditor(
  { initialBody, onDirty },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
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
        onInput={() => {
          onDirty();
          refreshHeadings();
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
