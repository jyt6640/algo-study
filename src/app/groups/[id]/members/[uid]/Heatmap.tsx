// LeetCode 제출 캘린더를 GitHub 잔디처럼 렌더 (서버 컴포넌트, SVG).
// calendar: unix초(UTC 자정) -> 그 날의 제출 수.

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

export function Heatmap({ calendar }: { calendar: Record<string, number> }) {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dow = new Date(todayUTC).getUTCDay(); // 0=일
  const sundayThisWeek = todayUTC - dow * DAY;
  const weeks = 53;
  const start = sundayThisWeek - (weeks - 1) * 7 * DAY;

  const topPad = 16;
  const leftPad = 0;
  const width = leftPad + weeks * STEP;
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
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={leftPad + c * STEP}
          y={topPad + r * STEP}
          width={CELL}
          height={CELL}
          rx={2.5}
          fill={grassVar(count)}
        >
          <title>{`${new Date(dayMs).toISOString().slice(0, 10)}: ${count} submissions`}</title>
        </rect>,
      );
    }
    // 그 주 첫 날(일요일)의 달이 바뀌면 상단에 월 라벨
    const firstOfCol = new Date(start + c * 7 * DAY);
    const m = firstOfCol.getUTCMonth();
    if (m !== lastMonth) {
      lastMonth = m;
      monthLabels.push(
        <text key={`m-${c}`} x={leftPad + c * STEP} y={10} fontSize={9} fill="var(--text-secondary)">
          {MONTHS[m]}
        </text>,
      );
    }
  }

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <svg width={width} height={height} role="img" aria-label="LeetCode 제출 잔디">
          {monthLabels}
          {cells}
        </svg>
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
