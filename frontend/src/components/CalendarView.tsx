import type { Document, Task } from "../lib/api";
import TaskList from "./TaskList";
import MonthCalendar from "./MonthCalendar";
import styles from "./CalendarView.module.css";

interface Props {
  tasks: Task[];
  documents: Document[];
  onCreate: (title: string, documentName: string, due?: string) => void;
  onToggle: (id: string, status: Task["status"]) => void;
  onDelete: (id: string) => void;
}

export default function CalendarView({ tasks, documents, onCreate, onToggle, onDelete }: Props) {
  return (
    <div className={styles.calendarView}>
      <h1>Calendar</h1>
      <div className={styles.grid}>
        <MonthCalendar tasks={tasks} size="large" />
      </div>
      <h2>All tasks</h2>
      <TaskList
        tasks={tasks}
        documents={documents}
        onCreate={onCreate}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    </div>
  );
}
