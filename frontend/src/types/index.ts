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

// Dify segment detail returned from API proxy
export interface SegmentDetail {
  id: string;
  document_id: string;
  content: string;
  word_count: number;
  tokens: number;
  keywords: string[];
  index_node_id: string;
  index_node_hash: string;
  status: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UploadedFile {
  id: string;
  client_enterprise_id: string;
  dify_document_id: string | null;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

/** UploadFileStatus constants matching backend model */
export const UPLOAD_FILE_STATUS = {
  LOCAL_UPLOADING: "本地文件上传中",
  LOCAL_COMPLETED: "本地文件上传已完成",
  DIFY_SYNCING: "文件同步dify知识库中",
  WAITING: "waiting",
  PARSING: "parsing",
  CLEANING: "cleaning",
  SPLITTING: "splitting",
  INDEXING: "indexing",
  COMPLETED: "已完成",
  ERROR: "error",
} as const;

export type UploadFileStatusType = (typeof UPLOAD_FILE_STATUS)[keyof typeof UPLOAD_FILE_STATUS];

// === Pagination ===

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// === SSE Event types ===

export interface CitationRefData {
  ordinal: number;
  source_name: string;
  char_position: number;
  dify_document_id?: string;
  chunk_id?: string;
}

export type SSEEvent =
  | { event: "think_delta"; data: { card_ordinal: number; delta: string } }
  | { event: "answer_delta"; data: { card_ordinal: number; delta: string } }
  | { event: "citation_update"; data: { card_ordinal: number; refs: CitationRefData[] } }
  | { event: "done"; data: { status: string } }
  | { event: "error"; data: { message: string } }
  | { event: "ping"; data: {} }
  | { event: "warning"; data: { message: string } };
