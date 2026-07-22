"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ManualCodeEntryProps = {
  readonly solveId: number;
  readonly initialCode?: string;
  readonly initialLanguage?: string | null;
};

function responseError(data: unknown): string {
  if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return "저장에 실패했습니다.";
}

export function ManualCodeEntry({ solveId, initialCode = "", initialLanguage = "" }: ManualCodeEntryProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/solves/${solveId}/submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(data));
      setMessage("저장됐어요.");
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-6 p-6">
      <h2 className="text-lg font-semibold">{initialCode ? "정답 코드 수정" : "정답 코드 직접 저장"}</h2>
      <p className="mt-1 text-sm text-secondary">확장프로그램 없이 코드를 붙여넣어 저장할 수 있어요.</p>
      <form onSubmit={save} className="mt-4 space-y-3">
        <div>
          <label htmlFor="submission-language" className="field-label">
            언어 (선택)
          </label>
          <input
            id="submission-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="input"
            placeholder="예: Java 17"
          />
        </div>
        <div>
          <label htmlFor="submission-code" className="field-label">
            정답 코드
          </label>
          <textarea
            id="submission-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="input min-h-56 resize-y font-mono text-sm leading-relaxed"
            placeholder="여기에 제출한 코드를 붙여넣으세요"
            required
            spellCheck={false}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !code.trim()} className="btn btn-primary">
            {busy ? "저장 중…" : "코드 저장"}
          </button>
          {message && (
            <p role="status" className="text-sm" style={{ color: message === "저장됐어요." ? "var(--success)" : "var(--danger)" }}>
              {message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
