"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiscoverJoin({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    if (res.ok) router.push(`/groups/${groupId}`);
    else setBusy(false);
  }

  return (
    <button
      onClick={join}
      disabled={busy}
      className="btn btn-primary shrink-0 !px-4 !py-1.5 text-sm"
      onMouseDown={(e) => e.preventDefault()}
    >
      {busy ? "참여 중…" : "참여"}
    </button>
  );
}
