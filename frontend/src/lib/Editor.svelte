<script lang="ts">
  import type { Document } from "./api";

  let {
    doc,
    onSave,
  }: {
    doc: Document | null;
    onSave: (title: string, body: string) => void;
  } = $props();

  let title = $state("");
  let body = $state("");
  let dirty = $state(false);

  // Reset the local draft whenever a different document is selected.
  $effect(() => {
    title = doc?.title ?? "";
    body = doc?.body ?? "";
    dirty = false;
  });

  function save() {
    onSave(title, body);
    dirty = false;
  }
</script>

{#if doc}
  <div class="editor">
    <div class="toolbar">
      <input
        class="title"
        bind:value={title}
        oninput={() => (dirty = true)}
        placeholder="Title"
      />
      <button type="button" class="save" onclick={save} disabled={!dirty}>Save</button>
    </div>
    <textarea
      bind:value={body}
      oninput={() => (dirty = true)}
      placeholder="Write markdown here..."
      rows="24"
    ></textarea>
  </div>
{:else}
  <p class="empty">Select or create a document to start editing.</p>
{/if}

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .title {
    flex: 1;
    font-size: 1.2rem;
    font-weight: 600;
    border: none;
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
  }
  .title:focus {
    outline: none;
    border-bottom-color: var(--accent);
  }
  .save {
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 6px;
    padding: 0.35rem 0.9rem;
    font-size: 0.85rem;
  }
  .save:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  .save:disabled {
    color: var(--muted);
    cursor: default;
  }
  textarea {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    width: 100%;
    resize: vertical;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem;
    box-sizing: border-box;
  }
  .empty {
    color: var(--muted);
    padding: 1.75rem 2rem;
  }
</style>
