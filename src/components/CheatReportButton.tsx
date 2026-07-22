"use client";

import { useState } from "react";

export function CheatReportButton({
  groupId,
  solveLogId,
  initialReported,
  initialCount,
  showCount,
  canReport,
}: {
  groupId: number;
  solveLogId: number;
  initialReported: boolean;
  initialCount: number;
  showCount: boolean; // 방장/관리자만 신고 수 노출
  canReport: boolean; // 본인 풀이면 false
}) {
  const [reported, setReported] = useState(initialReported);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !reported;
    try {
      const res = await fetch(`/api/groups/${groupId}/report`, {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solveLogId }),
      });
      if (res.ok) {
        setReported(next);
        setCount((c) => Math.max(0, c + (next ? 1 : -1)));
      }
    } finally {
      setBusy(false);
    }
  }

  // 본인 풀이: 신고 불가. 방장/관리자면 신고 수만 표시.
  if (!canReport) {
    if (showCount && count > 0) {
      return (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)" }}
          title={`${count}명이 치팅 의심 신고`}
        >
          🚩 {count}
        </span>
      );
    }
    return null;
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
      style={
        reported
          ? { background: "color-mix(in srgb, var(--danger) 18%, transparent)", color: "var(--danger)" }
          : { background: "var(--surface-2)", color: "var(--text-secondary)" }
      }
      title={reported ? "신고 취소" : "이 풀이를 치팅으로 의심 신고"}
    >
      🚩{reported ? " 신고함" : " 의심"}
      {showCount && count > 0 ? ` ${count}` : ""}
    </button>
  );
}
