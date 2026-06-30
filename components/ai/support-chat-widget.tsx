"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm the Lucky Jambo assistant. Ask me about deposits, withdrawals, games, or how the platform works." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    setError("");
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add an empty assistant message to stream into
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.slice(-10) }), // last 10 turns
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message ?? "Something went wrong. Please try again.");
        setMessages(prev => prev.slice(0, -1)); // remove empty assistant bubble
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch {
      setError("Connection error. Please try again.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)", boxShadow: "0 4px 20px var(--lj-glow)" }}
        aria-label="Open support chat"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 z-50 flex h-[480px] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl shadow-2xl md:bottom-24 md:right-6"
          style={{ background: "var(--lj-navy-2)", border: "1px solid var(--lj-border)" }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--lj-border)", background: "rgba(26,86,255,0.08)" }}>
            <Sparkles size={16} style={{ color: "var(--lj-cyan)" }} />
            <div>
              <p className="text-sm font-bold text-white">Lucky Jambo Assistant</p>
              <p className="text-[10px] text-[var(--lj-muted)]">Powered by AI · Ask anything about the platform</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "text-white" : "text-[var(--lj-text)]"}`}
                  style={{
                    background: m.role === "user" ? "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" : "rgba(255,255,255,0.05)",
                    border: m.role === "assistant" ? "1px solid var(--lj-border)" : "none",
                  }}>
                  {m.content || (streaming && i === messages.length - 1 ? <span className="inline-flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0.1s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0.2s]" /></span> : "")}
                </div>
              </div>
            ))}
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-3" style={{ borderTop: "1px solid var(--lj-border)" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Ask about deposits, games, rules…"
              disabled={streaming}
              className="lj-input flex-1 text-sm"
              style={{ padding: "8px 12px" }}
            />
            <button onClick={sendMessage} disabled={streaming || !input.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" }}>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
