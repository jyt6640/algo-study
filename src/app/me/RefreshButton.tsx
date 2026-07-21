"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "실패");
      setMsg(d.inserted > 0 ? `${d.inserted}문제 새로 반영됐어요` : "이미 최신이에요");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-secondary">{msg}</span>}
      <button onClick={refresh} disabled={busy} className="btn btn-secondary !px-4 !py-1.5 text-sm">
        {busy ? "가져오는 중…" : "LeetCode 풀이 새로고침"}
      </button>
    </div>
  );
}
