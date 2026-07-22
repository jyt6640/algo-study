"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeaveButton({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (!confirm("이 스터디에서 나갈까요?")) return;
    setBusy(true);
    const res = await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
    if (res.ok) router.push("/");
    else setBusy(false);
  }

  return (
    <button onClick={leave} disabled={busy} className="text-secondary hover:underline">
      나가기
    </button>
  );
}
