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
    <input
      class="title"
      bind:value={title}
      oninput={() => (dirty = true)}
      placeholder="Title"
    />
    <textarea
      bind:value={body}
      oninput={() => (dirty = true)}
      placeholder="Write markdown here..."
      rows="20"
    ></textarea>
    <button type="button" onclick={save} disabled={!dirty}>Save</button>
  </div>
{:else}
  <p class="empty">Select or create a document to start editing.</p>
{/if}

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .title {
    font-size: 1.1rem;
    font-weight: bold;
  }
  textarea {
    font-family: monospace;
    width: 100%;
    resize: vertical;
  }
  .empty {
    color: var(--muted, #888);
  }
</style>
