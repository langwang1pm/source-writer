
// === Backend model types ===

export interface ClientEnterprise {
  id: string;
  name: string;
  created_at: string;
  updated_at: string | null;
}

export interface TaskType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  client_enterprise_id: string;
  client_enterprise_name?: string;
  client_enterprise_deleted?: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface Session {
  id: string;
  workspace_id: string;
  task_type_id: string | null;
  task_type_name: string | null;
  title: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  task_type_id: string | null;
  content: string;
  created_at: string;
}

export interface MessageBlock {
  id: string;
  session_id: string;
  user_message_id: string;
  card_ordinal: number;
  block_type: "think" | "answer";
  content: string;
  ordinal: number;
  created_at: string;
}

export interface ResponseDoc {
  id: string;
  session_id: string;
  chat_message_id: string;
  title: string | null;
  body_markdown: string | null;
  body_html: string | null;
  revision: number;
  created_at: string;
  updated_at: string | null;
}

export interface SourceRef {
  id: string;
  response_doc_id: string;
  message_block_id: string | null;
  card_ordinal: number;
  ordinal: number;
  source_name: string;
  dify_document_id: string | null;
  uploaded_file_id: string | null;
  chunk_id: string | null;
  snippet: string | null;
  relevance_score: number | null;
  char_position: number | null;
}

export interface UploadedFile {
  id: string;
  client_enterprise_id: string;
  dify_document_id: string | null;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  status: "pending" | "indexing" | "available" | "error";
  created_at: string;
  updated_at: string | null;
}

// === Pagination ===

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// === SSE Event types ===

export type SSEEvent =
  | { event: "think_delta"; data: { card_ordinal: number; delta: string } }
  | { event: "answer_delta"; data: { card_ordinal: number; delta: string } }
  | { event: "citation_update"; data: { card_ordinal: number; refs: { ordinal: number; source_name: string; char_position: number }[] } }
  | { event: "done"; data: { status: string } }
  | { event: "error"; data: { message: string } }
  | { event: "ping"; data: {} }
  | { event: "warning"; data: { message: string } };
