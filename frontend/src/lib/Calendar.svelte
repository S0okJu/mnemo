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
    onCreate: (title: string, documentName: string) => void;
    onToggle: (id: string, status: Task["status"]) => void;
    onDelete: (id: string) => void;
  } = $props();

  let title = $state("");
  let documentName = $state("");

  function submitCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim() || !documentName) return;
    onCreate(title.trim(), documentName);
    title = "";
  }
</script>

<div class="calendar">
  <h2>Calendar</h2>

  <ul>
    {#each tasks as task (task.id)}
      <li class:done={task.status === "done"}>
        <input
          type="checkbox"
          checked={task.status === "done"}
          onchange={() => onToggle(task.id, task.status === "done" ? "pending" : "done")}
        />
        <span class="task-title">{task.title}</span>
        <span class="doc-link">→ {task.document_name}</span>
        <button type="button" class="delete" onclick={() => onDelete(task.id)} aria-label="Delete {task.title}">
          &times;
        </button>
      </li>
    {:else}
      <li class="empty">No tasks yet.</li>
    {/each}
  </ul>

  <form onsubmit={submitCreate}>
    <input placeholder="task title" bind:value={title} required />
    <select bind:value={documentName} required>
      <option value="" disabled selected>Link a document…</option>
      {#each documents as doc (doc.name)}
        <option value={doc.name}>{doc.title || doc.name}</option>
      {/each}
    </select>
    <button type="submit" disabled={documents.length === 0}>New task</button>
  </form>
  {#if documents.length === 0}
    <p class="hint">Create a document first — every task must link one.</p>
  {/if}
</div>

<style>
  .calendar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  li.done .task-title {
    text-decoration: line-through;
    color: var(--muted, #888);
  }
  li.empty {
    color: var(--muted, #888);
  }
  .doc-link {
    color: var(--muted, #888);
    font-size: 0.9em;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }
  .hint {
    color: var(--muted, #888);
    font-size: 0.9em;
  }
</style>
