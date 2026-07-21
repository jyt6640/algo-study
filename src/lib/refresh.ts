import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchRecentAcSubmissions } from "@/lib/leetcode";

/** LeetCode 최근 Accepted 를 폴링해 solveLogs 에 upsert. 새로 넣은 개수 반환. */
export async function refreshLeetcode(userId: number, handle: string): Promise<number> {
  const subs = await fetchRecentAcSubmissions(handle, 20);
  let inserted = 0;
  for (const s of subs) {
    const res = await db
      .insert(schema.solveLogs)
      .values({
        userId,
        platform: "LEETCODE",
        problemSlug: s.problemSlug,
        problemTitle: s.problemTitle,
        acceptedAt: new Date(s.timestamp * 1000),
        source: "LEETCODE_GQL",
      })
      .onConflictDoNothing({
        target: [schema.solveLogs.userId, schema.solveLogs.platform, schema.solveLogs.problemSlug],
      })
      .returning({ id: schema.solveLogs.id });
    if (res.length) inserted++;
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
