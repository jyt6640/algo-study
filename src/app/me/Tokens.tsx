"use client";

import { useEffect, useState } from "react";

type Tok = { id: number; createdAt: string; lastUsedAt: string | null };

export function Tokens() {
  const [tokens, setTokens] = useState<Tok[]>([]);
  const [issued, setIssued] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await fetch("/api/tokens").then((r) => r.json());
    setTokens(d.tokens ?? []);
  }
  useEffect(() => {
    load();
    setApiBase(window.location.origin);
  }, []);

  async function issue() {
    setBusy(true);
    try {
      const d = await fetch("/api/tokens", { method: "POST" }).then((r) => r.json());
      if (d.token) setIssued(d.token);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("이 토큰을 폐기할까요? 그 토큰을 쓰던 확장은 다시 연동해야 해요.")) return;
    await fetch("/api/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <section className="card mt-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">확장 연동 토큰</h2>
        <button onClick={issue} disabled={busy} className="btn btn-secondary !px-4 !py-1.5 text-sm">
          {busy ? "발급 중…" : "새 토큰 발급"}
        </button>
      </div>

      {issued && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-secondary">API 주소</div>
          <Field value={apiBase} onCopy={copy} />
          <div className="text-xs text-secondary">토큰 (지금만 표시)</div>
          <Field value={issued} onCopy={copy} mono />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {tokens.length === 0 ? (
          <p className="text-sm text-secondary">활성 토큰이 없어요.</p>
        ) : (
          tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span className="text-secondary">
                #{t.id} · 발급 {t.createdAt.slice(0, 10)} ·{" "}
                {t.lastUsedAt ? `최근 사용 ${t.lastUsedAt.slice(0, 10)}` : "미사용"}
              </span>
              <button
                onClick={() => revoke(t.id)}
                className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--surface-2)]"
                style={{ borderColor: "var(--border)" }}
              >
                폐기
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Field({ value, onCopy, mono }: { value: string; onCopy: (t: string) => void; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <input readOnly value={value} className={`input ${mono ? "font-mono" : ""}`} />
      <button onClick={() => onCopy(value)} className="btn btn-secondary shrink-0 !px-4 !py-2">
        복사
      </button>
    </div>
  );
}
