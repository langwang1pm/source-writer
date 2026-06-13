
import { useState, useEffect } from "react";
import { Outlet, useParams, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Plus, FolderOpen, LogOut } from "lucide-react";
import { sessions } from "../../api/client";
import type { Session } from "../../types";

export default function MainLayout() {
  const { workspaceId, sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isKnowledge = location.pathname.includes("/knowledge");

  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    sessions.list({ workspace_id: workspaceId }).then((res) => {
      setSessionList(res.items || []);
    }).finally(() => setLoading(false));
  }, [workspaceId]);

  const createSession = async () => {
    if (!workspaceId) return;
    const res = await sessions.create({ workspace_id: workspaceId });
    setSessionList((prev) => [res, ...prev]);
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
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e5e5e5", fontSize: 14, fontWeight: 600 }}>
          Source Writer
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
          <button onClick={createSession} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "1px dashed #ccc", background: "transparent", cursor: "pointer", fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
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
            <div key={s.id} onClick={() => navigate(`/workspace/${workspaceId}/chat/${s.id}`)} style={{
              padding: "10px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer", fontSize: 13,
              color: s.id === sessionId ? "#1a1a2e" : "#555",
              background: s.id === sessionId ? "#e8e8f0" : "transparent",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: "middle", opacity: 0.6 }} />
              {s.title || "新对话"}
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

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Outlet />
      </main>
    </div>
  );
}
