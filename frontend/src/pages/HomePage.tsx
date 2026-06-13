
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MessageSquare, Pencil, Trash2, Building2, Tag } from "lucide-react";
import { workspaces, enterprises, taskTypes } from "../api/client";
import type { Workspace } from "../types";

export default function HomePage() {
  const navigate = useNavigate();
  const [wsList, setWsList] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEnterpriseId, setNewEnterpriseId] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [enterpriseList, setEnterpriseList] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await workspaces.list();
      setWsList(res.items || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    enterprises.list().then((r) => setEnterpriseList(r.items || [])).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newEnterpriseId) return;
    try {
      if (editId) {
        await workspaces.update(editId, { name: newName });
      } else {
        await workspaces.create({ name: newName, client_enterprise_id: newEnterpriseId });
      }
      setShowCreate(false);
      setEditId(null);
      setNewName("");
      setNewEnterpriseId("");
      load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该项目空间？")) return;
    await workspaces.delete(id);
    load();
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Source Writer</h1>
          <p style={{ color: "#888", fontSize: 14, marginTop: 4 }}>专利文档编写辅助系统</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/enterprises"
            onClick={(e) => { e.preventDefault(); navigate("/enterprises"); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd", color: "#555", textDecoration: "none", fontSize: 13 }}
          >
            <Building2 size={16} />
            企业管理
          </a>
          <a
            href="/task-types"
            onClick={(e) => { e.preventDefault(); navigate("/task-types"); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd", color: "#555", textDecoration: "none", fontSize: 13 }}
          >
            <Tag size={16} />
            任务类型
          </a>
          <button
            onClick={() => { setEditId(null); setNewName(""); setNewEnterpriseId(""); setShowCreate(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#1a1a2e", color: "#fff", cursor: "pointer", fontSize: 13 }}
          >
            <Plus size={16} />
            新建项目空间
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>加载中...</div>
      ) : wsList.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, border: "2px dashed #ddd", borderRadius: 16, background: "#fafafa" }}>
          <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div style={{ fontSize: 16, color: "#999", marginBottom: 16 }}>暂无项目空间</div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1a1a2e", color: "#fff", cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} />
            创建项目空间
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {wsList.map((ws) => (
            <div
              key={ws.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e8e8e8",
                padding: "20px 24px",
                transition: "box-shadow 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => navigate(`/workspace/${ws.id}/chat`)}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{ws.name}</div>
                  {ws.client_enterprise_name && (
                    <div style={{ fontSize: 13, color: "#888" }}>{ws.client_enterprise_name}</div>
                  )}
                  <div style={{ marginTop: 12 }}>
                    <span style={{ fontSize: 12, color: "#1a73e8", background: "#e8f0fe", padding: "2px 8px", borderRadius: 4 }}>
                      进入对话 →
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditId(ws.id); setNewName(ws.name); setNewEnterpriseId(ws.client_enterprise_id); setShowCreate(true); }} style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#666" }}>
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(ws.id)} style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#e74c3c" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
            onClick={() => setShowCreate(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 400, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{editId ? "编辑项目空间" : "创建项目空间"}</h2>
            {!editId && (
              <select
                value={newEnterpriseId}
                onChange={(e) => setNewEnterpriseId(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginBottom: 12, fontSize: 14 }}
              >
                <option value="">选择企业</option>
                {enterpriseList.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="项目空间名称"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginBottom: 20, fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowCreate(false); setEditId(null); setNewName(""); setNewEnterpriseId(""); }} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 14 }}>取消</button>
              <button onClick={handleCreate} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#1a1a2e", color: "#fff", cursor: "pointer", fontSize: 14 }}>{editId ? "保存" : "创建"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
