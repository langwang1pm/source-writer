
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ChatPage from "./pages/ChatPage";
import KnowledgePage from "./pages/KnowledgePage";
import DocumentPage from "./pages/DocumentPage";

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/workspace/:workspaceId/chat/:sessionId?" element={<ChatPage />} />
        <Route path="/workspace/:workspaceId/knowledge" element={<KnowledgePage />} />
        <Route path="/workspace/:workspaceId/docs/:docId" element={<DocumentPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/workspace/demo/chat" replace />} />
    </Routes>
  );
}

export default App;
