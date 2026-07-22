"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  name: string;
  active: boolean;
  quota: number;
  periodDays: number;
  startDate: string;
  endDate: string;
  penaltyType: "FIXED" | "PER_MISSING";
  penaltyAmount: number;
  accountBank: string;
  accountNumber: string;
  accountHolder: string;
  discordWebhook: string;
};

export function SettingsForm({ groupId, initial }: { groupId: number; initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMsg({ ok: true, text: "저장했어요 ✓" });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "오류" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <section className="card p-6">
        <h2 className="text-lg font-semibold">기본</h2>
        <div className="mt-4 grid gap-3">
          <div>
            <label className="field-label">스터디 이름</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <label className="flex items-center justify-between rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
            <span className="text-sm">
              <b>활성화</b>{" "}
              <span className="text-secondary">
                — 끄면 둘러보기에서 숨겨지고 주간 마감·리마인더가 멈춰요 (일시정지)
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">주기(일)</label>
              <input
                className="input"
                type="number"
                min={1}
                value={form.periodDays}
                onChange={(e) => set("periodDays", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="field-label">목표(문제)</label>
              <input
                className="input"
                type="number"
                min={1}
                value={form.quota}
                onChange={(e) => set("quota", Number(e.target.value))}
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-secondary">
            예: 7일에 7문제 / 1일에 1문제 / 3일에 5문제. 7일·시작일 미지정이면 매주 월~일 기준.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">시작일 (선택)</label>
              <input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div>
              <label className="field-label">종료일 (선택)</label>
              <input className="input" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">벌금 방식</label>
              <select
                className="input"
                value={form.penaltyType}
                onChange={(e) => set("penaltyType", e.target.value as Initial["penaltyType"])}
              >
                <option value="FIXED">미달 시 고정</option>
                <option value="PER_MISSING">부족 문제당</option>
              </select>
            </div>
            <div>
              <label className="field-label">금액(원)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={form.penaltyAmount}
                onChange={(e) => set("penaltyAmount", Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">정산 계좌</h2>
        <p className="mt-1 text-sm text-secondary">
          벌금을 모을 계좌예요. 멤버에게 장부와 함께 표시됩니다. 실제 송금은 오프라인으로 진행돼요.
        </p>
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">은행</label>
              <input
                className="input"
                value={form.accountBank}
                onChange={(e) => set("accountBank", e.target.value)}
                placeholder="카카오뱅크"
              />
            </div>
            <div>
              <label className="field-label">예금주</label>
              <input
                className="input"
                value={form.accountHolder}
                onChange={(e) => set("accountHolder", e.target.value)}
                placeholder="홍길동"
              />
            </div>
          </div>
          <div>
            <label className="field-label">계좌번호</label>
            <input
              className="input"
              value={form.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              placeholder="3333-01-1234567"
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">알림 (Discord)</h2>
        <p className="mt-1 text-sm text-secondary">
          웹훅 URL을 넣으면 마감 결과와 리마인더(D-1)를 이 채널로 보내요. Discord 채널 설정 → 연동 →
          웹후크에서 생성.
        </p>
        <input
          className="input mt-3"
          value={form.discordWebhook}
          onChange={(e) => set("discordWebhook", e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
        />
      </section>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
        {msg && (
          <span className="text-sm" style={{ color: msg.ok ? "var(--success)" : "var(--danger)" }}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
