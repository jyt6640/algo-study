import Link from "next/link";
import { fmtPeriodRange } from "@/lib/format";

/** 지난 기간 기록을 다시 보기 위한 이동 바 */
export function PeriodNav({
  groupId,
  offset,
  periodOf,
  periodDays,
  canGoBack,
}: {
  groupId: number;
  offset: number;
  periodOf: string;
  periodDays: number;
  canGoBack: boolean;
}) {
  const href = (o: number) => (o === 0 ? `/groups/${groupId}` : `/groups/${groupId}?offset=${o}`);
  const isCurrent = offset === 0;

  const btn = "rounded-full border px-3 py-1.5 text-xs font-medium";
  const btnStyle = { borderColor: "var(--border)", color: "var(--text-secondary)" };

  return (
    <div
      className="mt-6 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
      style={{
        background: isCurrent ? "var(--surface-2)" : "color-mix(in srgb, var(--accent) 10%, transparent)",
      }}
    >
      {canGoBack ? (
        <Link href={href(offset - 1)} className={btn} style={btnStyle}>
          ← 이전 기간
        </Link>
      ) : (
        <span className={btn} style={{ ...btnStyle, opacity: 0.4 }}>
          ← 이전 기간
        </span>
      )}

      <div className="min-w-0 text-center">
        <div className="text-sm font-semibold">{fmtPeriodRange(periodOf, periodDays)}</div>
        <div className="text-[11px] text-secondary">{isCurrent ? "이번 기간" : "지난 기록 보는 중"}</div>
      </div>

      {isCurrent ? (
        <span className={btn} style={{ ...btnStyle, opacity: 0.4 }}>
          다음 기간 →
        </span>
      ) : (
        <div className="flex gap-1.5">
          <Link href={href(offset + 1)} className={btn} style={btnStyle}>
            다음 →
          </Link>
          <Link
            href={href(0)}
            className={btn}
            style={{ borderColor: "transparent", background: "var(--accent)", color: "#fff" }}
          >
            이번 기간
          </Link>
        </div>
      )}
    </div>
  );
}
