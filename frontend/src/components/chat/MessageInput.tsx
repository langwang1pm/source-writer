
import { useState, useRef } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: "flex",
      gap: 8,
      padding: "12px 16px",
      borderTop: "1px solid #e0e0e0",
      background: "#fff",
    }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
        }}
        onKeyDown={handleKeyDown}
        placeholder="输入消息..."
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #d0d0d0",
          fontSize: 14,
          lineHeight: 1.5,
          outline: "none",
          maxHeight: 200,
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        style={{
          alignSelf: "flex-end",
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: disabled || !text.trim() ? "#ccc" : "#1a1a2e",
          color: "#fff",
          cursor: disabled || !text.trim() ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 14,
        }}
      >
        <Send size={16} />
        发送
      </button>
    </div>
  );
}
