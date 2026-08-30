import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type Document, type Task } from "./lib/api";
import NavRail, { type View } from "./components/NavRail";
import FileTree from "./components/FileTree";
import Editor from "./components/Editor";
import TasksView from "./components/TasksView";
import CalendarView from "./components/CalendarView";
import styles from "./App.module.css";

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>("tasks");
  const [error, setError] = useState<string | null>(null);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.name === selectedName) ?? null,
    [documents, selectedName],
  );

  const refreshDocuments = useCallback(async () => {
    setDocuments(await api.listDocuments());
  }, []);

  const refreshTasks = useCallback(async () => {
    setTasks(await api.listTasks());
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    run(async () => {
      await Promise.all([refreshDocuments(), refreshTasks()]);
    });
  }, [run, refreshDocuments, refreshTasks]);

  function selectDocument(name: string) {
    setSelectedName(name);
  }

  function selectView(view: View) {
    setSelectedName(null);
    setActiveView(view);
  }

  function createDocument(name: string, title: string) {
    run(async () => {
      await api.createDocument(name, title, "");
      await refreshDocuments();
      setSelectedName(name);
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
      setSelectedName((current) => (current === name ? null : current));
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

  return (
    <div className={styles.appShell}>
      <NavRail active={activeView} onSelect={selectView} />
      <FileTree
        documents={documents}
        selectedName={selectedName}
        onSelect={selectDocument}
        onCreate={createDocument}
        onDelete={deleteDocument}
      />
      <main className={styles.content}>
        {error && <p className={styles.error}>{error}</p>}

        {selectedDoc ? (
          <div className={styles.editorPane}>
            <Editor key={selectedDoc.name} doc={selectedDoc} onSave={saveDocument} />
          </div>
        ) : activeView === "tasks" ? (
          <TasksView
            tasks={tasks}
            documents={documents}
            onCreate={createTask}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        ) : (
          <CalendarView
            tasks={tasks}
            documents={documents}
            onCreate={createTask}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        )}
      </main>
    </div>
  );
}
