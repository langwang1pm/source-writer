import { BookOpen, Quote, ChevronRight, ChevronLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SourceRef } from "../../types";

interface CitationPanelProps {
  citations: SourceRef[];
  isOpen: boolean;
  onToggle: () => void;
  activeIndex?: number | null;
}

export default function CitationPanel({ citations, isOpen, onToggle, activeIndex }: CitationPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll to active citation when activeIndex changes
  useEffect(() => {
    if (activeIndex != null && listRef.current) {
      const el = listRef.current.querySelector('[data-citation-idx="' + activeIndex + '"]');
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeIndex]);

  return (
    <>
      {/* Toggle button - always visible on the edge */}
      <button
        onClick={onToggle}
        title={isOpen ? "收起引用面板" : "展开引用面板"}
        style={{
          position: "absolute",
          top: 0,
          right: isOpen ? 300 : 0,
          width: 24,
          height: 48,
          border: "1px solid #e0e0e0",
          borderRight: isOpen ? "none" : "1px solid #e0e0e0",
          background: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px 0 0 6px",
          zIndex: 10,
          color: "#888",
          transition: "right 0.2s",
          boxShadow: "-1px 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

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
              <div
                key={i}
                data-citation-idx={i}
                className="citation-card"
                style={{
                  padding: "10px 12px",
                  marginBottom: 6,
                  background: activeIndex === i ? "#f0edff" : "#fff",
                  borderRadius: 8,
                  border: activeIndex === i ? "1px solid #d4ccf5" : "1px solid #eee",
                  fontSize: 12,
                  lineHeight: 1.5,
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
                    }}
                    title={ref.source_name}
                  >
                    {ref.source_name}
                  </span>
                </div>
                {ref.snippet && (
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
