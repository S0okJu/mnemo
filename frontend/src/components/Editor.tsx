import { useState } from "react";
import type { Document } from "../lib/api";
import styles from "./Editor.module.css";

interface Props {
  doc: Document | null;
  onSave: (title: string, body: string) => void;
}

// The parent renders this with `key={doc?.name}`, so React remounts it (and
// re-initializes this state from props) whenever a different document is
// selected, instead of an effect resetting a stale draft after the fact.
export default function Editor({ doc, onSave }: Props) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [body, setBody] = useState(doc?.body ?? "");
  const [dirty, setDirty] = useState(false);

  function save() {
    onSave(title, body);
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
        <button type="button" className={styles.save} onClick={save} disabled={!dirty}>
          Save
        </button>
      </div>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setDirty(true);
        }}
        placeholder="Write markdown here..."
        rows={24}
      />
    </div>
  );
}
