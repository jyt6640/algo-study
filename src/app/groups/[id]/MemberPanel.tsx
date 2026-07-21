"use client";

import { useEffect, useState } from "react";

export function MemberPanel({ groupId }: { groupId: number }) {
  const [uid, setUid] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState("");

  useEffect(() => {
    setUid(localStorage.getItem(`algostudy_uid_${groupId}`));
    setApiBase(window.location.origin);
  }, [groupId]);

  async function issueToken() {
    if (!uid) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(uid) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "발급 실패");
      setToken(data.token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-lg font-semibold">확장프로그램 연동</h2>
      {!uid ? (
        <p className="mt-2 text-sm text-neutral-400">
          이 그룹의 멤버로 인식되지 않아요. 이 브라우저에서 그룹을 만들거나 참여한 뒤에 토큰을 발급할 수 있어요.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-400">
            LeetCode 문제 페이지에서 코드를 자동 업로드하려면, 아래 토큰을 확장 팝업에 붙여넣으세요.
          </p>
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}

          {!token ? (
            <button
              onClick={issueToken}
              disabled={busy}
              className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              내 연동 토큰 발급
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <Field label="API 주소" value={apiBase} onCopy={copy} />
              <Field label="연동 토큰 (지금만 표시됨)" value={token} onCopy={copy} mono />
              <p className="text-xs text-neutral-500">
                토큰은 지금 화면에서만 확인할 수 있어요. 잃어버리면 다시 발급하면 됩니다.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Field({
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
      <div className="mb-1 text-xs text-neutral-400">{label}</div>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className={`w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm ${
            mono ? "font-mono" : ""
          }`}
        />
        <button
          onClick={() => onCopy(value)}
          className="shrink-0 rounded-lg border border-neutral-700 px-3 text-sm hover:bg-neutral-800"
        >
          복사
        </button>
      </div>
    </div>
  );
}
