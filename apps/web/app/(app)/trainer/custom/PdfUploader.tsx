"use client";

import { useRef, useState } from "react";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT = ".pdf,.docx,.doc,.txt,.md";

export function PdfUploader({ storeId }: { storeId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    title: string;
    preview: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    setError(null);
    setResult(null);
    if (f.size > MAX_SIZE) {
      setError("File too large (max 10 MB).");
      return;
    }
    setFile(f);
  }

  async function generate() {
    if (!file) return;
    setProcessing(true);
    setError(null);

    // TODO: send to API route that reads the document and calls Claude
    // to generate a module + quiz. For now, show a placeholder.
    await new Promise((r) => setTimeout(r, 2000));

    setResult({
      title: `Module from ${file.name}`,
      preview:
        "This feature requires the Anthropic API key to generate modules from uploaded documents. Once connected, Megan will read your PDF, extract key facts, write a training module, and create 2 quiz questions — all automatically.",
    });
    setProcessing(false);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-[color:var(--color-gold)] bg-amber-50/40"
            : file
              ? "border-[color:var(--color-gold)] bg-[#FBF7F0]"
              : "border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {file ? (
          <div className="space-y-2">
            <p className="text-2xl">📄</p>
            <p className="text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-[color:var(--color-muted)]">
              {(file.size / 1024).toFixed(0)} KB · Ready to generate
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-2xl">📤</p>
            <p className="text-sm font-medium">
              Drop a PDF, DOCX, or text file here
            </p>
            <p className="text-xs text-[color:var(--color-muted)]">
              or click to browse · Max 10 MB
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {file && !result && (
        <button
          onClick={generate}
          disabled={processing}
          className="w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white py-3 text-sm font-semibold disabled:opacity-60"
        >
          {processing
            ? "Megan is reading your document..."
            : "Generate training module"}
        </button>
      )}

      {result && (
        <div className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-3">
          <h3 className="text-sm font-semibold">{result.title}</h3>
          <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
            {result.preview}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="rounded-md border border-[color:var(--color-border)] px-4 py-2 text-sm hover:border-[color:var(--color-fg)]"
            >
              Upload a different file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
