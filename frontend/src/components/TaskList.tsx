import { useMemo, useState, type FormEvent } from "react";
import type { Document, Task } from "../lib/api";
import styles from "./TaskList.module.css";

interface Props {
  tasks: Task[];
  documents: Document[];
  onCreate: (title: string, documentName: string, due?: string) => void;
  onToggle: (id: string, status: Task["status"]) => void;
  onDelete: (id: string) => void;
}

export default function TaskList({ tasks, documents, onCreate, onToggle, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [due, setDue] = useState("");

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !documentName) return;
    onCreate(title.trim(), documentName, due || undefined);
    setTitle("");
    setDue("");
  }

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return (a.due ?? "").localeCompare(b.due ?? "");
      }),
    [tasks],
  );

  return (
    <div className={styles.taskList}>
      <ul>
        {sorted.length === 0 && <li className={styles.empty}>No tasks yet.</li>}
        {sorted.map((task) => (
          <li key={task.id} className={task.status === "done" ? styles.done : undefined}>
            <input
              type="checkbox"
              checked={task.status === "done"}
              onChange={() => onToggle(task.id, task.status === "done" ? "pending" : "done")}
            />
            <div className={styles.info}>
              <span className={styles.taskTitle}>{task.title}</span>
              <span className={styles.meta}>
                <span className={styles.docLink}>{task.document_name}</span>
                {task.due && <span className={styles.due}> · {task.due.slice(0, 10)}</span>}
              </span>
            </div>
            <button
              type="button"
              className={styles.delete}
              onClick={() => onDelete(task.id)}
              aria-label={`Delete ${task.title}`}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submitCreate}>
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <div className={styles.row}>
          <select
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            required
          >
            <option value="" disabled>
              Link a document…
            </option>
            {documents.map((doc) => (
              <option value={doc.name} key={doc.name}>
                {doc.title || doc.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date (optional)"
          />
        </div>
        <button type="submit" disabled={documents.length === 0}>
          Add task
        </button>
      </form>
      {documents.length === 0 && (
        <p className={styles.hint}>Create a document first — every task must link one.</p>
      )}
    </div>
  );
}
