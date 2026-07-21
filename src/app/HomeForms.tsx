"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const card = "card p-6";
const input = "input";
const label = "field-label";
const btn = "btn btn-primary w-full";

export function HomeForms() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createGroup(form: FormData) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          penaltyType: form.get("penaltyType"),
          penaltyAmount: Number(form.get("penaltyAmount")),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      router.push(`/groups/${data.group.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
      setBusy(false);
    }
  }

  async function joinGroup(form: FormData) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: form.get("inviteCode") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "가입 실패");
      router.push(`/groups/${data.groupId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      {err && (
        <p
          className="rounded-xl px-4 py-2 text-sm"
          style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}
        >
          {err}
        </p>
      )}

      <form action={createGroup} className={card}>
        <h2 className="mb-4 text-lg font-semibold">스터디 만들기</h2>
        <div className="grid gap-3">
          <div>
            <label className={label}>스터디 이름</label>
            <input name="name" required className={input} placeholder="알고리즘 뿌시기" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>벌금 방식</label>
              <select name="penaltyType" className={input} defaultValue="FIXED">
                <option value="FIXED">미달 시 고정</option>
                <option value="PER_MISSING">부족 문제당</option>
              </select>
            </div>
            <div>
              <label className={label}>금액(원)</label>
              <input name="penaltyAmount" type="number" defaultValue={10000} className={input} />
            </div>
          </div>
        </div>
        <button className={`${btn} mt-4`} disabled={busy}>
          만들기
        </button>
        <p className="mt-2 text-xs text-secondary">계좌 등록·상세 설정은 만든 뒤 설정에서 할 수 있어요.</p>
      </form>

      <form action={joinGroup} className={card}>
        <h2 className="mb-4 text-lg font-semibold">초대코드로 참여</h2>
        <label className={label}>초대코드</label>
        <div className="flex gap-2">
          <input name="inviteCode" required className={`${input} uppercase`} placeholder="AB2C9X" />
          <button className="btn btn-primary shrink-0" disabled={busy}>
            참여
          </button>
        </div>
      </form>
    </div>
  );
}
