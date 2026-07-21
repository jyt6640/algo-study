"use client";

// LeetCode 제출 캘린더를 GitHub 잔디처럼 렌더. 셀에 마우스를 올리면 그 날 제출 수를 툴팁으로 표시.
// calendar: unix초(UTC 자정) -> 그 날의 제출 수.

import { useRef, useState } from "react";

const DAY = 86400000;
const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;

function grassVar(count: number): string {
  if (count <= 0) return "var(--grass-0)";
  if (count <= 2) return "var(--grass-1)";
  if (count <= 5) return "var(--grass-2)";
  if (count <= 9) return "var(--grass-3)";
  return "var(--grass-4)";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Hover = { x: number; y: number; label: string } | null;
type Breakdown = Record<string, { leetcode: number; programmers: number }>;

export function Heatmap({
  calendar,
  breakdown,
}: {
  calendar: Record<string, number>;
  breakdown?: Breakdown;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dow = new Date(todayUTC).getUTCDay();
  const sundayThisWeek = todayUTC - dow * DAY;
  const weeks = 53;
  const start = sundayThisWeek - (weeks - 1) * 7 * DAY;

  const topPad = 16;
  const width = weeks * STEP;
  const height = topPad + 7 * STEP;

  const cells: React.ReactNode[] = [];
  const monthLabels: React.ReactNode[] = [];
  let lastMonth = -1;
  let total = 0;

  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7; r++) {
      const dayMs = start + (c * 7 + r) * DAY;
      if (dayMs > todayUTC) continue;
      const key = Math.floor(dayMs / 1000);
      const count = calendar[key] ?? 0;
      total += count;
      const cx = c * STEP;
      const cy = topPad + r * STEP;
      const d = new Date(dayMs);
      const b = breakdown?.[String(key)];
      const label = b
        ? `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 · 리트코드 ${b.leetcode} · 프로그래머스 ${b.programmers}`
        : `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 · ${count > 0 ? `${count}회 제출` : "제출 없음"}`;
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={cx}
          y={cy}
          width={CELL}
          height={CELL}
          rx={2.5}
          fill={grassVar(count)}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => {
            const el = scrollRef.current;
            const sl = el?.scrollLeft ?? 0;
            const cw = el?.clientWidth ?? width;
            const px = cx + CELL / 2 - sl; // 가로 스크롤 보정
            setHover({ x: Math.min(Math.max(px, 46), cw - 46), y: cy, label });
          }}
          onMouseLeave={() => setHover(null)}
        />,
      );
    }
    const firstOfCol = new Date(start + c * 7 * DAY);
    const m = firstOfCol.getUTCMonth();
    if (m !== lastMonth) {
      lastMonth = m;
      monthLabels.push(
        <text key={`m-${c}`} x={c * STEP} y={10} fontSize={9} fill="var(--text-secondary)">
          {MONTHS[m]}
        </text>,
      );
    }
  }

  return (
    <div>
      {/* 바깥 래퍼: overflow 없음 → 툴팁이 안 잘림 */}
      <div className="relative" style={{ paddingTop: 26 }}>
        <div ref={scrollRef} className="overflow-x-auto pb-1">
          <svg width={width} height={height} role="img" aria-label="LeetCode 제출 잔디">
            {monthLabels}
            {cells}
          </svg>
        </div>
        {hover && (
          <div
            className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium"
            style={{
              left: hover.x,
              top: hover.y + 26, // 래퍼 paddingTop 만큼 보정 (셀 위에 표시)
              transform: "translate(-50%, calc(-100% - 6px))",
              background: "var(--text)",
              color: "var(--bg)",
              boxShadow: "var(--shadow)",
            }}
          >
            {hover.label}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-secondary">
        <span>최근 1년 {total.toLocaleString()}회 제출</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 3, 6, 10].map((n) => (
            <span
              key={n}
              style={{ width: 11, height: 11, borderRadius: 2.5, background: grassVar(n), display: "inline-block" }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
