"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

/**
 * Customer-side continuation UI. POSTs to /api/assist/[id]/message and
 * appends each turn. On a 410 (session expired or ended), we lock the
 * input and show a friendly end-state so customers aren't left typing
 * into a void.
 */
export default function AssistContinuation({
  sessionId,
  initialMessages,
  expiresAt,
}: {
  sessionId: string;
  initialMessages: Message[];
  expiresAt: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function send() {
    const msg = input.trim();
    if (!msg || sending || ended) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await fetch(`/api/assist/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: msg }),
      });
      if (res.status === 410) {
        setEnded(true);
        setSending(false);
        return;
      }
      const data = await res.json();
      if (data?.messages) {
        setMessages(data.messages as Message[]);
      }
    } catch {
      // Swallow — the user can retry. Gabby's reply is already logged
      // only after the server persists, so our optimistic user bubble
      // stays if the network dropped.
    } finally {
      setSending(false);
    }
  }

  const minsLeft = Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000),
  );

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="rounded-lg border border-[color:var(--color-border)] bg-white max-h-[60vh] overflow-y-auto p-4 space-y-3"
      >
        {messages.length === 0 && (
          <p className="text-sm text-[color:var(--color-muted)] text-center py-6">
            Ask Gabby anything — wine pairings, gift ideas, what to sip tonight.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[color:var(--color-gold)] text-white"
                  : "bg-zinc-100 text-[color:var(--color-fg)]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 rounded-2xl px-4 py-2 text-sm text-[color:var(--color-muted)]">
              Gabby is thinking…
            </div>
          </div>
        )}
      </div>

      {ended ? (
        <div className="rounded-lg border border-[color:var(--color-border)] p-4 text-sm text-center text-[color:var(--color-muted)]">
          This conversation has ended. Ask the staff to scan a fresh QR if
          you&rsquo;d like to keep going.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gabby…"
            className="flex-1 rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm focus:border-[color:var(--color-gold)] focus:outline-none"
            disabled={sending}
            autoFocus
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-lg bg-[color:var(--color-gold)] text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}

      <p className="text-[11px] text-center text-[color:var(--color-muted)]">
        {ended
          ? " "
          : `Session ends in about ${minsLeft} minute${minsLeft === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}
