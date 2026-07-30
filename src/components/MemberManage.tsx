"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { userId: number; nickname: string; role: string };

/** 방장·관리자용 멤버 방출 목록 */
export function MemberManage({ groupId, members }: { groupId: number; members: Member[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function kick(userId: number, nickname: string) {
    if (!confirm(`${nickname} 님을 스터디에서 방출할까요?\n(이번 기간까지의 기록·벌금은 장부에 남습니다)`)) return;
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "방출에 실패했어요.");
      }
    } catch {
      setError("네트워크 오류로 방출하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.userId} className="card flex items-center justify-between gap-3 p-4 text-sm">
            <span className="flex items-center gap-2 font-medium">
              {m.nickname}
              {m.role === "OWNER" && <span className="accent text-xs">방장</span>}
            </span>
            {m.role === "OWNER" ? (
              <span className="text-xs text-secondary">방출할 수 없어요</span>
            ) : (
              <button
                onClick={() => kick(m.userId, m.nickname)}
                disabled={busyId === m.userId}
                className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium"
                style={{ borderColor: "var(--border)", color: "var(--danger)" }}
              >
                {busyId === m.userId ? "처리 중…" : "방출"}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
