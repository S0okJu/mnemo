import type { Document, Task } from "../lib/api";
import TaskList from "./TaskList";
import MonthCalendar from "./MonthCalendar";
import styles from "./TasksView.module.css";

interface Props {
  tasks: Task[];
  documents: Document[];
  onCreate: (title: string, documentName: string, due?: string) => void;
  onToggle: (id: string, status: Task["status"]) => void;
  onDelete: (id: string) => void;
}

export default function TasksView({ tasks, documents, onCreate, onToggle, onDelete }: Props) {
  return (
    <div className={styles.tasksView}>
      <div className={styles.mainCol}>
        <h1>Tasks</h1>
        <TaskList
          tasks={tasks}
          documents={documents}
          onCreate={onCreate}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      </div>
      <aside className={styles.miniCalendar}>
        <MonthCalendar tasks={tasks} size="small" />
      </aside>
    </div>
  );
}
