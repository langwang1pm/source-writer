
import { useState } from "react";
import { Bot, User, ChevronDown, ChevronUp, Sparkles, Download, FileText } from "lucide-react";
import { responseDocs } from "../../api/client";
import type { MessageBlock, ResponseDoc } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  role: "user" | "assistant";
  content?: string;
  blocks?: MessageBlock[];
  streamingCard?: number | null;
  responseDoc?: ResponseDoc | null;
}

export default function MessageCard({ role, content, blocks, streamingCard, responseDoc }: Props) {
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

  return (
    <div style={{ display: "flex", gap: 10, padding: "16px 20px" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6c5ce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bot size={16} color="#fff" />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from(cards.entries()).map(([cardOrdinal, card]) => (
                  <CardItem
                    key={cardOrdinal}
                    card={card}
                    isStreaming={streamingCard === cardOrdinal}
                    isLastCard={cardOrdinal === Array.from(cards.keys()).pop()}
                    responseDoc={responseDoc}
                  />
                ))}
      </div>
    </div>
  );
}

function CardItem({ card, isStreaming, isLastCard, responseDoc }: {
  card: { think: string; answer: string };
  isStreaming: boolean;
  isLastCard: boolean;
  responseDoc?: ResponseDoc | null;
}) {
  const [thinkingCollapsed, setThinkingCollapsed] = useState(true);
  const hasThink = card.think.length > 0;
  const hasAnswer = card.answer.length > 0;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e0e0e0",
      borderRadius: 12,
      overflow: "hidden",
      opacity: isStreaming && !hasAnswer ? 0.8 : 1,
    }}>
      {hasThink && (
        <div style={{ borderBottom: hasAnswer ? "1px solid #f0d6a0" : "none" }}>
          <button
            onClick={() => setThinkingCollapsed(!thinkingCollapsed)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px", background: "#fffbeb", border: "none",
              cursor: "pointer", fontSize: 13, color: "#92400e", fontWeight: 500 }}
          >
            <Sparkles size={14} color="#d97706" />
            <span style={{ flex: 1, textAlign: "left" }}>
              {thinkingCollapsed ? "View thinking" : "Hide thinking"}
            </span>
            {thinkingCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {!thinkingCollapsed && (
            <div style={{ padding: "4px 14px 12px", background: "#fffbeb", fontSize: 13, lineHeight: 1.6, color: "#555" }}>
              <div className="markdown-body" style={{ fontSize: 13 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.think}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
      {hasAnswer && (
        <div style={{ padding: "14px 16px" }}>
          <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.answer}</ReactMarkdown>
          </div>
        </div>
      )}
      {isStreaming && !hasAnswer && !hasThink && (
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#888" }}>AI generating...</span>
        </div>
      )}
      {!isStreaming && isLastCard && responseDoc && (
        <div style={{ borderTop: "1px solid #e0e0e0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, background: "#fafafa" }}>
          <FileText size={16} color="#666" />
          <span style={{ flex: 1, fontSize: 13, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {responseDoc.title || "Document"}
          </span>
          <a href={responseDocs.exportUrl(responseDoc.id)} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#1a73e8", textDecoration: "none", padding: "4px 8px", borderRadius: 4, background: "#e8f0fe" }}>
            <Download size={12} /> Download
          </a>
        </div>
      )}
    </div>
  );
}
