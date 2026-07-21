"use client";

import { useEffect, useState } from "react";
import { LeetCodeLink } from "@/components/LeetCodeLink";

export function MemberPanel({ viewerId }: { groupId?: number; viewerId: number }) {
  return (
    <>
      <LeetCodeLink />
      <ExtensionLink userId={viewerId} />
    </>
  );
}

function ExtensionLink({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiBase, setApiBase] = useState("");

  useEffect(() => {
    setApiBase(window.location.origin);
  }, []);

  async function issueToken() {
    setBusy(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (res.ok) setToken(d.token);
    } finally {
      setBusy(false);
    }
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <section className="card mt-6 p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold">확장프로그램으로 코드까지 올리기 (선택)</h2>
        <span className="text-secondary">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm text-secondary">
          <p>
            핸들 연동만으로도 풀이 개수는 자동 집계돼요. <b style={{ color: "var(--text)" }}>실제 제출 코드까지</b>{" "}
            스터디에 남기고 싶으면 확장을 설치하세요.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <code className="text-secondary">chrome://extensions</code> → 개발자 모드 → 압축해제된
              확장 로드 → <code>extension/</code> 폴더
            </li>
            <li>확장 팝업에 아래 API 주소와 연동 토큰 입력</li>
            <li>LeetCode 문제 페이지에서 Accepted 후 「📤 스터디 업로드」 클릭</li>
          </ol>

          {!token ? (
            <button onClick={issueToken} disabled={busy} className="btn btn-secondary !px-4 !py-1.5">
              {busy ? "발급 중…" : "연동 토큰 발급"}
            </button>
          ) : (
            <div className="space-y-2">
              <TokenField label="API 주소" value={apiBase} onCopy={copy} />
              <TokenField label="연동 토큰 (지금만 표시)" value={token} onCopy={copy} mono />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TokenField({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  onCopy: (t: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-secondary">{label}</div>
      <div className="flex gap-2">
        <input readOnly value={value} className={`input ${mono ? "font-mono" : ""}`} />
        <button onClick={() => onCopy(value)} className="btn btn-secondary shrink-0 !px-4 !py-2">
          복사
        </button>
      </div>
    </div>
  );
}
