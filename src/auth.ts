import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [GitHub],
  callbacks: {
    // 로그인 시 우리 users 테이블에 upsert 하고, DB user id 를 토큰에 담는다.
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const githubId = String(profile.id);
        const nickname = (profile.login as string) || (profile.name as string) || "user";

        const existing = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.githubId, githubId))
          .limit(1);

        if (existing.length) {
          token.dbUserId = existing[0].id;
          await db
            .update(schema.users)
            .set({
              name: (profile.name as string) ?? null,
              image: (profile.avatar_url as string) ?? null,
              email: (profile.email as string) ?? null,
            })
            .where(eq(schema.users.id, existing[0].id));
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
          token.dbUserId = created.id;
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
