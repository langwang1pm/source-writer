import { useState, useCallback, useMemo } from "react";
import { Bot, User, ChevronDown, ChevronUp, Sparkles, Download, FileText, ExternalLink } from "lucide-react";
import { responseDocs } from "../../api/client";
import type { MessageBlock, ResponseDoc } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Props {
  role: "user" | "assistant";
  content?: string;
  blocks?: MessageBlock[];
  streamingCard?: number | null;
  responseDoc?: ResponseDoc | null;
  onCitationClick?: (sourceName: string) => void;
  workspaceId?: string;
}

export default function MessageCard({ role, content, blocks, streamingCard, responseDoc, onCitationClick, workspaceId }: Props) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", gap: 10, padding: "16px 20px", justifyContent: "flex-end" }}>
        <div style={{
          maxWidth: "70%",
          background: "#1a1a2e",
          color: "#fff",
          padding: "10px 16px",
          borderRadius: "12px 12px 4px 12px",
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}>
          {content}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <User size={16} color="#fff" />
        </div>
      </div>
    );
  }

  if (!blocks || blocks.length === 0) return null;

  // Group blocks by card_ordinal
  const cards = new Map<number, { think: string; answer: string }>();
  for (const b of blocks) {
    if (!cards.has(b.card_ordinal)) {
      cards.set(b.card_ordinal, { think: "", answer: "" });
    }
    const card = cards.get(b.card_ordinal)!;
    if (b.block_type === "think") card.think += b.content;
    else card.answer += b.content;
  }

  const cardKeys = Array.from(cards.keys());

  return (
    <div style={{ display: "flex", gap: 10, padding: "16px 20px" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6c5ce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bot size={16} color="#fff" />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {cardKeys.map((cardOrdinal) => (
          <CardItem
            key={cardOrdinal}
            card={cards.get(cardOrdinal)!}
            isStreaming={streamingCard === cardOrdinal}
            isLastCard={cardOrdinal === cardKeys[cardKeys.length - 1]}
            responseDoc={responseDoc}
            onCitationClick={onCitationClick}
            workspaceId={workspaceId}
          />
        ))}
      </div>
    </div>
  );
}

function CardItem({ card, isStreaming, isLastCard, responseDoc, onCitationClick, workspaceId }: {
  card: { think: string; answer: string };
  isStreaming: boolean;
  isLastCard: boolean;
  responseDoc?: ResponseDoc | null;
  onCitationClick?: (sourceName: string) => void;
  workspaceId?: string;
}) {
  const [thinkingCollapsed, setThinkingCollapsed] = useState(true);
  const hasThink = card.think.length > 0;
  const hasAnswer = card.answer.length > 0;
  const hasAnyContent = hasThink || hasAnswer;

  // Pre-process answer content to make citation markers clickable
  const processedAnswer = useMemo(() => {
    if (!card.answer) return card.answer;
    return card.answer.replace(
      /【引用来源[：:]\s*([^】]+)】/g,
      (match, sourceName) =>
        `<span class="citation-ref" data-source="${sourceName.replace(/"/g, '&quot;')}" style="cursor:pointer;color:#6c5ce7;font-weight:500;border-bottom:1px dashed #d4ccf5;">${match}</span>`
    );
  }, [card.answer]);

  const handleAnswerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const citationSpan = target.closest('.citation-ref');
    if (citationSpan) {
      const sourceName = citationSpan.getAttribute('data-source');
      if (sourceName && onCitationClick) {
        e.preventDefault();
        e.stopPropagation();
        onCitationClick(sourceName);
      }
    }
  }, [onCitationClick]);


  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e0e0e0",
      borderRadius: 12,
      overflow: "hidden",
      transition: "opacity 0.2s",
      opacity: isStreaming && !hasAnyContent ? 0.85 : 1,
    }}>
      {/* Streaming animation (no content yet) */}
      {isStreaming && !hasAnyContent && (
        <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div className="sw-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", animation: "sw-bounce 1.2s infinite", animationDelay: "0ms" }} />
            <div className="sw-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", animation: "sw-bounce 1.2s infinite", animationDelay: "200ms" }} />
            <div className="sw-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", animation: "sw-bounce 1.2s infinite", animationDelay: "400ms" }} />
          </div>
          <span style={{ fontSize: 13, color: "#a16207", fontWeight: 500 }}>AI 正在思考</span>
        </div>
      )}

      {/* Thinking section */}
      {hasThink && (
        <div style={{
          borderBottom: hasAnswer ? "1px solid #fde68a" : "none",
          background: "#fffbeb",
        }}>
          <button
            onClick={() => setThinkingCollapsed(!thinkingCollapsed)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", background: "transparent", border: "none",
              cursor: "pointer", fontSize: 13, color: "#92400e", fontWeight: 500,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fef3c7")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Sparkles size={14} color="#d97706" />
            <span style={{ flex: 1, textAlign: "left" }}>
              {thinkingCollapsed ? "查看思考过程" : "收起思考过程"}
              {!isStreaming && (
                <span style={{ fontSize: 11, color: "#b45309", marginLeft: 6, opacity: 0.6 }}>
                  ({card.think.length} 字)
                </span>
              )}
            </span>
            {isStreaming && (
              <div style={{ display: "flex", gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#d97706", animation: "sw-bounce 1.2s infinite", animationDelay: "0ms" }} />
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#d97706", animation: "sw-bounce 1.2s infinite", animationDelay: "200ms" }} />
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#d97706", animation: "sw-bounce 1.2s infinite", animationDelay: "400ms" }} />
              </div>
            )}
            {!isStreaming && (thinkingCollapsed ? <ChevronDown size={14} color="#d97706" /> : <ChevronUp size={14} color="#d97706" />)}
          </button>

          {!thinkingCollapsed && (
            <div style={{
              padding: "4px 14px 14px",
              background: "#fffbeb",
              fontSize: 13, lineHeight: 1.6, color: "#555",
              borderTop: "1px solid #fde68a",
            }}>
              <div className="markdown-body" style={{ fontSize: 13, color: "#555" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.think}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answer section */}
      {hasAnswer && (
        <div style={{ padding: "14px 16px", background: "#fff" }}>
          <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7, color: "#222" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.answer}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* ResponseDoc footer */}
      {!isStreaming && isLastCard && responseDoc && (
        <div style={{
          borderTop: "1px solid #e0e0e0",
          padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          background: "#fafafa",
        }}>
          <FileText size={16} color="#666" />
          <span style={{
            flex: 1, fontSize: 13, color: "#333",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {responseDoc.title || "文档"}
            {responseDoc.revision > 1 && (
              <span style={{
                fontSize: 11, color: "#888", marginLeft: 6,
                background: "#eee", padding: "1px 5px", borderRadius: 3,
              }}>
                v{responseDoc.revision}
              </span>
            )}
          </span>
          <a
            href={`/workspace/${workspaceId}/docs/${responseDoc.id}?sessionId=${responseDoc.session_id}`}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 12, color: "#6c5ce7", textDecoration: "none",
              padding: "5px 10px", borderRadius: 6,
              background: "#f0edff",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e4dcff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f0edff")}
          >
            <ExternalLink size={12} />
            查看文档
          </a>
          <a
            href={responseDocs.exportUrl(responseDoc.id)}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 12, color: "#555", textDecoration: "none",
              padding: "5px 10px", borderRadius: 6,
              background: "#f0f0f0",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e0e0e0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f0f0f0")}
          >
            <Download size={12} />
            导出
          </a>
        </div>
      )}
    </div>
  );
}
