import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Upload, FileText, Loader2, Trash2, Download, Eye, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadedFiles, workspaces } from "../api/client";
import type { UploadedFile } from "../types";
import { UPLOAD_FILE_STATUS } from "../types";

export default function KnowledgePage() {
  const { workspaceId } = useParams();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [localUploading, setLocalUploading] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [enterpriseId, setEnterpriseId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    workspaces.get(workspaceId).then((ws) => {
      setEnterpriseId(ws.client_enterprise_id);
      loadFiles(ws.client_enterprise_id);
    }).catch(() => {});
  }, [workspaceId]);

  // Periodic polling for files in non-terminal Dify sync status
  useEffect(() => {
    const hasActiveSyncs = files.some((f) => isDifyActiveStatus(f.status));
    if (hasActiveSyncs && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadFiles(enterpriseId, true);
      }, 5000);
    } else if (!hasActiveSyncs && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [files, enterpriseId]);

  const loadFiles = async (entId?: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const eid = entId || enterpriseId;
      const res = await uploadedFiles.list(eid ? { enterprise_id: eid } : undefined);
      const items = res.items || [];
      // Refresh individual non-terminal Dify statuses
      for (const f of items) {
        if (f.dify_document_id && isDifyActiveStatus(f.status)) {
          try {
            const result = await uploadedFiles.refreshStatus(f.id);
            f.status = result.status;
          } catch {}
        }
      }
      setFiles([...items]);
    } catch {}
    if (!silent) setLoading(false);
  };

  /** Check if a status is a Dify-related non-terminal (needs polling) */
  const isDifyActiveStatus = (status: string): boolean => {
    const terminal = new Set<string>([UPLOAD_FILE_STATUS.COMPLETED, UPLOAD_FILE_STATUS.ERROR]);
    const localStatuses = new Set<string>([
      UPLOAD_FILE_STATUS.LOCAL_UPLOADING,
      UPLOAD_FILE_STATUS.LOCAL_COMPLETED,
      UPLOAD_FILE_STATUS.DIFY_SYNCING,
    ]);
    return !terminal.has(status) && !localStatuses.has(status) && !!status;
  };

  /** Phase 1: Upload file to local server */
  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !enterpriseId) return;
    setLocalUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadedFiles.uploadWithEnterprise(formData, enterpriseId);
    } catch (err) {
      console.error("Local upload failed:", err);
    }
    await loadFiles(enterpriseId);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLocalUploading(false);
  };

  /** Phase 2: Sync file to Dify knowledge base */
  const handleSyncToDify = async (fileId: string) => {
    if (syncingIds.has(fileId)) return;
    setSyncingIds((prev) => new Set(prev).add(fileId));
    try {
      await uploadedFiles.syncToDify(fileId);
    } catch (err) {
      console.error("Dify sync failed:", err);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      await loadFiles(enterpriseId);
    }
  };

  const handleDelete = async (id: string) => {
    await uploadedFiles.delete(id);
    await loadFiles(enterpriseId);
  };

  /** Map status to color */
  const statusColor = (s: string): string => {
    switch (s) {
      case UPLOAD_FILE_STATUS.COMPLETED: return "#27ae60";
      case UPLOAD_FILE_STATUS.LOCAL_COMPLETED: return "#2ecc71";
      case UPLOAD_FILE_STATUS.LOCAL_UPLOADING:
      case UPLOAD_FILE_STATUS.DIFY_SYNCING:
      case UPLOAD_FILE_STATUS.INDEXING:
      case UPLOAD_FILE_STATUS.PARSING:
      case UPLOAD_FILE_STATUS.CLEANING:
      case UPLOAD_FILE_STATUS.SPLITTING:
      case UPLOAD_FILE_STATUS.WAITING: return "#f39c12";
      case UPLOAD_FILE_STATUS.ERROR: return "#e74c3c";
      default: return "#888";
    }
  };

  /** Map status to Chinese display label */
  const statusLabel = (s: string): string => {
    switch (s) {
      case UPLOAD_FILE_STATUS.LOCAL_UPLOADING: return "本地文件上传中";
      case UPLOAD_FILE_STATUS.LOCAL_COMPLETED: return "本地文件上传已完成";
      case UPLOAD_FILE_STATUS.DIFY_SYNCING: return "文件同步dify知识库中";
      case UPLOAD_FILE_STATUS.WAITING: return "等待中";
      case UPLOAD_FILE_STATUS.PARSING: return "解析中";
      case UPLOAD_FILE_STATUS.CLEANING: return "清洗中";
      case UPLOAD_FILE_STATUS.SPLITTING: return "分块中";
      case UPLOAD_FILE_STATUS.INDEXING: return "索引中";
      case UPLOAD_FILE_STATUS.COMPLETED: return "已完成";
      case UPLOAD_FILE_STATUS.ERROR: return "错误";
      default: return s;
    }
  };

  const isSyncing = (f: UploadedFile): boolean =>
    syncingIds.has(f.id) ||
    f.status === UPLOAD_FILE_STATUS.DIFY_SYNCING ||
    f.status === UPLOAD_FILE_STATUS.LOCAL_UPLOADING;

  const canSyncToDify = (f: UploadedFile): boolean =>
    f.status === UPLOAD_FILE_STATUS.LOCAL_COMPLETED && !syncingIds.has(f.id);

  const getPreviewHref = (f: UploadedFile) => {
    const name = f.file_name.toLowerCase();
    if (name.endsWith(".doc") || name.endsWith(".docx")) {
      return uploadedFiles.officePreviewUrl(f.id);
    }
    return uploadedFiles.previewUrl(f.id);
  };

  return (
    <div style={{ padding: 24, flex: 1, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>知识库</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={localUploading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: localUploading ? "#ccc" : "#1a1a2e",
            color: "#fff", cursor: localUploading ? "not-allowed" : "pointer",
            fontSize: 14, opacity: localUploading ? 0.7 : 1,
          }}
        >
          {localUploading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={16} />}
          {localUploading ? "上传中..." : "上传文件"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleLocalUpload}
          accept=".pdf,.doc,.docx,.txt,.md"
          style={{ display: "none" }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>加载中...</div>
      ) : files.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#999", border: "2px dashed #ddd", borderRadius: 12 }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>暂无文件，点击上方按钮上传</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", background: "#fff", borderRadius: 10,
                border: "1px solid #eee",
                opacity: isSyncing(f) ? 0.85 : 1,
              }}
            >
              <FileText size={20} color="#666" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.file_name}
                </div>
                <div style={{ fontSize: 12, color: "#888", display: "flex", gap: 12, alignItems: "center" }}>
                  <span>{(f.file_size / 1024).toFixed(0)} KB</span>
                  <span style={{ color: statusColor(f.status), display: "flex", alignItems: "center", gap: 4 }}>
                    {isSyncing(f) && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
                    {f.status === UPLOAD_FILE_STATUS.COMPLETED && <CheckCircle2 size={12} />}
                    {f.status === UPLOAD_FILE_STATUS.ERROR && <AlertCircle size={12} />}
                    {statusLabel(f.status)}
                  </span>
                  {f.dify_document_id && (
                    <span style={{ fontSize: 11, color: "#999" }}>
                      Dify ID: {f.dify_document_id.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {/* Phase 2: Sync to Dify button - only for locally-completed files */}
                {canSyncToDify(f) && (
                  <button
                    onClick={() => handleSyncToDify(f.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "6px 12px", borderRadius: 6, border: "none",
                      background: "#2980b9", color: "#fff",
                      cursor: "pointer", fontSize: 12, fontWeight: 500,
                    }}
                    title="将文件上传到 Dify 知识库"
                  >
                    <Database size={14} />
                    同步到知识库
                  </button>
                )}
                {isSyncing(f) && f.status !== UPLOAD_FILE_STATUS.LOCAL_UPLOADING && (
                  <span style={{ fontSize: 12, color: "#f39c12", display: "flex", alignItems: "center", gap: 4 }}>
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    同步中...
                  </span>
                )}
                <a
                  href={getPreviewHref(f)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#666" }}
                  title="预览"
                >
                  <Eye size={16} />
                </a>
                <a
                  href={uploadedFiles.downloadUrl(f.id)}
                  style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#666" }}
                  title="下载"
                >
                  <Download size={16} />
                </a>
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={isSyncing(f)}
                  style={{
                    padding: 6, borderRadius: 6, border: "none",
                    background: "transparent",
                    cursor: isSyncing(f) ? "not-allowed" : "pointer",
                    color: isSyncing(f) ? "#ccc" : "#e74c3c",
                    opacity: isSyncing(f) ? 0.5 : 1,
                  }}
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
