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

  let newName = $state("");
  let newTitle = $state("");

  function submitCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!newName.trim() || !newTitle.trim()) return;
    onCreate(newName.trim(), newTitle.trim());
    newName = "";
    newTitle = "";
  }
</script>

<div class="workspace-list">
  <h2>Documents</h2>

  <ul>
    {#each documents as doc (doc.name)}
      <li class:selected={doc.name === selectedName}>
        <button type="button" onclick={() => onSelect(doc.name)}>
          {doc.title || doc.name}
        </button>
        <button type="button" class="delete" onclick={() => onDelete(doc.name)} aria-label="Delete {doc.name}">
          &times;
        </button>
      </li>
    {:else}
      <li class="empty">No documents yet.</li>
    {/each}
  </ul>

  <form onsubmit={submitCreate}>
    <input placeholder="name (e.g. notes)" bind:value={newName} required />
    <input placeholder="title" bind:value={newTitle} required />
    <button type="submit">New document</button>
  </form>
</div>

<style>
  .workspace-list {
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
    gap: 0.25rem;
  }
  li.selected button:first-child {
    font-weight: bold;
  }
  li.empty {
    color: var(--muted, #888);
  }
  li button:first-child {
    flex: 1;
    text-align: left;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }
</style>
