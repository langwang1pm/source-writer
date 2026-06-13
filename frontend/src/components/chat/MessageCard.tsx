
import { Bot, User } from "lucide-react";
import type { MessageBlock } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  role: "user" | "assistant";
  content?: string;
  blocks?: MessageBlock[];
  streamingCard?: number | null;
}

export default function MessageCard({ role, content, blocks, streamingCard }: Props) {
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
          <div key={cardOrdinal} style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 12,
            overflow: "hidden",
            opacity: streamingCard === cardOrdinal ? 0.8 : 1,
          }}>
            {card.think && (
              <div style={{ padding: "12px 16px", background: "#f8f9fa", borderBottom: card.answer ? "1px solid #e0e0e0" : "none" }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>思考过程</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: "#555", whiteSpace: "pre-wrap" }}>
                  {card.think}
                </div>
              </div>
            )}
            {card.answer && (
              <div style={{ padding: "12px 16px" }}>
                <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {card.answer}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
