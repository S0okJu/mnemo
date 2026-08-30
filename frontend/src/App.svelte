<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError, type Document, type Task } from "./lib/api";
  import NavRail from "./lib/NavRail.svelte";
  import FileTree from "./lib/FileTree.svelte";
  import Editor from "./lib/Editor.svelte";
  import TasksView from "./lib/TasksView.svelte";
  import CalendarView from "./lib/CalendarView.svelte";

  type View = "tasks" | "calendar";

  let documents = $state<Document[]>([]);
  let tasks = $state<Task[]>([]);
  let selectedName = $state<string | null>(null);
  let activeView = $state<View>("tasks");
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

  function selectView(view: View) {
    selectedName = null;
    activeView = view;
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

  function createTask(title: string, documentName: string, due?: string) {
    run(async () => {
      await api.createTask(title, documentName, due);
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

<div class="app-shell">
  <NavRail active={activeView} onSelect={selectView} />
  <FileTree
    {documents}
    {selectedName}
    onSelect={selectDocument}
    onCreate={createDocument}
    onDelete={deleteDocument}
  />
  <main class="content">
    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#if selectedDoc}
      <div class="editor-pane">
        <Editor doc={selectedDoc} onSave={saveDocument} />
      </div>
    {:else if activeView === "tasks"}
      <TasksView {tasks} {documents} onCreate={createTask} onToggle={toggleTask} onDelete={deleteTask} />
    {:else}
      <CalendarView {tasks} {documents} onCreate={createTask} onToggle={toggleTask} onDelete={deleteTask} />
    {/if}
  </main>
</div>

<style>
  .app-shell {
    display: grid;
    grid-template-columns: 64px 240px 1fr;
    height: 100vh;
    background: var(--bg);
  }
  .content {
    overflow-y: auto;
    min-width: 0;
  }
  .editor-pane {
    padding: 1.75rem 2rem;
    max-width: 900px;
  }
  .error {
    color: #c0392b;
    padding: 1rem 2rem 0;
    margin: 0;
  }
</style>
