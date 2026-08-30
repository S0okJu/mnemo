export interface Document {
  name: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  due?: string;
  document_name: string;
  status: "pending" | "done";
  created_at: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

const DOCUMENTS = "/api/profiles/user/documents";
const CALENDAR = "/api/profiles/user/calendar";

export const api = {
  listDocuments: () => request<Document[]>(DOCUMENTS),

  createDocument: (name: string, title: string, body: string) =>
    request<Document>(DOCUMENTS, {
      method: "POST",
      body: JSON.stringify({ name, title, body }),
    }),

  getDocument: (name: string) =>
    request<Document>(`${DOCUMENTS}/${encodeURIComponent(name)}`),

  updateDocument: (name: string, title: string, body: string) =>
    request<Document>(`${DOCUMENTS}/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ title, body }),
    }),

  deleteDocument: (name: string) =>
    request<void>(`${DOCUMENTS}/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  listTasks: () => request<Task[]>(CALENDAR),

  createTask: (title: string, documentName: string, due?: string) =>
    request<Task>(CALENDAR, {
      method: "POST",
      body: JSON.stringify({ title, document_name: documentName, due }),
    }),

  updateTaskStatus: (id: string, status: Task["status"]) =>
    request<Task>(`${CALENDAR}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deleteTask: (id: string) =>
    request<void>(`${CALENDAR}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
