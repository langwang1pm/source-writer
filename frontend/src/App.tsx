
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import EnterprisePage from "./pages/EnterprisePage";
import TaskTypePage from "./pages/TaskTypePage";
import MainLayout from "./components/layout/MainLayout";
import ChatPage from "./pages/ChatPage";
import KnowledgePage from "./pages/KnowledgePage";
import DocumentPage from "./pages/DocumentPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/enterprises" element={<EnterprisePage />} />
      <Route path="/task-types" element={<TaskTypePage />} />
      <Route path="/workspace/:workspaceId" element={<MainLayout />}>
        <Route path="chat/:sessionId?" element={<ChatPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="docs/:docId" element={<DocumentPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
