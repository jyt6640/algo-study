"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeaveButton({
  groupId,
  variant = "link",
}: {
  groupId: number;
  variant?: "link" | "button";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (
      !confirm(
        "이 스터디에서 나갈까요?\n다음 기간부터 집계에서 제외되고, 이미 확정된 벌금은 장부에 남습니다.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
      if (res.ok) {
        router.push("/");
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "나가기에 실패했어요.");
        setBusy(false);
      }
    } catch {
      alert("네트워크 오류로 나가지 못했어요.");
      setBusy(false);
    }
  }

  if (variant === "button") {
    return (
      <button
        onClick={leave}
        disabled={busy}
        className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium"
        style={{ borderColor: "var(--border)", color: "var(--danger)", opacity: busy ? 0.6 : 1 }}
      >
        {busy ? "나가는 중…" : "스터디 나가기"}
      </button>
    );
  }

  return (
    <button onClick={leave} disabled={busy} className="text-secondary hover:underline">
      {busy ? "나가는 중…" : "나가기"}
    </button>
  );
}
