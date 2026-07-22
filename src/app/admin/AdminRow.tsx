"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type G = { id: number; name: string; active: boolean; quota: number; memberCount: number };

export function AdminRow({ group }: { group: G }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    await fetch(`/api/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !group.active }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`"${group.name}" 스터디를 삭제할까요? 되돌릴 수 없어요.`)) return;
    setBusy(true);
    await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card flex items-center justify-between p-4">
      <Link href={`/groups/${group.id}`} className="min-w-0">
        <div className="truncate font-medium hover:underline">
          {group.name}
          {!group.active && <span className="ml-2 text-xs text-secondary">비활성</span>}
        </div>
        <div className="text-xs text-secondary">
          #{group.id} · 멤버 {group.memberCount}명 · 주 {group.quota}솔
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        <button
          onClick={toggleActive}
          disabled={busy}
          className="rounded-full border px-2.5 py-0.5 hover:bg-[var(--surface-2)]"
          style={{ borderColor: "var(--border)" }}
        >
          {group.active ? "비활성화" : "활성화"}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-full px-2.5 py-0.5 text-white"
          style={{ background: "var(--danger)" }}
        >
          삭제
        </button>
      </div>
    </div>
  );
}
