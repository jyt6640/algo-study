"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Entry = {
  id: number;
  nickname: string;
  solvedCount: number;
  metQuota: boolean;
  penaltyAmount: number;
  exempt: boolean;
  paid: boolean;
};

export function LedgerEntry({
  groupId,
  entry,
  quota,
  isOwner,
}: {
  groupId: number;
  entry: Entry;
  quota: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: { paid?: boolean; exempt?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: entry.id, ...body }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const owes = !entry.metQuota && !entry.exempt && entry.penaltyAmount > 0;

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>
        {entry.nickname}{" "}
        <span className="text-secondary">
          ({entry.solvedCount}/{quota})
        </span>
      </span>

      <div className="flex items-center gap-2">
        {entry.metQuota ? (
          <span style={{ color: "var(--success)" }}>✓ 달성</span>
        ) : entry.exempt ? (
          <span className="text-secondary">면제</span>
        ) : (
          <span
            className="tabular-nums"
            style={{ color: entry.paid ? "var(--success)" : "var(--warning)" }}
          >
            {entry.penaltyAmount.toLocaleString()}원 {entry.paid ? "· 납부" : "· 미납"}
          </span>
        )}

        {isOwner && owes && (
          <button
            onClick={() => patch({ paid: !entry.paid })}
            disabled={busy}
            className="rounded-full border px-2 py-0.5 text-xs hover:bg-[var(--surface-2)]"
            style={{ borderColor: "var(--border)" }}
          >
            {entry.paid ? "미납으로" : "납부 처리"}
          </button>
        )}
        {isOwner && !entry.metQuota && (
          <button
            onClick={() => patch({ exempt: !entry.exempt })}
            disabled={busy}
            className="rounded-full border px-2 py-0.5 text-xs hover:bg-[var(--surface-2)]"
            style={{ borderColor: "var(--border)" }}
          >
            {entry.exempt ? "면제 해제" : "면제"}
          </button>
        )}
      </div>
    </div>
  );
}
