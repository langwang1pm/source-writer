
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { sessions, messages as messagesApi, messageBlocks, responseDocs, sourceRefs } from "../api/client";
import { useSSE } from "../hooks/useSSE";
import { BookOpen } from "lucide-react";
import MessageCard from "../components/chat/MessageCard";
import MessageInput from "../components/chat/MessageInput";
import CitationPanel from "../components/layout/CitationPanel";
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
  const [streamPhase, setStreamPhase] = useState<"idle" | "waiting" | "thinking" | "answering">("idle");
  const [citationRefs, setCitationRefs] = useState<SourceRef[]>([]);
  const [showCitation, setShowCitation] = useState(true);
  const [activeCitationIndex, setActiveCitationIndex] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [sessionTaskType, setSessionTaskType] = useState<string>("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const thinkBufRef = useRef("");
  const insideThinkRef = useRef(false);

  // Load messages for active session
  useEffect(() => {
    if (!sessionId) return;
    // Clear temporary states when switching sessions
    setStreamBlocks([]);
    setStreamingCard(null);
    setStreamPhase("idle");
    setCitationRefs([]);
    loadMessages(sessionId);
    sessions.get(sessionId).then((s: any) => {
      setSessionTitle(s.title || "");
      setSessionTaskType(s.task_type_name || "");
    }).catch(() => {});
  }, [sessionId]);

  const loadMessages = async (sid: string) => {
    setCitationRefs([]);
    try {
      const res = await messagesApi.list(sid);
      const msgList: DisplayMessage[] = [];

      // Fetch all response docs for this session once
      const docsRes = await responseDocs.list({ session_id: sid });
      const docs: ResponseDoc[] = docsRes.items || [];

      // Load source refs for citations panel (from latest response doc)
      let latestDocId: string | null = null;
 
      for (const msg of (res.items || []) as ChatMessage[]) {
        msgList.push({ id: msg.id, role: "user", content: msg.content });

        const blocksRes = await messageBlocks.list(msg.id);
        const blocks: MessageBlock[] = blocksRes || [];

        const doc = docs.find((d) => d.chat_message_id === msg.id);
        if (doc && !latestDocId) {
          latestDocId = doc.id;
        }

        msgList.push({
          id: `resp-${msg.id}`,
          role: "assistant",
          blocks,
          responseDoc: doc,
        });
      }
      setMessages(msgList);
 
      // Populate citation panel from the latest response doc's source refs
      if (latestDocId) {
        try {
          const refsRes = await sourceRefs.list(latestDocId);
          setCitationRefs(refsRes.items || []);
        } catch {}
      }
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
    const msgRes = await messagesApi.send(sid, { content });
    const userMsg: DisplayMessage = {
      id: msgRes.id,
      role: "user",
      content: msgRes.content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreamBlocks([]);
    setStreamingCard(null);
    setStreamPhase("waiting");
    setStreamingCard(1);

    // Start SSE stream
    const streamUrl = messagesApi.streamUrl(sid, msgRes.id);
    startStream(streamUrl, {
      onThinkDelta: (cardOrdinal, delta) => {
        // Think content is handled by onAnswerDelta via <think> tag parsing
        // Only set streaming state here
        if (delta.replace(/^<think>\s*/g, "").trim()) {
          setStreamPhase((prev) => prev === "waiting" ? "thinking" : prev);
        }
        setStreamingCard(cardOrdinal);
      },
      onAnswerDelta: (cardOrdinal, delta) => {
        // Buffer and split think/answer content by <think> tags
        thinkBufRef.current += delta;
        const buf = thinkBufRef.current;

        let thinkChunk = "";
        let answerChunk = "";

        // Process the buffer
        let remaining = buf;
        thinkBufRef.current = "";

        while (remaining.length > 0) {
          const thinkStart = remaining.indexOf("<think>");
          const thinkEnd = remaining.indexOf("</think>");

          if (thinkStart === -1 && thinkEnd === -1) {
            // No tags in remaining text
            if (insideThinkRef.current) {
              thinkChunk += remaining;
            } else {
              answerChunk += remaining;
            }
            remaining = "";
          } else if (thinkStart >= 0 && (thinkEnd === -1 || thinkStart < thinkEnd)) {
            // <think> comes first (or only <think> exists)
            if (insideThinkRef.current) {
              // Already inside think - text before <think> is think content
              thinkChunk += remaining.substring(0, thinkStart);
            } else {
              // Entering think - text before <think> is answer
              answerChunk += remaining.substring(0, thinkStart);
              insideThinkRef.current = true;
            }
            remaining = remaining.substring(thinkStart + 7); // skip <think>

            // Check if </think> is in the remaining text
            const closeIdx = remaining.indexOf("</think>");
            if (closeIdx >= 0) {
              thinkChunk += remaining.substring(0, closeIdx);
              remaining = remaining.substring(closeIdx + 8); // skip </think>
              insideThinkRef.current = false;
            } else {
              // No closing tag yet - emit immediately
              thinkChunk += remaining;
              remaining = "";
            }
          } else if (thinkEnd >= 0) {
            // </think> without preceding <think>
            if (insideThinkRef.current) {
              thinkChunk += remaining.substring(0, thinkEnd);
              remaining = remaining.substring(thinkEnd + 8);
              insideThinkRef.current = false;
            } else {
              answerChunk += remaining.substring(0, thinkEnd + 8);
              remaining = remaining.substring(thinkEnd + 8);
            }
          }
        }

        // Update stream phase
        if (thinkChunk) {
          setStreamPhase((prev) => prev === "waiting" || prev === "idle" ? "thinking" : prev);
        }
        if (answerChunk) {
          setStreamPhase((prev) => prev === "thinking" || prev === "waiting" ? "answering" : prev);
        }

        // Update stream blocks
        setStreamBlocks((prev) => {
          const newBlocks = [...prev];

          if (thinkChunk) {
            const thinkIdx = newBlocks.findIndex(
              (b) => b.card_ordinal === cardOrdinal && b.block_type === "think"
            );
            if (thinkIdx >= 0) {
              newBlocks[thinkIdx] = {
                ...newBlocks[thinkIdx],
                content: newBlocks[thinkIdx].content + thinkChunk,
              };
            } else {
              newBlocks.push({
                id: `stream-${cardOrdinal}-think`,
                session_id: sid,
                user_message_id: msgRes.id,
                card_ordinal: cardOrdinal,
                block_type: "think",
                content: thinkChunk,
                ordinal: newBlocks.length + 1,
                created_at: new Date().toISOString(),
              });
            }
          }

          if (answerChunk) {
            const answerIdx = newBlocks.findIndex(
              (b) => b.card_ordinal === cardOrdinal && b.block_type === "answer"
            );
            if (answerIdx >= 0) {
              newBlocks[answerIdx] = {
                ...newBlocks[answerIdx],
                content: newBlocks[answerIdx].content + answerChunk,
              };
            } else {
              newBlocks.push({
                id: `stream-${cardOrdinal}-answer`,
                session_id: sid,
                user_message_id: msgRes.id,
                card_ordinal: cardOrdinal,
                block_type: "answer",
                content: answerChunk,
                ordinal: newBlocks.length + 1,
                created_at: new Date().toISOString(),
              });
            }
          }

          return newBlocks;
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
            dify_document_id: r.dify_document_id || null,
            uploaded_file_id: null,
            chunk_id: r.chunk_id || null,
            snippet: null,
            relevance_score: null,
            char_position: r.char_position,
          })),
        ]);
      },
      onDone: () => {
        setStreamingCard(null);
        setStreamPhase("idle");
        setStreamBlocks([]);
        setCitationRefs([]);
        if (sessionId) loadMessages(sessionId);
      },
      onError: (err) => {
        console.error("SSE error:", err);
        setStreamingCard(null);
        setStreamPhase("idle");
      },
    });
  }, [workspaceId, sessionId, isStreaming, startStream]);

  const handleCitationClick = useCallback((ordinal: number, cardOrdinal: number) => {
    // Find ref matching ordinal + card_ordinal
    const idx = citationRefs.findIndex((r) => r.ordinal === ordinal && r.card_ordinal === cardOrdinal);
    if (idx >= 0) {
      setActiveCitationIndex(idx);
      if (!showCitation) setShowCitation(true);
    }
  }, [citationRefs, showCitation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBlocks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        {!sessionId ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 14 }}>
            从左侧选择一个对话，或创建新对话
          </div>
        ) : (
          <>
            {(sessionTitle || sessionTaskType) && (
              <div style={{
                padding: "10px 16px", borderBottom: "1px solid #e5e5e5",
                background: "#fff", fontSize: 14, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "40%"}}>{sessionTitle || "新对话"}</span>
                {sessionTaskType && (
                  <span style={{
                    fontSize: 11, color: "#888", background: "#f0f0f5",
                    padding: "2px 8px", borderRadius: 4,
                  }}>{sessionTaskType}</span>
                )}
                <button
                  onClick={() => setShowCitation(!showCitation)}
                  style={{marginLeft: "auto",
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 12, color: showCitation ? "#6c5ce7" : "#888",
                    background: showCitation ? "#f0edff" : "transparent",
                    border: "1px solid", borderColor: showCitation ? "#d4ccf5" : "#ddd",
                    borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                    fontWeight: 500, transition: "all 0.15s",
                  }}
                >
                  <BookOpen size={13} />
                  引用来源
                  {citationRefs.length > 0 && (
                    <span style={{
                      fontSize: 10, background: showCitation ? "#6c5ce7" : "#999",
                      color: "#fff", borderRadius: 8, padding: "0 5px",
                      lineHeight: "16px", fontWeight: 600,
                    }}>
                      {citationRefs.length}
                    </span>
                  )}
                </button>
              </div>
            )}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
              <div style={{ flex: 1, overflow: "auto", background: "#f5f5f7" }}>
              {messages.map((msg) => (
                <MessageCard key={msg.id} role={msg.role} content={msg.content} blocks={msg.blocks} responseDoc={msg.responseDoc} onCitationClick={handleCitationClick} workspaceId={workspaceId} citationRefs={citationRefs} />
              ))}
              {isStreaming ? (
                <MessageCard role="assistant" blocks={streamBlocks} streamingCard={streamingCard} streamPhase={streamPhase} onCitationClick={handleCitationClick} workspaceId={workspaceId} citationRefs={citationRefs} />
              ) : null}
              <div ref={chatEndRef} />
            </div>
              {/* Citation panel */}
              <CitationPanel
                citations={citationRefs}
                isOpen={showCitation}
                activeIndex={activeCitationIndex}
              />
            </div>
            <MessageInput onSend={handleSend} disabled={isStreaming} />
          </>
        )}
    </div>
  );
}
