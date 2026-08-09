"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { userId: number; nickname: string; role: string };

/** 방장 위임 — 넘기고 나면 본인은 일반 멤버가 되어 스터디를 나갈 수 있다. */
export function TransferOwner({ groupId, members }: { groupId: number; members: Member[] }) {
  const router = useRouter();
  const candidates = members.filter((m) => m.role !== "OWNER");
  const [target, setTarget] = useState<number | "">(candidates[0]?.userId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transfer() {
    if (target === "" || busy) return;
    const who = candidates.find((c) => c.userId === target)?.nickname ?? "";
    if (!confirm(`${who} 님에게 방장을 넘길까요?\n넘기면 나는 일반 멤버가 되고, 설정·정산 권한을 잃어요.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/groups/${groupId}`);
        router.refresh();
      } else {
        setError(data.error || "위임에 실패했어요.");
        setBusy(false);
      }
    } catch {
      setError("네트워크 오류로 위임하지 못했어요.");
      setBusy(false);
    }
  }

  if (candidates.length === 0) {
    return <p className="mt-1 text-sm text-secondary">위임할 멤버가 없어요. 멤버가 들어오면 넘길 수 있어요.</p>;
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : "")}
          className="input sm:max-w-xs"
        >
          {candidates.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.nickname}
            </option>
          ))}
        </select>
        <button
          onClick={transfer}
          disabled={busy || target === ""}
          className="btn btn-secondary shrink-0 !px-4 !py-2 text-sm"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "위임 중…" : "방장 넘기기"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
