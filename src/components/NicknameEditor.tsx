"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// userId 를 주면 관리자가 그 사용자를 변경(관리자 대시보드용).
// 안 주면 본인 닉네임 변경(내 프로필용).
export function NicknameEditor({
  initial,
  userId,
  compact,
}: {
  initial: string;
  userId?: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== initial.trim();

  async function save() {
    const nickname = value.trim();
    if (!nickname || busy || !dirty) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { nickname, userId } : { nickname }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("변경됨 ✓");
        router.refresh();
      } else {
        setError(data.error || "변경에 실패했어요.");
      }
    } catch {
      setError("네트워크 오류로 변경하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-2 sm:flex-row sm:items-center"}>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value.slice(0, 30));
          setMsg(null);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        maxLength={30}
        placeholder="닉네임"
        className={`input ${compact ? "!py-1.5 text-sm" : ""}`}
        style={compact ? { maxWidth: "12rem" } : undefined}
      />
      <button
        onClick={save}
        disabled={busy || !dirty || !value.trim()}
        className={`btn btn-secondary shrink-0 ${compact ? "!px-3 !py-1.5 text-sm" : "!px-4 !py-2"}`}
        style={{ opacity: busy || !dirty || !value.trim() ? 0.5 : 1 }}
      >
        {busy ? "저장 중…" : "저장"}
      </button>
      {msg && <span className="text-xs" style={{ color: "var(--success)" }}>{msg}</span>}
      {error && <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
