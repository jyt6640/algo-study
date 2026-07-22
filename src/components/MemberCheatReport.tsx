"use client";

import { useState } from "react";

type SolveOpt = { id: number; label: string };

export function MemberCheatReport({
  groupId,
  nickname,
  solves,
  reportedSolveIds,
}: {
  groupId: number;
  nickname: string;
  solves: SolveOpt[];
  reportedSolveIds: number[]; // 내가 이미 신고한 풀이(취소용). 남에겐 절대 노출 안 됨.
}) {
  const [open, setOpen] = useState(false);
  const [solveLogId, setSolveLogId] = useState<number | "">(solves[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<number[]>(reportedSolveIds);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labelOf = (id: number) => solves.find((s) => s.id === id)?.label ?? `#${id}`;

  async function report() {
    if (busy || solveLogId === "") return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solveLogId, reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMine((m) => (m.includes(Number(solveLogId)) ? m : [...m, Number(solveLogId)]));
        setReason("");
        setMsg("익명으로 신고됐어요.");
      } else {
        setError(data.error || "신고에 실패했어요.");
      }
    } catch {
      setError("네트워크 오류로 신고하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/report`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solveLogId: id }),
      });
      if (res.ok) {
        setMine((m) => m.filter((x) => x !== id));
        setMsg("신고를 취소했어요.");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "취소에 실패했어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (solves.length === 0) return null;

  // 버튼은 신고 여부와 무관하게 항상 중립("🚩 신고") — 신고 흔적을 노출하지 않는다.
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors"
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        title={`${nickname}의 풀이를 치팅 의심 신고 (익명)`}
      >
        🚩 신고
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border p-4 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-sm font-semibold">치팅 의심 신고</div>
          <p className="mt-0.5 text-xs text-secondary">
            신고는 <b>익명</b>이에요. 방장만 검토용으로 확인하고, 다른 멤버·본인에게는 신고 여부가 보이지 않아요.
          </p>

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

          {msg && <p className="mt-2 text-xs" style={{ color: "var(--success)" }}>{msg}</p>}
          {error && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              닫기
            </button>
            <button
              onClick={report}
              disabled={busy || solveLogId === ""}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--danger)", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "처리 중…" : "익명 신고"}
            </button>
          </div>

          {mine.length > 0 && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-medium text-secondary">내가 신고한 문제 (나만 보임)</div>
              <div className="mt-1.5 space-y-1.5">
                {mine.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{labelOf(id)}</span>
                    <button
                      onClick={() => cancel(id)}
                      disabled={busy}
                      className="shrink-0 rounded-full border px-2 py-0.5 hover:bg-[var(--surface-2)]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      신고 취소
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
