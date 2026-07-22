"use client";

import { useState } from "react";

type SolveOpt = { id: number; label: string };

export function MemberCheatReport({
  groupId,
  nickname,
  solves,
  alreadyReported,
}: {
  groupId: number;
  nickname: string;
  solves: SolveOpt[];
  alreadyReported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [solveLogId, setSolveLogId] = useState<number | "">(solves[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyReported);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || solveLogId === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solveLogId, reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setOpen(false);
        setReason("");
      } else {
        setError(data.error || "신고에 실패했어요.");
      }
    } catch {
      setError("네트워크 오류로 신고하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (solves.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors"
        style={
          done
            ? { background: "color-mix(in srgb, var(--danger) 16%, transparent)", color: "var(--danger)" }
            : { background: "var(--surface-2)", color: "var(--text-secondary)" }
        }
        title={done ? "이미 신고함 — 추가 신고/수정" : `${nickname}의 풀이를 치팅 의심 신고`}
      >
        🚩 {done ? "신고함" : "신고"}
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border p-4 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-sm font-semibold">치팅 의심 신고</div>
          <p className="mt-0.5 text-xs text-secondary">{nickname}의 어떤 문제인지 선택하고 이유를 적어주세요.</p>

          <label className="mt-3 block text-xs text-secondary">문제</label>
          <select
            value={solveLogId}
            onChange={(e) => setSolveLogId(e.target.value ? Number(e.target.value) : "")}
            className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            {solves.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-xs text-secondary">이유 (선택)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="예: 제출 시간이 비정상적으로 빠름 / 코드가 동일함"
            className="mt-1 w-full resize-none rounded-lg border px-2.5 py-2 text-sm"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />

          {error && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              취소
            </button>
            <button
              onClick={submit}
              disabled={busy || solveLogId === ""}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--danger)", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "신고 중…" : "신고하기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
