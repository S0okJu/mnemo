import { useState, type FormEvent } from "react";
import type { Document } from "../lib/api";
import styles from "./FileTree.module.css";

interface Props {
  documents: Document[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  onCreate: (name: string, title: string) => void;
  onDelete: (name: string) => void;
}

export default function FileTree({
  documents,
  selectedName,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim() || !newTitle.trim()) return;
    onCreate(newName.trim(), newTitle.trim());
    setNewName("");
    setNewTitle("");
    setCreating(false);
  }

  return (
    <div className={styles.fileTree}>
      <div className={styles.treeHeader}>
        <span className={styles.folder}>
          <span className={styles.chevron}>▾</span> workspace
        </span>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setCreating((v) => !v)}
          aria-label="New document"
        >
          +
        </button>
      </div>

      {creating && (
        <form className={styles.newDocForm} onSubmit={submitCreate}>
          <input
            placeholder="name (e.g. notes)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <input
            placeholder="title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <div className={styles.formActions}>
            <button type="submit">Add</button>
            <button type="button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul>
        {documents.length === 0 && <li className={styles.empty}>No documents yet.</li>}
        {documents.map((doc) => (
          <li key={doc.name} className={doc.name === selectedName ? styles.selected : undefined}>
            <button type="button" className={styles.docButton} onClick={() => onSelect(doc.name)}>
              <span className={styles.fileIcon}>📄</span>
              <span className={styles.fileName}>{doc.title || doc.name}</span>
            </button>
            <button
              type="button"
              className={styles.delete}
              onClick={() => onDelete(doc.name)}
              aria-label={`Delete ${doc.name}`}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
