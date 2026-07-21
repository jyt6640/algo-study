"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const card = "rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6";
const input =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-emerald-500";
const label = "mb-1 block text-xs font-medium text-neutral-400";
const btn =
  "rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:opacity-50";

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
          ownerNickname: form.get("nickname"),
          leetcodeHandle: form.get("handle") || undefined,
          penaltyType: form.get("penaltyType"),
          penaltyAmount: Number(form.get("penaltyAmount")),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      localStorage.setItem(`algostudy_uid_${data.group.id}`, String(data.userId));
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
        body: JSON.stringify({
          inviteCode: form.get("inviteCode"),
          nickname: form.get("nickname"),
          leetcodeHandle: form.get("handle") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "가입 실패");
      localStorage.setItem(`algostudy_uid_${data.groupId}`, String(data.userId));
      router.push(`/groups/${data.groupId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
      setBusy(false);
    }
  }

  return (
    <>
      {err && <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{err}</p>}

      <form action={createGroup} className={card}>
        <h2 className="mb-4 text-lg font-semibold">스터디 만들기</h2>
        <div className="grid gap-3">
          <div>
            <label className={label}>스터디 이름</label>
            <input name="name" required className={input} placeholder="알고리즘 뿌시기" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>내 닉네임</label>
              <input name="nickname" required className={input} placeholder="영태" />
            </div>
            <div>
              <label className={label}>LeetCode 핸들</label>
              <input name="handle" className={input} placeholder="leetcode_id" />
            </div>
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
      </form>

      <form action={joinGroup} className={card}>
        <h2 className="mb-4 text-lg font-semibold">초대코드로 참여</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>초대코드</label>
            <input name="inviteCode" required className={`${input} uppercase`} placeholder="AB2C9X" />
          </div>
          <div>
            <label className={label}>닉네임</label>
            <input name="nickname" required className={input} placeholder="영태" />
          </div>
          <div>
            <label className={label}>LeetCode 핸들</label>
            <input name="handle" className={input} placeholder="leetcode_id" />
          </div>
        </div>
        <button className={`${btn} mt-4`} disabled={busy}>
          참여하기
        </button>
      </form>
    </>
  );
}
