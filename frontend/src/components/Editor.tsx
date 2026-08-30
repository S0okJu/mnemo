import { useRef, useState } from "react";
import type { Document } from "../lib/api";
import FormattedEditor, { type FormattedEditorHandle } from "./FormattedEditor";
import styles from "./Editor.module.css";

interface Props {
  doc: Document | null;
  onSave: (title: string, body: string) => void;
}

type Mode = "source" | "formatted";

// The parent renders this with `key={doc?.name}`, so React remounts it (and
// re-initializes this state from props) whenever a different document is
// selected, instead of an effect resetting a stale draft after the fact.
export default function Editor({ doc, onSave }: Props) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [body, setBody] = useState(doc?.body ?? "");
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<Mode>("source");
  const formattedRef = useRef<FormattedEditorHandle>(null);

  // The formatted view edits its own contentEditable DOM directly rather
  // than round-tripping through `body` on every keystroke, so this is the
  // one place that pulls its latest markdown out when we actually need it.
  function latestBody(): string {
    return mode === "formatted" && formattedRef.current ? formattedRef.current.getMarkdown() : body;
  }

  function toggleMode() {
    if (mode === "source") {
      setMode("formatted");
    } else {
      setBody(latestBody());
      setMode("source");
    }
  }

  function save() {
    const current = latestBody();
    setBody(current);
    onSave(title, current);
    setDirty(false);
  }

  if (!doc) {
    return <p className={styles.empty}>Select or create a document to start editing.</p>;
  }

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <input
          className={styles.title}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Title"
        />
        <button
          type="button"
          className={`${styles.modeToggle} ${mode === "formatted" ? styles.modeToggleActive : ""}`}
          onClick={toggleMode}
          aria-pressed={mode === "formatted"}
          title={mode === "source" ? "Switch to formatted view" : "Switch to markdown source"}
        >
          M↓
        </button>
        <button type="button" className={styles.save} onClick={save} disabled={!dirty}>
          Save
        </button>
      </div>
      {mode === "source" ? (
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setDirty(true);
          }}
          placeholder="Write markdown here..."
          rows={24}
        />
      ) : (
        <FormattedEditor key={doc.name} ref={formattedRef} initialBody={body} onDirty={() => setDirty(true)} />
      )}
    </div>
  );
}
