import type { LeetCodeFullProfile } from "@/lib/leetcode";
import { Heatmap } from "./Heatmap";

export function ProfileCard({
  profile,
  showHeatmap = true,
}: {
  profile: LeetCodeFullProfile;
  showHeatmap?: boolean;
}) {
  return (
    <section className="card p-6">
      <div className="flex items-center gap-4">
        {profile.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar} alt="" className="h-14 w-14 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            <a
              href={`https://leetcode.com/u/${profile.username}/`}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              @{profile.username}
            </a>
            {profile.realName ? <span className="text-secondary"> · {profile.realName}</span> : null}
          </div>
          <div className="text-sm text-secondary">
            {profile.ranking ? `랭킹 ${profile.ranking.toLocaleString()} · ` : ""}
            {profile.solved.all.toLocaleString()}문제 해결
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        <Stat label="전체" value={profile.solved.all} />
        <Stat label="Easy" value={profile.solved.easy} color="var(--success)" />
        <Stat label="Medium" value={profile.solved.medium} color="var(--warning)" />
        <Stat label="Hard" value={profile.solved.hard} color="var(--danger)" />
        <Stat label="연속" value={profile.streak} suffix="일" />
        <Stat label="활동일" value={profile.totalActiveDays} suffix="일" />
      </div>

      {showHeatmap && (
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold">잔디밭 🌱</div>
          <Heatmap calendar={profile.calendar} />
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: number;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl p-2" style={{ background: "var(--surface-2)" }}>
      <div className="text-lg font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value.toLocaleString()}
        {suffix ? <span className="text-xs font-normal text-secondary">{suffix}</span> : null}
      </div>
      <div className="text-xs text-secondary">{label}</div>
    </div>
  );
}
