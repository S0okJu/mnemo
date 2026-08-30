import { useMemo, useState } from "react";
import type { Task } from "../lib/api";
import styles from "./MonthCalendar.module.css";

interface Props {
  tasks: Task[];
  size?: "small" | "large";
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MonthCalendar({
  tasks,
  size = "small",
  selectedDate = null,
  onSelectDate,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const tasksByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (!task.due) continue;
      const day = task.due.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const weeks = useMemo(() => {
    const startOffset = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth]);

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth],
  );

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div className={`${styles.monthCalendar} ${size === "large" ? styles.large : ""}`}>
      <div className={styles.header}>
        <button type="button" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <span className={styles.label}>{monthLabel}</span>
        <button type="button" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>

      <div className={styles.weekdayRow}>
        {WEEKDAYS.map((wd, i) => (
          <span key={i}>{wd}</span>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div className={styles.weekRow} key={wi}>
          {week.map((day, di) => {
            if (day === null) {
              return <span className={`${styles.cell} ${styles.emptyCell}`} key={di} />;
            }
            const iso = isoDate(viewYear, viewMonth, day);
            const count = tasksByDate.get(iso) ?? 0;
            const classes = [styles.cell];
            if (iso === todayIso) classes.push(styles.today);
            if (iso === selectedDate) classes.push(styles.selected);
            return (
              <button
                type="button"
                className={classes.join(" ")}
                key={di}
                onClick={() => onSelectDate?.(iso)}
              >
                <span className={styles.dayNumber}>{day}</span>
                {count > 0 && <span className={styles.dot} title={`${count} task(s) due`} />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
