"use client";

import { useState, useRef, useEffect } from "react";
import { askShopper, type ChatMessage } from "./actions";

const PROMPTS = [
  "I need a wine for tonight's dinner",
  "Looking for a gift under $50",
  "Recommend a smooth bourbon",
  "What pairs with steak?",
];

export function ShopperChat({
  storeId,
  storeName,
}: {
  storeId: string;
  storeName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    const optimistic: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(optimistic);

    const res = await askShopper(storeId, messages, msg);
    if (res.error) {
      setMessages([
        ...optimistic,
        { role: "assistant", content: `Sorry — ${res.error}` },
      ]);
    } else {
      setMessages(res.messages);
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white overflow-hidden flex flex-col h-[600px] shadow-sm">
      <div className="px-4 py-3 border-b border-[color:var(--color-border)] bg-gradient-to-r from-[#FBF7F0] to-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[color:var(--color-gold)] flex items-center justify-center text-white font-bold text-sm">
          G
        </div>
        <div>
          <p className="text-sm font-semibold">Gabby</p>
          <p className="text-[10px] text-[color:var(--color-muted)]">
            {storeName} · online now
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
      >
        {isEmpty && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-[color:var(--color-muted)] px-2 leading-relaxed">
              Hi! I&apos;m Gabby — your personal beverage expert at {storeName}.
              What can I help you find today?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-xs text-left px-3 py-2 rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-gold)] hover:bg-[#FBF7F0] transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[color:var(--color-gold)] text-white rounded-br-md"
                  : "bg-zinc-100 text-[color:var(--color-fg)] rounded-bl-md"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 rounded-2xl rounded-bl-md px-3 py-2">
              <p className="text-xs text-[color:var(--color-muted)] animate-pulse">
                Gabby is thinking...
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[color:var(--color-border)] p-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending}
            placeholder="Tell Gabby what you're looking for..."
            className="flex-1 rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)] disabled:opacity-60"
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="rounded-lg bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 text-sm font-semibold disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
