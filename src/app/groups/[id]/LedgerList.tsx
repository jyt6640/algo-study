"use client";

import { useState } from "react";
import { LedgerEntry } from "./LedgerEntry";
import { fmtPeriodRange } from "@/lib/format";

type Entry = {
  id: number;
  weekOf: string;
  nickname: string;
  solvedCount: number;
  metQuota: boolean;
  penaltyAmount: number;
  exempt: boolean;
  paid: boolean;
};

const PAGE = 4; // 한 번에 더 볼 기간 수

/**
 * 기간이 쌓여도 페이지가 길어지지 않게:
 *  - 최근 기간만 펼치고 나머지는 접어둠 (요약만 표시)
 *  - "이전 기간 더 보기"로 조금씩 로드
 *  - 미납만 보기 필터
 */
export function LedgerList({
  groupId,
  entries,
  quota,
  periodDays,
  isOwner,
  hasMore,
  periodLimit,
}: {
  groupId: number;
  entries: Entry[];
  quota: number;
  periodDays: number;
  isOwner: boolean;
  /** 서버가 읽어온 기간 범위 밖에 더 오래된 기록이 있는지 */
  hasMore?: boolean;
  periodLimit?: number;
}) {
  const [visible, setVisible] = useState(PAGE);
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  // 기간별 묶기 (entries 는 최신순으로 들어온다)
  const byPeriod = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!byPeriod.has(e.weekOf)) byPeriod.set(e.weekOf, []);
    byPeriod.get(e.weekOf)!.push(e);
  }
  let periods = [...byPeriod.entries()];

  if (unpaidOnly) {
    periods = periods
      .map(([week, list]) => [week, list.filter((e) => !e.exempt && !e.paid && e.penaltyAmount > 0)] as const)
      .filter(([, list]) => list.length > 0)
      .map(([week, list]) => [week, [...list]] as [string, Entry[]]);
  }

  const shown = periods.slice(0, visible);
  const remaining = periods.length - shown.length;

  const summary = (list: Entry[]) => {
    const owed = list.filter((e) => !e.exempt && e.penaltyAmount > 0);
    const unpaid = owed.filter((e) => !e.paid).reduce((s, e) => s + e.penaltyAmount, 0);
    const total = owed.reduce((s, e) => s + e.penaltyAmount, 0);
    return { unpaid, total, count: owed.length };
  };

  if (periods.length === 0) {
    return (
      <p className="mt-4 text-sm text-secondary">
        {unpaidOnly ? (
          <>
            미납 항목이 없어요.{" "}
            <button onClick={() => setUnpaidOnly(false)} className="accent hover:underline">
              전체 보기
            </button>
          </>
        ) : (
          "아직 마감된 기간이 없어요."
        )}
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-secondary">
          {periods.length}개 기간 · 최근순
        </span>
        <button
          onClick={() => {
            setUnpaidOnly((v) => !v);
            setVisible(PAGE);
          }}
          className="rounded-full border px-2.5 py-1 text-xs font-medium"
          style={
            unpaidOnly
              ? { borderColor: "transparent", background: "color-mix(in srgb, var(--warning) 16%, transparent)", color: "var(--warning)" }
              : { borderColor: "var(--border)", color: "var(--text-secondary)" }
          }
        >
          {unpaidOnly ? "미납만 보는 중" : "미납만 보기"}
        </button>
      </div>

      <div className="space-y-2">
        {shown.map(([week, list], index) => {
          const s = summary(list);
          return (
            <details key={week} className="card p-0" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <span className="text-sm font-semibold">{fmtPeriodRange(week, periodDays)}</span>
                <span className="flex items-center gap-2 text-xs">
                  {s.unpaid > 0 ? (
                    <span style={{ color: "var(--warning)" }}>미납 {s.unpaid.toLocaleString()}원</span>
                  ) : s.total > 0 ? (
                    <span style={{ color: "var(--success)" }}>정산 완료</span>
                  ) : (
                    <span className="text-secondary">전원 달성</span>
                  )}
                  <span className="text-secondary">{list.length}명</span>
                </span>
              </summary>
              <div className="space-y-2 border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
                {list.map((e) => (
                  <LedgerEntry key={e.id} groupId={groupId} entry={e} quota={quota} isOwner={isOwner} />
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setVisible((v) => v + PAGE)}
          className="btn btn-secondary mt-3 w-full !py-2 text-sm"
        >
          이전 기간 더 보기 ({remaining}개 남음)
        </button>
      )}

      {hasMore && remaining === 0 && (
        <p className="mt-3 text-center text-xs text-secondary">
          최근 {periodLimit ?? shown.length}개 기간만 표시합니다. 위 합계는 전체 기간 기준이에요.
        </p>
      )}
    </div>
  );
}
