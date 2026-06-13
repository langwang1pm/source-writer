
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { enterprises } from "../api/client";

export default function EnterprisePage() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try { const r = await enterprises.list(); setList(r.items || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editId) await enterprises.update(editId, { name });
    else await enterprises.create({ name });
    setShowForm(false); setEditId(null); setName(""); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除？")) return;
    await enterprises.delete(id); load();
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, flex: 1 }}>企业管理</h1>
        <button onClick={() => { setEditId(null); setName(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#1a1a2e", color: "#fff", cursor: "pointer", fontSize: 14 }}>
          <Plus size={16} /> 新建
        </button>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "#888" }}>加载中...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#fff", borderRadius: 10, border: "1px solid #eee" }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{item.name}</span>
              <button onClick={() => { setEditId(item.id); setName(item.name); setShowForm(true); }} style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#666" }}><Pencil size={16} /></button>
              <button onClick={() => handleDelete(item.id)} style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#e74c3c" }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowForm(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{editId ? "编辑企业" : "新建企业"}</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="企业名称" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginBottom: 20, fontSize: 14 }} autoFocus />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 14 }}>取消</button>
              <button onClick={handleSave} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#1a1a2e", color: "#fff", cursor: "pointer", fontSize: 14 }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
