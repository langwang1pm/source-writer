
import { useState, useEffect } from "react";
import { Outlet, useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { MessageSquare, Plus, FolderOpen, LogOut, X, Pencil, Trash2 } from "lucide-react";
import { sessions, workspaces, taskTypes } from "../../api/client";
import type { Workspace, TaskType } from "../../types";
import type { Session } from "../../types";

export default function MainLayout() {
  const { workspaceId, sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isKnowledge = location.pathname.includes("/knowledge");

  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [wsName, setWsName] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [availTaskTypes, setAvailTaskTypes] = useState<TaskType[]>([]);
  const [selectedTaskType, setSelectedTaskType] = useState<string>("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    sessions.list({ workspace_id: workspaceId }).then((res) => {
      setSessionList(res.items || []);
    }).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    workspaces.get(workspaceId).then((w) => setWsName(w.name)).catch(() => {});
    taskTypes.list({ active_only: true }).then((res) => {
      setAvailTaskTypes(res.items || []);
    }).catch(() => {});
  }, [workspaceId]);

  const activeSessionId = sessionId || searchParams.get("sessionId") || "";
  const handleRename = (s: Session) => {
    setEditingSessionId(s.id);
    setEditTitle(s.title || "");
  };

  const handleRenameSave = async (id: string) => {
    if (!editTitle.trim()) return;
    await sessions.update(id, { title: editTitle.trim() });
    setSessionList((prev) => prev.map((s) => (s.id === id ? { ...s, title: editTitle.trim() } : s)));
    setEditingSessionId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除此对话？")) return;
    await sessions.delete(id);
    setSessionList((prev) => prev.filter((s) => s.id !== id));
  };

  const createSession = async () => {
    if (!workspaceId || !selectedTaskType) return;
    const res = await sessions.create({
      workspace_id: workspaceId,
      task_type_id: selectedTaskType,
    });
    setSessionList((prev) => [res, ...prev]);
    setShowNewDialog(false);
    setSelectedTaskType("");
    navigate(`/workspace/${workspaceId}/chat/${res.id}`);
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <nav style={{
        width: 280, minWidth: 280,
        background: "#f7f7f8",
        borderRight: "1px solid #e5e5e5",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e5e5e5" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Source Writer</div>
          {wsName && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{wsName}</div>}
        </div>

        <div style={{ padding: "8px 14px" }}>
          <button onClick={() => navigate(`/workspace/${workspaceId}/knowledge`)} style={{
            width: "100%", padding: "8px 12px", borderRadius: 8, border: "none",
            background: isKnowledge ? "#e8e8f0" : "transparent",
            color: isKnowledge ? "#1a1a2e" : "#555",
            fontWeight: 500,
            cursor: "pointer", fontSize: 13,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <FolderOpen size={16} />
            知识库
          </button>
        </div>

        <div style={{ height: 1, background: "#e5e5e5", margin: "0 14px" }} />

        <div style={{ padding: "10px 14px" }}>
          <button onClick={() => setShowNewDialog(true)} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "1px dashed #ccc", background: "transparent", cursor: "pointer", fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <Plus size={15} />
            新对话
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0 6px" }}>
          {loading && <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "#888" }}>加载中...</div>}
          {!loading && sessionList.length === 0 && (
            <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "#999" }}>暂无对话，点击上方按钮创建</div>
          )}
          {sessionList.map((s) => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", borderRadius: 8, marginBottom: 2,
              background: s.id === activeSessionId ? "#e8e8f0" : "transparent",
              transition: "background 0.15s",
            }}
              onMouseEnter={(e) => { const b = e.currentTarget.querySelector('.ses-actions') as HTMLElement; if (b) b.style.opacity = '1'; }}
              onMouseLeave={(e) => { const b = e.currentTarget.querySelector('.ses-actions') as HTMLElement; if (b) b.style.opacity = '0'; }}
            >
              {editingSessionId === s.id ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSave(s.id);
                    if (e.key === "Escape") setEditingSessionId(null);
                  }}
                  onBlur={() => handleRenameSave(s.id)}
                  autoFocus
                  style={{
                    flex: 1, margin: "6px 8px", padding: "4px 8px", borderRadius: 4,
                    border: "1px solid #d4ccf5", fontSize: 13, outline: "none",
                    background: "#fff",
                  }}
                />
              ) : (
                <div
                  onClick={() => navigate(`/workspace/${workspaceId}/chat/${s.id}`)}
                  style={{
                    flex: 1, padding: "10px 12px", cursor: "pointer", fontSize: 13,
                    color: s.id === activeSessionId ? "#1a1a2e" : "#555",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: "middle", opacity: 0.6 }} />
                  {s.title || "新对话"}
                </div>
              )}
              <div className="ses-actions" style={{
                display: "flex", gap: 2, paddingRight: 6, opacity: 0,
                transition: "opacity 0.12s",
              }}>
                <button
                  onClick={() => handleRename(s)}
                  title="重命名"
                  style={{ padding: 4, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#666", lineHeight: 0 }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  title="删除"
                  style={{ padding: 4, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#e74c3c", lineHeight: 0 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #e5e5e5", padding: "10px 14px" }}>
          <button onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#666", padding: 0, width: "100%" }}>
            <LogOut size={16} />
            返回项目列表
          </button>
        </div>
      </nav>

      {showNewDialog && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowNewDialog(false)}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 20,
            width: 360, maxWidth: "90vw", boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16}}>
              <span style={{fontWeight: 600, fontSize: 15}}>New Chat</span>
              <button onClick={() => setShowNewDialog(false)} style={{background: "none", border: "none", cursor: "pointer", color: "#999", padding: 4}}>
                <X size={16} />
              </button>
            </div>
            <div style={{fontSize: 13, color: "#666", marginBottom: 10}}>Select task type</div>
            {availTaskTypes.length === 0 && (
              <div style={{padding: "20px 0", textAlign: "center", fontSize: 13, color: "#999"}}>
                No available task types
              </div>
            )}
            {availTaskTypes.map((tt) => (
              <div key={tt.id} onClick={() => setSelectedTaskType(tt.id)} style={{
                padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                background: selectedTaskType === tt.id ? "#e8e8f0" : "transparent",
                color: selectedTaskType === tt.id ? "#1a1a2e" : "#555",
                marginBottom: 4, transition: "background 0.15s",
              }}>
                {tt.name}
              </div>
            ))}
            <button onClick={createSession} disabled={!selectedTaskType} style={{
              width: "100%", padding: "10px 0", marginTop: 16,
              borderRadius: 8, border: "none",
              background: selectedTaskType ? "#1a1a2e" : "#ccc",
              color: "#fff", cursor: selectedTaskType ? "pointer" : "default",
              fontSize: 14, fontWeight: 500,
            }}>
              Create
            </button>
          </div>
        </div>
      )}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Outlet />
      </main>
    </div>
  );
}
  // Use route param sessionId, or query param (for doc page)
