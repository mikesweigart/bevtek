"use client";

import { useState, useRef, useEffect } from "react";
import { sendMessageAction, type ChatMessage, type ChatState } from "./actions";
import { AIDisclaimer } from "@/components/AIDisclaimer";

const SUGGESTIONS = [
  "What wine goes well with grilled chicken?",
  "I need a bourbon recommendation",
  "Customer wants a gift under $50",
  "What pairs with salmon?",
  "Looking for a smooth tequila",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [products, setProducts] = useState<ChatState["products"]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    const optimistic: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(optimistic);
    const result = await sendMessageAction(messages, msg);
    if (result.error) {
      setMessages([...optimistic, { role: "assistant", content: `Error: ${result.error}` }]);
    } else {
      setMessages(result.messages);
      setProducts(result.products);
    }
    setSending(false);
  }

  function reset() {
    setMessages([]);
    setProducts([]);
    setInput("");
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[color:var(--color-gold)] flex items-center justify-center text-white text-xl mb-4">M</div>
            <h2 className="text-lg font-semibold mb-1">Ask Megan anything</h2>
            <p className="text-sm text-[color:var(--color-muted)] mb-6 max-w-md">
              She&apos;ll ask follow-up questions to find exactly the right product — like having a master sommelier on your floor.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-3 py-2 rounded-full border border-[color:var(--color-border)] hover:border-[color:var(--color-gold)] hover:text-[color:var(--color-gold)] transition-colors text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isEmpty && (
          <div className="space-y-4 py-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[color:var(--color-gold)] text-white rounded-br-md"
                    : "bg-zinc-100 text-[color:var(--color-fg)] rounded-bl-md"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">Megan</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "assistant" && (
                  <AIDisclaimer variant="footnote" className="mt-1 ml-2" />
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)] animate-pulse" />
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">Megan</span>
                  </div>
                  <p className="text-sm text-[color:var(--color-muted)] animate-pulse">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {products.length > 0 && messages.length >= 4 && (
        <div className="border-t border-[color:var(--color-border)] px-2 py-3">
          <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)] mb-2 px-2">From your inventory</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {products.slice(0, 6).map((p) => (
              <div key={p.id} className="shrink-0 rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs min-w-[140px]">
                <p className="font-semibold truncate">{p.name}</p>
                {p.brand && <p className="text-[color:var(--color-muted)] truncate">{p.brand}</p>}
                <div className="flex justify-between mt-1">
                  {p.price != null && <span className="font-semibold text-[color:var(--color-gold)]">${Number(p.price).toFixed(2)}</span>}
                  <span className="text-[color:var(--color-muted)]">{p.stock_qty} left</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[color:var(--color-border)] px-2 pt-3 pb-2">
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button onClick={reset} className="rounded-md border border-[color:var(--color-border)] px-3 text-sm text-[color:var(--color-muted)] hover:border-[color:var(--color-fg)] shrink-0" title="New conversation">↻</button>
          )}
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isEmpty ? "Ask Megan anything about beverages..." : "Reply to Megan..."}
            disabled={sending}
            className="flex-1 rounded-md border border-[color:var(--color-border)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-gold)] disabled:opacity-60" />
          <button onClick={() => send()} disabled={sending || !input.trim()}
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 text-sm font-semibold disabled:opacity-40 shrink-0">
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
