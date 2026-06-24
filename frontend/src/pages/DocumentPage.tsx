
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Download, Save } from "lucide-react";
import { responseDocs } from "../api/client";
import type { ResponseDoc } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function DocumentPage() {
  const { workspaceId, docId } = useParams();
  const [doc, setDoc] = useState<ResponseDoc | null>(null);
  const [editing, setEditing] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!docId) return;
    responseDocs.get(docId).then((d) => {
      setDoc(d);
      setMarkdown(d.body_markdown || "");
    });
  }, [docId]);

  const handleSave = async () => {
    if (!docId) return;
    setSaving(true);
    try {
      const updated = await responseDocs.update(docId, { body_markdown: markdown });
      setDoc(updated);
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  if (!doc) {
    return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>加载中...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #e0e0e0", background: "#fff" }}>
        <a
          href={`/workspace/${workspaceId}/chat/${doc.session_id}`}
          style={{ display: "flex", alignItems: "center", gap: 4, color: "#666", textDecoration: "none", fontSize: 13 }}
        >
          <ArrowLeft size={16} />
          返回
        </a>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{doc.title || "无标题"}</div>
        <div style={{ fontSize: 12, color: "#888" }}>
          {doc.revision > 1 ? `v${doc.revision}` : "初始版本"}
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #1a1a2e", background: "transparent", cursor: "pointer", fontSize: 13 }}
          >
            编辑
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 6, border: "none", background: "#27ae60", color: "#fff", cursor: "pointer", fontSize: 13 }}
          >
            <Save size={14} />
            {saving ? "保存中..." : "保存"}
          </button>
        )}
        <a
          href={responseDocs.exportUrl(doc.id)}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 6, border: "1px solid #ccc", color: "#555", textDecoration: "none", fontSize: 13 }}
        >
          <Download size={14} />
          导出
        </a>
      </div>

     {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 24, background: "#f5f5f7" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          {editing ? (
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              style={{ width: "100%", minHeight: "80vh", padding: 16, borderRadius: 8, border: "1px solid #ddd", fontSize: 14, lineHeight: 1.7, fontFamily: "monospace", resize: "vertical", outline: "none" }}
            />
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {doc.body_markdown || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
