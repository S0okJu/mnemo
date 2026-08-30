<script lang="ts">
  import type { Document } from "./api";

  let {
    documents,
    selectedName,
    onSelect,
    onCreate,
    onDelete,
  }: {
    documents: Document[];
    selectedName: string | null;
    onSelect: (name: string) => void;
    onCreate: (name: string, title: string) => void;
    onDelete: (name: string) => void;
  } = $props();

  let creating = $state(false);
  let newName = $state("");
  let newTitle = $state("");

  function submitCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!newName.trim() || !newTitle.trim()) return;
    onCreate(newName.trim(), newTitle.trim());
    newName = "";
    newTitle = "";
    creating = false;
  }
</script>

<div class="file-tree">
  <div class="tree-header">
    <span class="folder"><span class="chevron">▾</span> workspace</span>
    <button type="button" class="icon-button" onclick={() => (creating = !creating)} aria-label="New document">
      +
    </button>
  </div>

  {#if creating}
    <form class="new-doc-form" onsubmit={submitCreate}>
      <input placeholder="name (e.g. notes)" bind:value={newName} required />
      <input placeholder="title" bind:value={newTitle} required />
      <div class="form-actions">
        <button type="submit">Add</button>
        <button type="button" onclick={() => (creating = false)}>Cancel</button>
      </div>
    </form>
  {/if}

  <ul>
    {#each documents as doc (doc.name)}
      <li class:selected={doc.name === selectedName}>
        <button type="button" class="doc-button" onclick={() => onSelect(doc.name)}>
          <span class="file-icon">📄</span>
          <span class="file-name">{doc.title || doc.name}</span>
        </button>
        <button type="button" class="delete" onclick={() => onDelete(doc.name)} aria-label="Delete {doc.name}">
          &times;
        </button>
      </li>
    {:else}
      <li class="empty">No documents yet.</li>
    {/each}
  </ul>
</div>

<style>
  .file-tree {
    background: var(--panel-bg);
    border-right: 1px solid var(--border);
    height: 100%;
    overflow-y: auto;
    padding: 0.6rem 0.5rem;
    box-sizing: border-box;
  }
  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.2rem 0.3rem 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .chevron {
    display: inline-block;
    margin-right: 0.15rem;
    font-size: 0.7rem;
  }
  .icon-button {
    background: none;
    border: none;
    font-size: 1rem;
    line-height: 1;
    color: var(--muted);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }
  .icon-button:hover {
    background: var(--hover-bg);
    color: var(--text);
  }
  .new-doc-form {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.4rem 0.3rem 0.6rem;
  }
  .new-doc-form input {
    font-size: 0.85rem;
    padding: 0.3rem 0.45rem;
  }
  .form-actions {
    display: flex;
    gap: 0.35rem;
  }
  .form-actions button {
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: var(--bg);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    border-radius: 6px;
  }
  li:hover {
    background: var(--hover-bg);
  }
  li.selected {
    background: var(--active-bg);
  }
  li.empty {
    color: var(--muted);
    font-size: 0.85rem;
    padding: 0.4rem 0.5rem;
  }
  .doc-button {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    text-align: left;
    padding: 0.35rem 0.4rem;
    font-size: 0.88rem;
    color: var(--text);
    min-width: 0;
  }
  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .delete {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.95rem;
    padding: 0.2rem 0.5rem;
    visibility: hidden;
  }
  li:hover .delete {
    visibility: visible;
  }
  .delete:hover {
    color: var(--text);
  }
</style>
