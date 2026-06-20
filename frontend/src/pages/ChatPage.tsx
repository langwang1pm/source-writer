
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { sessions, messages, messageBlocks, responseDocs } from "../api/client";
import { useSSE } from "../hooks/useSSE";
import MessageCard from "../components/chat/MessageCard";
import MessageInput from "../components/chat/MessageInput";
import type { ChatMessage, MessageBlock, SourceRef, ResponseDoc } from "../types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  blocks?: MessageBlock[];
  responseDoc?: ResponseDoc;
  sourceRefs?: SourceRef[];
}

export default function ChatPage() {
  const { workspaceId, sessionId } = useParams();
  const { isStreaming, startStream, stopStream } = useSSE();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streamBlocks, setStreamBlocks] = useState<MessageBlock[]>([]);
  const [streamingCard, setStreamingCard] = useState<number | null>(null);
  const [citationRefs, setCitationRefs] = useState<SourceRef[]>([]);
  const [showCitation, setShowCitation] = useState(false);
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [sessionTaskType, setSessionTaskType] = useState<string>("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load messages for active session
  useEffect(() => {
    if (!sessionId) return;
    loadMessages(sessionId);
    sessions.get(sessionId).then((s: any) => {
      setSessionTitle(s.title || "");
      setSessionTaskType(s.task_type_name || "");
    }).catch(() => {});
  }, [sessionId]);

  const loadMessages = async (sid: string) => {
    try {
      const res = await messages.list(sid);
      const msgList: DisplayMessage[] = [];

      for (const msg of (res.items || []) as ChatMessage[]) {
        msgList.push({ id: msg.id, role: "user", content: msg.content });

        const blocksRes = await messageBlocks.list(msg.id);
        const blocks: MessageBlock[] = blocksRes || [];

        const docsRes = await responseDocs.list({ session_id: sid });
        const docs: ResponseDoc[] = docsRes.items || [];
        const doc = docs.find((d) => d.chat_message_id === msg.id);

        msgList.push({
          id: `resp-${msg.id}`,
          role: "assistant",
          blocks,
          responseDoc: doc,
        });
      }
      setMessages(msgList);
    } catch {}
  };

  const handleSend = useCallback(async (content: string) => {
    if (!workspaceId || isStreaming) return;

    let sid = sessionId;
    if (!sid) {
      const res = await sessions.create({ workspace_id: workspaceId });
      sid = res.id;
      window.location.href = `/workspace/${workspaceId}/chat/${res.id}`;
      return;
    }

    // Save user message
    const msgRes = await messages.send(sid, { content });
    const userMsg: DisplayMessage = {
      id: msgRes.id,
      role: "user",
      content: msgRes.content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreamBlocks([]);
    setStreamingCard(null);

    // Start SSE stream
    const streamUrl = messages.streamUrl(sid, msgRes.id);
    startStream(streamUrl, {
      onThinkDelta: (cardOrdinal, delta) => {
        setStreamBlocks((prev) => {
          const existing = prev.find(
            (b) => b.card_ordinal === cardOrdinal && b.block_type === "think"
          );
          if (existing) {
            return prev.map((b) =>
              b.card_ordinal === cardOrdinal && b.block_type === "think"
                ? { ...b, content: b.content + delta }
                : b
            );
          }
          return [
            ...prev,
            {
              id: `stream-${cardOrdinal}-think`,
              session_id: sid,
              user_message_id: msgRes.id,
              card_ordinal: cardOrdinal,
              block_type: "think",
              content: delta,
              ordinal: prev.length + 1,
              created_at: new Date().toISOString(),
            },
          ];
        });
        setStreamingCard(cardOrdinal);
      },
      onAnswerDelta: (cardOrdinal, delta) => {
        setStreamBlocks((prev) => {
          const existing = prev.find(
            (b) => b.card_ordinal === cardOrdinal && b.block_type === "answer"
          );
          if (existing) {
            return prev.map((b) =>
              b.card_ordinal === cardOrdinal && b.block_type === "answer"
                ? { ...b, content: b.content + delta }
                : b
            );
          }
          return [
            ...prev,
            {
              id: `stream-${cardOrdinal}-answer`,
              session_id: sid,
              user_message_id: msgRes.id,
              card_ordinal: cardOrdinal,
              block_type: "answer",
              content: delta,
              ordinal: prev.length + 1,
              created_at: new Date().toISOString(),
            },
          ];
        });
        setStreamingCard(cardOrdinal);
      },
      onCitationUpdate: (cardOrdinal, refs) => {
        setCitationRefs((prev) => [
          ...prev,
          ...refs.map((r: any) => ({
            id: "",
            response_doc_id: "",
            message_block_id: null,
            card_ordinal: cardOrdinal,
            ordinal: r.ordinal,
            source_name: r.source_name,
            dify_document_id: null,
            uploaded_file_id: null,
            chunk_id: null,
            snippet: null,
            relevance_score: null,
            char_position: r.char_position,
          })),
        ]);
      },
      onDone: () => {
        setStreamingCard(null);
        if (sessionId) loadMessages(sessionId);
      },
      onError: (err) => {
        console.error("SSE error:", err);
        setStreamingCard(null);
      },
    });
  }, [workspaceId, sessionId, isStreaming, startStream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBlocks]);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!sessionId ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 14 }}>
            从左侧选择一个对话，或创建新对话
          </div>
        ) : (
          <>
            {(sessionTitle || sessionTaskType) && (
              <div style={{
                padding: "10px 20px", borderBottom: "1px solid #e5e5e5",
                background: "#fff", fontSize: 14, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{color: "#333"}}>{sessionTitle || "新对话"}</span>
                {sessionTaskType && (
                  <span style={{
                    fontSize: 11, color: "#888", background: "#f0f0f5",
                    padding: "2px 8px", borderRadius: 4,
                  }}>{sessionTaskType}</span>
                )}
              </div>
            )}
            <div style={{ flex: 1, overflow: "auto", background: "#f5f5f7" }}>
              {messages.map((msg) => (
                <MessageCard key={msg.id} role={msg.role} content={msg.content} blocks={msg.blocks} />
              ))}
              {streamBlocks.length > 0 && (
                <MessageCard role="assistant" blocks={streamBlocks} streamingCard={streamingCard} />
              )}
              {isStreaming && (
                <div style={{ padding: "16px 20px 16px 72px", fontSize: 13, color: "#888" }}>
                  AI 正在生成...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <MessageInput onSend={handleSend} disabled={isStreaming} />
          </>
        )}
      </div>

      {/* Citation panel */}
      {citationRefs.length > 0 && (
        <div style={{ width: 300, borderLeft: "1px solid #e0e0e0", background: "#fafafa", padding: 12, overflow: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>引用来源</div>
          {citationRefs.map((ref, i) => (
            <div key={i} style={{ fontSize: 12, padding: "8px 10px", marginBottom: 6, background: "#fff", borderRadius: 8, border: "1px solid #eee" }}>
              <div style={{ fontWeight: 500, color: "#333", marginBottom: 2 }}>{ref.source_name}</div>
              {ref.snippet && <div style={{ color: "#888", fontSize: 11 }}>{ref.snippet.slice(0, 100)}...</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
