
import { useCallback, useRef, useState } from "react";
import type { SSEEvent } from "../types";

interface UseSSEOptions {
  onThinkDelta?: (cardOrdinal: number, delta: string) => void;
  onAnswerDelta?: (cardOrdinal: number, delta: string) => void;
  onCitationUpdate?: (cardOrdinal: number, refs: any[]) => void;
  onDone?: (data: any) => void;
  onError?: (message: string) => void;
}

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    (url: string, options: UseSSEOptions) => {
      setIsStreaming(true);

      // Use fetch + reader for SSE (EventSource doesn't support POST)
      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const resp = await fetch(url, {
            headers: { Accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (!resp.ok) {
            options.onError?.(`SSE connection failed: ${resp.status}`);
            setIsStreaming(false);
            return;
          }

          const reader = resp.body?.getReader();
          if (!reader) {
            options.onError?.("No response body");
            setIsStreaming(false);
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";
          let lastUpdate = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let currentEvent = "";
            let currentData = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                currentData = line.slice(6).trim();
              } else if (line === "") {
                if (currentEvent && currentData) {
                  const now = Date.now();
                  if (now - lastUpdate > 50) {
                    lastUpdate = now;
                  }
                  handleEvent(currentEvent, currentData, options);
                }
                currentEvent = "";
                currentData = "";
              }
            }
          }
        } catch (err: any) {
          if (err.name !== "AbortError") {
            options.onError?.(err.message || "SSE connection error");
          }
        } finally {
          setIsStreaming(false);
        }
      })();
    },
    []
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, startStream, stopStream };
}

function handleEvent(event: string, data: string, options: UseSSEOptions) {
  try {
    const parsed = JSON.parse(data);
    switch (event) {
      case "think_delta":
        options.onThinkDelta?.(parsed.card_ordinal, parsed.delta);
        break;
      case "answer_delta":
        options.onAnswerDelta?.(parsed.card_ordinal, parsed.delta);
        break;
      case "citation_update":
        options.onCitationUpdate?.(parsed.card_ordinal, parsed.refs);
        break;
      case "done":
        options.onDone?.(parsed);
        break;
      case "error":
        options.onError?.(parsed.message);
        break;
    }
  } catch {}
}
