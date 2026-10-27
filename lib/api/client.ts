const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

export interface Session {
  user: string;
  admin: boolean;
  csrfToken: string;
}

let sessionPromise: Promise<Session> | undefined;
export function getSession(): Promise<Session> {
  if (process.env.NEXT_PUBLIC_API_MODE === "mock") {
    return Promise.resolve({ user: "demo", admin: true, csrfToken: "" });
  }
  sessionPromise ??= fetch(`${API_BASE}/session`, {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok)
        throw new ApiError("Authentication required", response.status);
      return response.json() as Promise<Session>;
    })
    .catch((error) => {
      sessionPromise = undefined;
      throw error;
    });
  return sessionPromise;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (
    init?.method &&
    !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase())
  ) {
    const session = await getSession();
    if (session.csrfToken) headers.set("X-CSRF-Token", session.csrfToken);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (!res.ok) {
    throw new ApiError(
      `Request to ${path} failed with ${res.status}`,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** JSON request with a body, e.g. POST/PUT/DELETE. */
export function apiSend<T>(path: string, method: string, body?: unknown) {
  return apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function toQueryString(
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
