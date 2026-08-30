<script lang="ts">
  import type { Document, Task } from "./api";
  import TaskList from "./TaskList.svelte";
  import MonthCalendar from "./MonthCalendar.svelte";

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
</script>

<div class="tasks-view">
  <div class="main-col">
    <h1>Tasks</h1>
    <TaskList {tasks} {documents} {onCreate} {onToggle} {onDelete} />
  </div>
  <aside class="mini-calendar">
    <MonthCalendar {tasks} size="small" />
  </aside>
</div>

<style>
  .tasks-view {
    display: flex;
    gap: 2.5rem;
    padding: 1.75rem 2rem;
    align-items: flex-start;
  }
  .main-col {
    flex: 1;
    min-width: 0;
  }
  .mini-calendar {
    width: 220px;
    flex-shrink: 0;
    padding-top: 0.25rem;
  }
  h1 {
    font-size: 1.3rem;
    margin: 0 0 1rem;
  }
</style>
