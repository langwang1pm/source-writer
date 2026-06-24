import { BookOpen, Quote, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import type { SourceRef, SegmentDetail } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { difySegments } from "../../api/client";

interface CitationPanelProps {
  citations: SourceRef[];
  isOpen: boolean;
  activeIndex?: number | null;
}

export default function CitationPanel({ citations, isOpen, activeIndex }: CitationPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [segmentDetails, setSegmentDetails] = useState<Map<number, SegmentDetail>>(new Map());

  // Scroll to active citation when activeIndex changes, and auto-expand
  useEffect(() => {
    if (activeIndex == null) return;

    // Scroll to the citation card
    if (listRef.current) {
      const el = listRef.current.querySelector('[data-citation-idx="' + activeIndex + '"]');
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    // Auto-expand and fetch segment detail
    if (activeIndex < citations.length) {
      setExpandedIdx(activeIndex);
      const ref = citations[activeIndex];
      if (ref.dify_document_id && ref.chunk_id && !segmentDetails.has(activeIndex)) {
        setLoadingIdx(activeIndex);
        difySegments.get(ref.dify_document_id, ref.chunk_id)
          .then((detail: any) => {
            setSegmentDetails((prev) => {
              const next = new Map(prev);
              next.set(activeIndex, detail as SegmentDetail);
              return next;
            });
          })
          .finally(() => setLoadingIdx(null));
      }
    }
  }, [activeIndex, citations, segmentDetails]);

  const handleExpand = useCallback(async (idx: number, ref: SourceRef) => {
    if (expandedIdx === idx) {
      setExpandedIdx(null);
      return;
    }
    setExpandedIdx(idx);

    // If already fetched segment detail, just expand
    if (segmentDetails.has(idx)) return;

    // Fetch segment detail from API
    if (ref.dify_document_id && ref.chunk_id) {
      setLoadingIdx(idx);
      try {
        const detail = await difySegments.get(ref.dify_document_id, ref.chunk_id);
        setSegmentDetails((prev) => {
          const next = new Map(prev);
          next.set(idx, detail as SegmentDetail);
          return next;
        });
      } catch {
        // Silent fail - show no detail
      } finally {
        setLoadingIdx(null);
      }
    }
  }, [expandedIdx, segmentDetails]);

  return (
    <>
      {/* Panel */}
      <div
        style={{
          width: isOpen ? 300 : 0,
          minWidth: isOpen ? 300 : 0,
          overflow: "hidden",
          borderLeft: isOpen ? "1px solid #e0e0e0" : "none",
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s, min-width 0.2s",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 40,
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #e5e5e5",
            background: "#f5f5f6",
            flexShrink: 0,
          }}
        >
          <BookOpen size={14} color="#888" style={{ marginRight: 6 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>
            引用来源
          </span>
          {citations.length > 0 && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "#888",
                background: "#e8e8ee",
                padding: "1px 7px",
                borderRadius: 8,
              }}
            >
              {citations.length}
            </span>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: "auto", padding: 10 }} ref={listRef}>
          {citations.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 16px",
                color: "#bbb",
              }}
            >
              <Quote size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
              <div style={{ fontSize: 13, color: "#ccc" }}>暂无引用</div>
              <div style={{ fontSize: 11, color: "#ddd", marginTop: 4 }}>
                AI 回复将在此显示引用来源
              </div>
            </div>
          ) : (
            citations.map((ref, i) => (
              <div key={i}>
                <div
                  data-citation-idx={i}
                  className="citation-card"
                  onClick={() => handleExpand(i, ref)}
                  style={{
                    padding: "10px 12px",
                    marginBottom: expandedIdx === i ? 0 : 6,
                    background: activeIndex === i ? "#f0edff" : "#fff",
                    borderRadius: expandedIdx === i ? "8px 8px 0 0" : 8,
                    border: activeIndex === i ? "1px solid #d4ccf5" : "1px solid #eee",
                    borderBottom: expandedIdx === i ? "none" : "1px solid #eee",
                    fontSize: 12,
                    lineHeight: 1.5,
                    cursor: "pointer",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#6c5ce7",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {ref.ordinal}
                    </span>
                    <span
                      style={{
                        fontWeight: 500,
                        color: "#333",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                      title={ref.source_name}
                    >
                      {ref.source_name}
                    </span>
                    {loadingIdx === i ? (
                      <Loader2 size={12} color="#888" style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      expandedIdx === i ? <ChevronUp size={12} color="#888" /> : <ChevronDown size={12} color="#888" />
                    )}
                  </div>
                  {ref.snippet && expandedIdx !== i && (
                    <div
                      style={{
                        color: "#888",
                        fontSize: 11,
                        marginTop: 2,
                        paddingLeft: 26,
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {ref.snippet}
                    </div>
                  )}
                </div>

                {/* Expanded detail panel */}
                {expandedIdx === i && (
                  <div
                    style={{
                      padding: "10px 12px",
                      marginBottom: 6,
                      background: "#fff",
                      border: "1px solid #d4ccf5",
                      borderTop: "none",
                      borderRadius: "0 0 8px 8px",
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "#444",
                    }}
                  >
                    {loadingIdx === i ? (
                      <div style={{ textAlign: "center", padding: "12px 0", color: "#999" }}>
                        <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginBottom: 4 }} />
                        <div>加载中...</div>
                      </div>
                    ) : segmentDetails.has(i) ? (
                      <div className="markdown-body" style={{ fontSize: 12, lineHeight: 1.6, color: "#444" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {segmentDetails.get(i)?.content || ""}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div style={{ color: "#999", fontStyle: "italic" }}>
                        暂无分段详情
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid #e5e5e5",
            background: "#f5f5f6",
            fontSize: 11,
            color: "#bbb",
            flexShrink: 0,
          }}
        >
          {citations.length > 0
            ? "点击左侧引用标记查看详情"
            : "引用内容将在此显示"}
        </div>
      </div>
    </>
  );
}
