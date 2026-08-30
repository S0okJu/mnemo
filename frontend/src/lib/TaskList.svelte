<script lang="ts">
  import type { Document, Task } from "./api";

  let {
    tasks,
    documents,
    onCreate,
    onToggle,
    onDelete,
  }: {
    tasks: Task[];
    documents: Document[];
    onCreate: (title: string, documentName: string, due?: string) => void;
    onToggle: (id: string, status: Task["status"]) => void;
    onDelete: (id: string) => void;
  } = $props();

  let title = $state("");
  let documentName = $state("");
  let due = $state("");

  function submitCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim() || !documentName) return;
    onCreate(title.trim(), documentName, due || undefined);
    title = "";
    due = "";
  }

  let sorted = $derived(
    [...tasks].sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      return (a.due ?? "").localeCompare(b.due ?? "");
    }),
  );
</script>

<div class="task-list">
  <ul>
    {#each sorted as task (task.id)}
      <li class:done={task.status === "done"}>
        <input
          type="checkbox"
          checked={task.status === "done"}
          onchange={() => onToggle(task.id, task.status === "done" ? "pending" : "done")}
        />
        <div class="info">
          <span class="task-title">{task.title}</span>
          <span class="meta">
            <span class="doc-link">{task.document_name}</span>
            {#if task.due}<span class="due">· {task.due.slice(0, 10)}</span>{/if}
          </span>
        </div>
        <button type="button" class="delete" onclick={() => onDelete(task.id)} aria-label="Delete {task.title}">
          &times;
        </button>
      </li>
    {:else}
      <li class="empty">No tasks yet.</li>
    {/each}
  </ul>

  <form onsubmit={submitCreate}>
    <input placeholder="Task title" bind:value={title} required />
    <div class="row">
      <select bind:value={documentName} required>
        <option value="" disabled selected>Link a document…</option>
        {#each documents as doc (doc.name)}
          <option value={doc.name}>{doc.title || doc.name}</option>
        {/each}
      </select>
      <input type="date" bind:value={due} aria-label="Due date (optional)" />
    </div>
    <button type="submit" disabled={documents.length === 0}>Add task</button>
  </form>
  {#if documents.length === 0}
    <p class="hint">Create a document first — every task must link one.</p>
  {/if}
</div>

<style>
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.4rem;
    border-radius: 6px;
  }
  li:hover {
    background: var(--hover-bg);
  }
  li.empty {
    color: var(--muted);
  }
  .info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  li.done .task-title {
    text-decoration: line-through;
    color: var(--muted);
  }
  .meta {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .delete {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.95rem;
    padding: 0.2rem 0.4rem;
    visibility: hidden;
  }
  li:hover .delete {
    visibility: visible;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .row {
    display: flex;
    gap: 0.4rem;
  }
  .row select {
    flex: 1;
    min-width: 0;
  }
  form button[type="submit"] {
    align-self: flex-start;
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 6px;
    padding: 0.35rem 0.8rem;
    font-size: 0.85rem;
  }
  form button[type="submit"]:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  .hint {
    color: var(--muted);
    font-size: 0.85em;
  }
</style>
