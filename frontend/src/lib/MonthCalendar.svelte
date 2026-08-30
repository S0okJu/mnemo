<script lang="ts">
  import type { Task } from "./api";

  let {
    tasks,
    size = "small",
    selectedDate = null,
    onSelectDate,
  }: {
    tasks: Task[];
    size?: "small" | "large";
    selectedDate?: string | null;
    onSelectDate?: (date: string) => void;
  } = $props();

  const today = new Date();

  let viewYear = $state(today.getFullYear());
  let viewMonth = $state(today.getMonth());

  function pad(n: number): string {
    return n.toString().padStart(2, "0");
  }

  function isoDate(year: number, month: number, day: number): string {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  let tasksByDate = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (!task.due) continue;
      const day = task.due.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  });

  let weeks = $derived.by(() => {
    const startOffset = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  });

  let monthLabel = $derived(
    new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    }),
  );

  function prevMonth() {
    if (viewMonth === 0) {
      viewMonth = 11;
      viewYear -= 1;
    } else {
      viewMonth -= 1;
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      viewMonth = 0;
      viewYear += 1;
    } else {
      viewMonth += 1;
    }
  }
</script>

<div class="month-calendar {size}">
  <div class="header">
    <button type="button" onclick={prevMonth} aria-label="Previous month">‹</button>
    <span class="label">{monthLabel}</span>
    <button type="button" onclick={nextMonth} aria-label="Next month">›</button>
  </div>

  <div class="weekday-row">
    {#each ["S", "M", "T", "W", "T", "F", "S"] as wd, i (i)}
      <span>{wd}</span>
    {/each}
  </div>

  {#each weeks as week, wi (wi)}
    <div class="week-row">
      {#each week as day, di (di)}
        {#if day === null}
          <span class="cell empty"></span>
        {:else}
          {@const iso = isoDate(viewYear, viewMonth, day)}
          {@const count = tasksByDate.get(iso) ?? 0}
          <button
            type="button"
            class="cell"
            class:today={iso === todayIso}
            class:selected={iso === selectedDate}
            onclick={() => onSelectDate?.(iso)}
          >
            <span class="day-number">{day}</span>
            {#if count > 0}
              <span class="dot" title="{count} task(s) due"></span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  {/each}
</div>

<style>
  .month-calendar {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    color: var(--text);
  }
  .header button {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }
  .header button:hover {
    background: var(--hover-bg);
  }
  .weekday-row,
  .week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }
  .weekday-row span {
    text-align: center;
    font-size: 0.7rem;
    color: var(--muted);
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text);
    font-size: 0.8rem;
  }
  .cell:not(.empty):hover {
    background: var(--hover-bg);
  }
  .cell.today .day-number {
    font-weight: 700;
    color: var(--accent);
  }
  .cell.selected {
    background: var(--active-bg);
  }
  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    margin-top: 2px;
  }

  .month-calendar.large .cell {
    font-size: 0.95rem;
  }
  .month-calendar.large .dot {
    width: 5px;
    height: 5px;
  }
</style>
