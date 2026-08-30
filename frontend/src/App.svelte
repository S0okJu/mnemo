<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError, type Document, type Task } from "./lib/api";
  import WorkspaceList from "./lib/WorkspaceList.svelte";
  import Editor from "./lib/Editor.svelte";
  import Calendar from "./lib/Calendar.svelte";

  let documents = $state<Document[]>([]);
  let tasks = $state<Task[]>([]);
  let selectedName = $state<string | null>(null);
  let error = $state<string | null>(null);

  let selectedDoc = $derived(
    documents.find((d) => d.name === selectedName) ?? null,
  );

  async function refreshDocuments() {
    documents = await api.listDocuments();
  }

  async function refreshTasks() {
    tasks = await api.listTasks();
  }

  async function run(action: () => Promise<void>) {
    error = null;
    try {
      await action();
    } catch (err) {
      error = err instanceof ApiError ? err.message : String(err);
    }
  }

  onMount(() => {
    run(async () => {
      await Promise.all([refreshDocuments(), refreshTasks()]);
    });
  });

  function selectDocument(name: string) {
    selectedName = name;
  }

  function createDocument(name: string, title: string) {
    run(async () => {
      await api.createDocument(name, title, "");
      await refreshDocuments();
      selectedName = name;
    });
  }

  function saveDocument(title: string, body: string) {
    if (!selectedName) return;
    const name = selectedName;
    run(async () => {
      await api.updateDocument(name, title, body);
      await refreshDocuments();
    });
  }

  function deleteDocument(name: string) {
    run(async () => {
      await api.deleteDocument(name);
      if (selectedName === name) selectedName = null;
      await refreshDocuments();
    });
  }

  function createTask(title: string, documentName: string) {
    run(async () => {
      await api.createTask(title, documentName);
      await refreshTasks();
    });
  }

  function toggleTask(id: string, status: Task["status"]) {
    run(async () => {
      await api.updateTaskStatus(id, status);
      await refreshTasks();
    });
  }

  function deleteTask(id: string) {
    run(async () => {
      await api.deleteTask(id);
      await refreshTasks();
    });
  }
</script>

<main>
  <h1>mnemo</h1>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="layout">
    <aside>
      <WorkspaceList
        {documents}
        {selectedName}
        onSelect={selectDocument}
        onCreate={createDocument}
        onDelete={deleteDocument}
      />
      <Calendar
        {tasks}
        {documents}
        onCreate={createTask}
        onToggle={toggleTask}
        onDelete={deleteTask}
      />
    </aside>
    <section class="editor-pane">
      <Editor doc={selectedDoc} onSave={saveDocument} />
    </section>
  </div>
</main>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 1rem;
  }
  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.5rem;
    align-items: start;
  }
  aside {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .error {
    color: #c0392b;
  }
</style>
