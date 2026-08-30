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

<div class="calendar-view">
  <h1>Calendar</h1>
  <div class="grid">
    <MonthCalendar {tasks} size="large" />
  </div>
  <h2>All tasks</h2>
  <TaskList {tasks} {documents} {onCreate} {onToggle} {onDelete} />
</div>

<style>
  .calendar-view {
    padding: 1.75rem 2rem;
    max-width: 640px;
  }
  h1 {
    font-size: 1.3rem;
    margin: 0 0 1rem;
  }
  h2 {
    font-size: 1rem;
    color: var(--muted);
    margin: 1.75rem 0 0.75rem;
  }
  .grid {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
  }
</style>
