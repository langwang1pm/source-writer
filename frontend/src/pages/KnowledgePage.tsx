
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Upload, FileText, Trash2, Download, Eye } from "lucide-react";
import { uploadedFiles, workspaces } from "../api/client";
import type { UploadedFile } from "../types";

export default function KnowledgePage() {
  const { workspaceId } = useParams();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [enterpriseId, setEnterpriseId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspaceId) return;
    workspaces.get(workspaceId).then((ws) => {
      setEnterpriseId(ws.client_enterprise_id);
      loadFiles(ws.client_enterprise_id);
    }).catch(() => {});
  }, [workspaceId]);

  const loadFiles = async (entId?: string) => {
    setLoading(true);
    try {
      const eid = entId || enterpriseId;
      const res = await uploadedFiles.list(eid ? { enterprise_id: eid } : undefined);
      const items = res.items || [];
      setFiles(items);
      // Refresh non-final statuses from Dify
      for (const f of items) {
        if (f.dify_document_id && !["available", "completed", "error"].includes(f.status)) {
          try {
            const result = await uploadedFiles.refreshStatus(f.id);
            f.status = result.status;
          } catch {}
        }
      }
      setFiles([...items]);
    } catch {}
    setLoading(false);
  };


  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    if (enterpriseId) {
      await uploadedFiles.uploadWithEnterprise(formData, enterpriseId);
    }
    loadFiles(enterpriseId);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    await uploadedFiles.delete(id);
    loadFiles(enterpriseId);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": case "available": return "#27ae60";
      case "indexing": case "parsing": case "cleaning": case "splitting": return "#f39c12";
      case "error": return "#e74c3c";
      case "waiting": case "pending": case "paused": return "#999";
      default: return "#888";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "completed": return "已完成";
      case "available": return "可用";
      case "indexing": return "索引中";
      case "parsing": return "解析中";
      case "cleaning": return "清洗中";
      case "splitting": return "分块中";
      case "waiting": return "等待中";
      case "pending": return "等待中";
      case "paused": return "已暂停";
      case "error": return "错误";
      default: return s;
    }
  };

  const getPreviewHref = (f: UploadedFile) => {
    const name = f.file_name.toLowerCase();
    if (name.endsWith('.doc') || name.endsWith('.docx')) {
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
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#1a1a2e", color: "#fff", cursor: "pointer", fontSize: 14 }}
        >
          <Upload size={16} />
          上传文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleUpload}
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
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", borderRadius: 10, border: "1px solid #eee" }}>
              <FileText size={20} color="#666" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</div>
                <div style={{ fontSize: 12, color: "#888", display: "flex", gap: 12 }}>
                  <span>{(f.file_size / 1024).toFixed(0)} KB</span>
                  <span style={{ color: statusColor(f.status) }}>{statusLabel(f.status)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
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
                >
                  <Download size={16} />
                </a>
                <button
                  onClick={() => handleDelete(f.id)}
                  style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#e74c3c" }}
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
