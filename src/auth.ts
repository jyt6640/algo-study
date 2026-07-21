import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fetchUserProfile } from "@/lib/leetcode";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [GitHub],
  callbacks: {
    // 로그인 시 우리 users 테이블에 upsert 하고, DB user id 를 토큰에 담는다.
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const githubId = String(profile.id);
        const login = (profile.login as string) || "";
        const nickname = login || (profile.name as string) || "user";

        const existing = await db
          .select({ id: schema.users.id, handle: schema.users.leetcodeHandle })
          .from(schema.users)
          .where(eq(schema.users.githubId, githubId))
          .limit(1);

        let dbUserId: number;
        let currentHandle: string | null = null;

        if (existing.length) {
          dbUserId = existing[0].id;
          currentHandle = existing[0].handle;
          await db
            .update(schema.users)
            .set({
              name: (profile.name as string) ?? null,
              image: (profile.avatar_url as string) ?? null,
              email: (profile.email as string) ?? null,
            })
            .where(eq(schema.users.id, dbUserId));
        } else {
          const [created] = await db
            .insert(schema.users)
            .values({
              githubId,
              nickname,
              name: (profile.name as string) ?? null,
              image: (profile.avatar_url as string) ?? null,
              email: (profile.email as string) ?? null,
            })
            .returning({ id: schema.users.id });
          dbUserId = created.id;
        }
        token.dbUserId = dbUserId;

        // 아직 LeetCode 미연동이면 GitHub 아이디로 자동 추측 연동 (같은 아이디가 많음).
        // 틀리면 /me 에서 바꿀 수 있다.
        if (!currentHandle && login) {
          const guess = await fetchUserProfile(login).catch(() => null);
          if (guess) {
            await db
              .update(schema.users)
              .set({ leetcodeHandle: guess.username })
              .where(eq(schema.users.id, dbUserId));
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.dbUserId) {
        session.user.id = String(token.dbUserId);
      }
      return session;
    },
  },
});
