import { useState, useCallback, useMemo, useEffect } from "react";
import { Bot, User, ChevronDown, ChevronUp, Sparkles, Download, FileText, ExternalLink } from "lucide-react";
import { responseDocs } from "../../api/client";
import type { MessageBlock, ResponseDoc, SourceRef } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Props {
  role: "user" | "assistant";
  content?: string;
  blocks?: MessageBlock[];
  streamingCard?: number | null;
  streamPhase?: "idle" | "waiting" | "thinking" | "answering";
  responseDoc?: ResponseDoc | null;
  onCitationClick?: (ordinal: number, cardOrdinal: number) => void;
  workspaceId?: string;
  citationRefs?: SourceRef[];
}

export default function MessageCard({ role, content, blocks, streamingCard, streamPhase, responseDoc, onCitationClick, workspaceId, citationRefs }: Props) {
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

  if ((!blocks || blocks.length === 0) && !streamPhase) return null;

  // Group blocks by card_ordinal
  const cards = new Map<number, { think: string; answer: string }>();
  for (const b of blocks || []) {
    if (!cards.has(b.card_ordinal)) {
      cards.set(b.card_ordinal, { think: "", answer: "" });
    }
    const card = cards.get(b.card_ordinal)!;
    if (b.block_type === "think") card.think += b.content;
    else card.answer += b.content;
  }

  // During streaming, ensure at least one card entry for stable layout
  if (streamPhase && streamPhase !== "idle" && cards.size === 0) {
    cards.set(streamingCard ?? 0, { think: "", answer: "" });
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
            cardOrdinal={cardOrdinal}
            isStreaming={streamingCard === cardOrdinal}
            streamPhase={streamPhase}
            isLastCard={cardOrdinal === cardKeys[cardKeys.length - 1]}
            responseDoc={responseDoc}
            onCitationClick={onCitationClick}
            workspaceId={workspaceId}
            citationRefs={citationRefs}
          />
        ))}
      </div>
    </div>
  );
}

function CardItem({ card, isStreaming, streamPhase, isLastCard, responseDoc, onCitationClick, workspaceId, citationRefs, cardOrdinal }: {
  card: { think: string; answer: string };
  isStreaming: boolean;
  streamPhase?: "idle" | "waiting" | "thinking" | "answering";
  isLastCard: boolean;
  responseDoc?: ResponseDoc | null;
  onCitationClick?: (ordinal: number, cardOrdinal: number) => void;
  workspaceId?: string;
  citationRefs?: SourceRef[];
  cardOrdinal?: number;
}) {
  const [thinkingCollapsed, setThinkingCollapsed] = useState(true);
  const hasThink = card.think.length > 0;
  const hasAnswer = card.answer.length > 0;
  // Auto-expand/collapse thinking section based on stream phase
  useEffect(() => {
    if (!isStreaming) return;
    if (streamPhase === "thinking") {
      setThinkingCollapsed(false);
    } else if (streamPhase === "answering") {
      setThinkingCollapsed(true);
    }
  }, [streamPhase, isStreaming]);

  // Build lookup: docId~~~chunkId -> ordinal (filtered by cardOrdinal)
  const ordinalMap = useMemo(() => {
    const map = new Map<string, { ordinal: number; difyDocumentId: string; chunkId: string }>();
    const refs = (citationRefs || []).filter(r => cardOrdinal == null || r.card_ordinal === cardOrdinal);
    for (const ref of refs) {
      if (ref.dify_document_id && ref.chunk_id) {
        const key = ref.dify_document_id + "~~~" + ref.chunk_id;
        if (!map.has(key)) {
          map.set(key, { ordinal: ref.ordinal, difyDocumentId: ref.dify_document_id, chunkId: ref.chunk_id });
        }
      }
    }
    return map;
  }, [citationRefs, cardOrdinal]);

  const PAIR_PATTERN = /([0-9a-fA-F\-]+)~~~([0-9a-fA-F\-]+)/g;

  // Pre-process answer: replace citation markers with clickable [n] badges
  const processedAnswer = useMemo(() => {
    if (!card.answer) return card.answer;
    return card.answer.replace(
      /【引用来源[：:]\s*([^】]+)】/g,
      (match, sourceText) => {
        const entries: { ordinal: number; difyDocumentId: string; chunkId: string }[] = [];
        let pairMatch;
        PAIR_PATTERN.lastIndex = 0;
        while ((pairMatch = PAIR_PATTERN.exec(sourceText)) !== null) {
          const key = pairMatch[1] + "~~~" + pairMatch[2];
          const info = ordinalMap.get(key);
          if (info && !entries.find(e => e.ordinal === info.ordinal)) {
            entries.push(info);
          }
        }
        if (entries.length === 0) return match;
        const badges = entries.map(
          (e) =>
            `<span class="citation-ref" data-ordinal="${e.ordinal}" data-doc-id="${e.difyDocumentId}" data-chunk-id="${e.chunkId}" style="cursor:pointer;color:#6c5ce7;font-weight:600;font-size:12px;background:#f0edff;padding:0 5px;border-radius:3px;margin:0 1px;">[${e.ordinal}]</span>`
        ).join('');
        return `【引用来源：${badges}】`;
      }
    );
  }, [card.answer, ordinalMap]);

  const handleAnswerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const citationSpan = target.closest('.citation-ref');
    if (citationSpan) {
      const ordinalStr = citationSpan.getAttribute('data-ordinal');
      if (ordinalStr && onCitationClick) {
        e.preventDefault();
        e.stopPropagation();
        onCitationClick(parseInt(ordinalStr, 10), cardOrdinal ?? 0);
      }
    }
  }, [onCitationClick, cardOrdinal]);


  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e0e0e0",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Thinking section */}
      {(isStreaming || hasThink) && (
        <div style={{
          borderBottom: hasAnswer || (isStreaming && streamPhase === "answering") ? "1px solid #fde68a" : "none",
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
              {hasThink ? (
                <div className="markdown-body" style={{ fontSize: 13, color: "#555" }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.think}</ReactMarkdown>
                </div>
              ) : (
                <div style={{ color: "#b45309", fontStyle: "italic", fontSize: 13 }}>
                  思考中...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Answer section */}
      {(hasAnswer || (isStreaming && streamPhase === "answering")) && (
        <div onClick={handleAnswerClick} style={{ padding: "14px 16px", background: "#fff" }}>
          {hasAnswer ? (
            <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7, color: "#222" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{processedAnswer}</ReactMarkdown>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 3, alignItems: "center", minHeight: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6c5ce7", animation: "sw-bounce 1.2s infinite", animationDelay: "0ms" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6c5ce7", animation: "sw-bounce 1.2s infinite", animationDelay: "200ms" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6c5ce7", animation: "sw-bounce 1.2s infinite", animationDelay: "400ms" }} />
            </div>
          )}
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
