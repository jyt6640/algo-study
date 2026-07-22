"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { userId: number; nickname: string; role: string };

export function GroupAdmin({ groupId, members }: { groupId: number; members: Member[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function kick(userId: number, nickname: string) {
    if (!confirm(`${nickname} 님을 추방할까요?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/groups/${groupId}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("정말 이 스터디를 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    if (res.ok) router.push("/");
    else setBusy(false);
  }

  return (
    <>
      <section className="card p-6">
        <h2 className="text-lg font-semibold">멤버 관리</h2>
        <div className="mt-3 space-y-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between text-sm">
              <span>
                {m.nickname}
                {m.role === "OWNER" && <span className="accent ml-2 text-xs">방장</span>}
              </span>
              {m.role !== "OWNER" && (
                <button
                  onClick={() => kick(m.userId, m.nickname)}
                  disabled={busy}
                  className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--surface-2)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  추방
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))" }}>
        <h2 className="text-lg font-semibold" style={{ color: "var(--danger)" }}>
          스터디 삭제
        </h2>
        <p className="mt-1 text-sm text-secondary">
          모든 멤버십과 벌금 장부가 삭제돼요. 멤버들의 개인 풀이 기록은 유지됩니다.
        </p>
        <button
          onClick={remove}
          disabled={busy}
          className="btn mt-3"
          style={{ background: "var(--danger)", color: "#fff" }}
        >
          스터디 삭제
        </button>
      </section>
    </>
  );
}
