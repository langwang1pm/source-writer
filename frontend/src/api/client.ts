
const BASE = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// === Enterprises ===
export const enterprises = {
  list: (params?: { page?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.search) q.set("search", params.search);
    return request<any>(`/enterprises?${q}`);
  },
  create: (data: { name: string }) =>
    request<any>("/enterprises", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string }) =>
    request<any>(`/enterprises/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/enterprises/${id}`, { method: "DELETE" }),
};

// === Task Types ===
export const taskTypes = {
  list: (params?: { page?: number; active_only?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.active_only) q.set("active_only", "true");
    return request<any>(`/task-types?${q}`);
  },
  create: (data: { name: string; description?: string; is_active?: boolean }) =>
    request<any>("/task-types", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string; is_active?: boolean }) =>
    request<any>(`/task-types/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/task-types/${id}`, { method: "DELETE" }),
};

// === Workspaces ===
export const workspaces = {
  list: (params?: { page?: number; enterprise_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.enterprise_id) q.set("enterprise_id", params.enterprise_id);
    return request<any>(`/workspaces?${q}`);
  },
  create: (data: { name: string; client_enterprise_id: string }) =>
    request<any>("/workspaces", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string }) =>
    request<any>(`/workspaces/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/workspaces/${id}`, { method: "DELETE" }),
  get: (id: string) => request<any>(`/workspaces/${id}`),
};

// === Sessions ===
export const sessions = {
  list: (params?: { page?: number; workspace_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.workspace_id) q.set("workspace_id", params.workspace_id);
    return request<any>(`/sessions?${q}`);
  },
  create: (data: { workspace_id: string }) =>
    request<any>("/sessions", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => request<any>(`/sessions/${id}`),
  delete: (id: string) => request<void>(`/sessions/${id}`, { method: "DELETE" }),
};

// === Messages ===
export const messages = {
  list: (sessionId: string, params?: { page?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    return request<any>(`/sessions/${sessionId}/messages?${q}`);
  },
  send: (sessionId: string, data: { content: string; task_type_id?: string }) =>
    request<any>(`/sessions/${sessionId}/messages`, { method: "POST", body: JSON.stringify(data) }),
  streamUrl: (sessionId: string, userMessageId: string) =>
    `${BASE}/sessions/${sessionId}/stream?user_message_id=${userMessageId}`,
};

// === Message Blocks ===
export const messageBlocks = {
  list: (userMessageId: string) =>
    request<any>(`/message-blocks?user_message_id=${userMessageId}`),
};

// === Response Docs ===
export const responseDocs = {
  list: (params?: { page?: number; session_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.session_id) q.set("session_id", params.session_id);
    return request<any>(`/response-docs?${q}`);
  },
  get: (id: string) => request<any>(`/response-docs/${id}`),
  update: (id: string, data: { title?: string; body_markdown?: string }) =>
    request<any>(`/response-docs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  exportUrl: (id: string) => `${BASE}/response-docs/${id}/export`,
};

// === Source Refs ===
export const sourceRefs = {
  list: (docId: string) => request<any>(`/source-refs?doc_id=${docId}`),
};

// === Uploaded Files ===
export const uploadedFiles = {
  list: (params?: { page?: number; enterprise_id?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.enterprise_id) q.set("enterprise_id", params.enterprise_id);
    if (params?.search) q.set("search", params.search);
    return request<any>(`/uploaded-files?${q}`);
  },
  upload: (formData: FormData) =>
    fetch(`${BASE}/uploaded-files`, { method: "POST", body: formData }),
  uploadWithEnterprise: (formData: FormData, enterpriseId: string) =>
    fetch(`${BASE}/uploaded-files?enterprise_id=${enterpriseId}`, { method: "POST", body: formData }),
  delete: (id: string) => request<void>(`/uploaded-files/${id}`, { method: "DELETE" }),
  downloadUrl: (id: string) => `${BASE}/uploaded-files/${id}/download`,
};
