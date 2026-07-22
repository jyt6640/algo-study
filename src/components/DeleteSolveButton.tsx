"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteSolveButton({
  groupId,
  solveId,
  label = "이 풀이 취소",
  confirmText = "이 풀이를 취소(삭제)할까요? 연결된 코드도 함께 삭제됩니다.",
  redirectTo,
  variant = "subtle",
}: {
  groupId: number;
  solveId: number;
  label?: string;
  confirmText?: string;
  redirectTo?: string; // 지정 시 삭제 후 이동, 아니면 router.refresh()
  variant?: "subtle" | "danger";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (busy) return;
    if (!confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/solves/${solveId}`, { method: "DELETE" });
      if (res.ok) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "삭제에 실패했어요.");
        setBusy(false);
      }
    } catch {
      alert("네트워크 오류로 삭제하지 못했어요.");
      setBusy(false);
    }
  }

  const style =
    variant === "danger"
      ? { background: "var(--danger)", color: "#fff", borderColor: "transparent" as const }
      : { background: "transparent", color: "var(--danger)", borderColor: "var(--border)" };

  return (
    <button
      onClick={del}
      disabled={busy}
      className="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
      style={{ ...style, opacity: busy ? 0.6 : 1 }}
    >
      {busy ? "삭제 중…" : label}
    </button>
  );
}
