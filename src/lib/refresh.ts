import { and, eq, isNotNull, lt, or, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchRecentAcSubmissions } from "@/lib/leetcode";
import { appendSubmissionEvent, ensureTransaction, submissionEventKey } from "@/lib/ledger";

/** LeetCode 최근 Accepted 를 폴링해 solveLogs 에 upsert. 새로 넣은 개수 반환. */
export async function refreshLeetcode(userId: number, handle: string): Promise<number> {
  const subs = await fetchRecentAcSubmissions(handle, 20);
  let inserted = 0;
  for (const s of subs) {
    const acceptedAt = new Date(s.timestamp * 1000);
    const result = await ensureTransaction((tx) =>
      appendSubmissionEvent(tx, {
        userId,
        platform: "LEETCODE",
        problemSlug: s.problemSlug,
        problemTitle: s.problemTitle,
        acceptedAt,
        source: "CRON",
        verificationLevel: "SERVER_VERIFIED",
        eventKey: submissionEventKey({ userId, platform: "LEETCODE", problemSlug: s.problemSlug, acceptedAt, source: "CRON" }),
      }),
    );
    if (result.isNew) inserted++;
  }
  await db.update(schema.users).set({ leetcodeSyncedAt: new Date() }).where(eq(schema.users.id, userId));
  return inserted;
}

const THROTTLE_MS = 3 * 60 * 1000;

/**
 * 최근에 동기화하지 않았을 때만 폴링 (페이지 로드마다 LeetCode 를 때리지 않도록).
 * 실패해도 페이지 렌더를 막지 않게 호출부에서 try/catch 로 감쌀 것.
 */
export async function maybeRefreshLeetcode(userId: number): Promise<void> {
  const [u] = await db
    .select({ handle: schema.users.leetcodeHandle, syncedAt: schema.users.leetcodeSyncedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!u?.handle) return;
  if (u.syncedAt && Date.now() - u.syncedAt.getTime() < THROTTLE_MS) return;
  await refreshLeetcode(userId, u.handle);
}

/** 동시성 제한 실행기 */
async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]).catch(() => {});
    }
  });
  await Promise.all(workers);
}

const GROUP_THROTTLE_MS = 2 * 60 * 1000;

/**
 * 그룹의 모든 멤버(LeetCode 핸들 보유) 중 최근에 동기화되지 않은 사람을 폴링.
 * 확장을 안 쓰는 멤버의 풀이도 대시보드 열 때 반영되게 한다. 실패는 무시.
 */
export async function maybeRefreshGroupMembers(groupId: number): Promise<void> {
  const cutoff = new Date(Date.now() - GROUP_THROTTLE_MS);
  const stale = await db
    .select({ id: schema.users.id, handle: schema.users.leetcodeHandle })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(
      and(
        eq(schema.memberships.groupId, groupId),
        isNotNull(schema.users.leetcodeHandle),
        or(isNull(schema.users.leetcodeSyncedAt), lt(schema.users.leetcodeSyncedAt, cutoff)),
      ),
    );
  if (stale.length === 0) return;
  await runLimited(stale, 4, async (m) => {
    if (m.handle) await refreshLeetcode(m.id, m.handle);
  });
}
