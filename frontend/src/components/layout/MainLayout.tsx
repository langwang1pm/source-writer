
import { Outlet, useParams, Link, useNavigate } from "react-router-dom";
import { MessageSquare, FolderOpen, FileText, LogOut } from "lucide-react";

export default function MainLayout() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <nav style={{
        width: 220,
        background: "#1a1a2e",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "16px 0",
      }}>
        <div style={{ padding: "0 16px 24px", fontSize: 18, fontWeight: 700 }}>
          Source Writer
        </div>

        <Link
          to={`/workspace/${workspaceId}/chat`}
          style={navItemStyle}
        >
          <MessageSquare size={18} />
          <span>对话</span>
        </Link>

        <Link
          to={`/workspace/${workspaceId}/knowledge`}
          style={navItemStyle}
        >
          <FolderOpen size={18} />
          <span>知识库</span>
        </Link>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => navigate("/")}
          style={{ ...navItemStyle, cursor: "pointer", background: "none", border: "none", color: "#fff", width: "100%", textAlign: "left", fontSize: 14 }}
        >
          <LogOut size={18} />
          <span>返回</span>
        </button>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Outlet />
      </main>
    </div>
  );
}

const navItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 16px",
  color: "#ccc",
  textDecoration: "none",
  fontSize: 14,
};
