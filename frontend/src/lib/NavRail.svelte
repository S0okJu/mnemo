<script lang="ts">
  type View = "tasks" | "calendar";

  let {
    active,
    onSelect,
  }: {
    active: View;
    onSelect: (view: View) => void;
  } = $props();
</script>

<nav class="rail">
  <button type="button" class:active={active === "tasks"} onclick={() => onSelect("tasks")}>
    <span class="icon">✓</span>
    <span class="label">Tasks</span>
  </button>
  <button type="button" class:active={active === "calendar"} onclick={() => onSelect("calendar")}>
    <span class="icon">▦</span>
    <span class="label">Calendar</span>
  </button>
</nav>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    background: var(--rail-bg);
    border-right: 1px solid var(--border);
    padding: 0.5rem 0.35rem;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    background: none;
    border: none;
    padding: 0.55rem 0.25rem;
    color: var(--muted);
    font-size: 0.65rem;
    font-family: inherit;
    cursor: pointer;
    border-radius: 8px;
    margin-bottom: 0.3rem;
  }
  button:hover {
    background: var(--hover-bg);
  }
  button.active {
    background: var(--active-bg);
    color: var(--text);
  }
  .icon {
    font-size: 1.05rem;
    line-height: 1;
  }
</style>
