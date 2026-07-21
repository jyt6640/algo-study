import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  serial,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["OWNER", "MEMBER"]);
export const penaltyTypeEnum = pgEnum("penalty_type", ["FIXED", "PER_MISSING"]);
export const solveSourceEnum = pgEnum("solve_source", ["LEETCODE_GQL", "EXTENSION", "MANUAL"]);
export const platformEnum = pgEnum("platform", ["LEETCODE", "PROGRAMMERS"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    githubId: text("github_id"), // GitHub OAuth 고유 id (로그인 사용자)
    nickname: text("nickname").notNull(),
    name: text("name"),
    image: text("image"),
    email: text("email"),
    leetcodeHandle: text("leetcode_handle"),
    programmersHandle: text("programmers_handle"),
    leetcodeSyncedAt: timestamp("leetcode_synced_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("Asia/Seoul"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_github_id_uq").on(t.githubId)],
);

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  quota: integer("quota").notNull().default(7),
  penaltyType: penaltyTypeEnum("penalty_type").notNull().default("FIXED"),
  penaltyAmount: integer("penalty_amount").notNull().default(10000),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  // 벌금 정산 계좌 (방장이 등록, 멤버에게 표시. 실제 송금은 오프라인)
  accountBank: text("account_bank"),
  accountNumber: text("account_number"),
  accountHolder: text("account_holder"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("MEMBER"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("membership_user_group_uq").on(t.userId, t.groupId)],
);

// 두 경로(폴링/확장)에서 정규화되어 적재되는 원천 데이터
export const solveLogs = pgTable(
  "solve_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull().default("LEETCODE"),
    problemSlug: text("problem_slug").notNull(),
    problemTitle: text("problem_title"),
    difficulty: text("difficulty"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    source: solveSourceEnum("source").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 같은 유저의 같은 문제는 1솔 (플랫폼별로 구분)
    uniqueIndex("solve_user_platform_slug_uq").on(t.userId, t.platform, t.problemSlug),
    index("solve_user_accepted_idx").on(t.userId, t.acceptedAt),
  ],
);

// 확장 push 로 들어온 실제 코드 (solveLog 당 1개, 재업로드 시 갱신)
export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    solveLogId: integer("solve_log_id")
      .notNull()
      .references(() => solveLogs.id, { onDelete: "cascade" }),
    language: text("language"),
    code: text("code").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("submissions_solve_uq").on(t.solveLogId)],
);

// 확장 <-> 계정 연동 토큰 (해시 저장)
export const extensionTokens = pgTable(
  "extension_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("ext_token_hash_uq").on(t.tokenHash)],
);

// 마감 배치가 확정하는 주간 결과
export const weeklyResults = pgTable(
  "weekly_results",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    weekOf: text("week_of").notNull(), // 주 시작일 YYYY-MM-DD (그룹 타임존 기준)
    solvedCount: integer("solved_count").notNull(),
    metQuota: boolean("met_quota").notNull(),
    penaltyAmount: integer("penalty_amount").notNull().default(0),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_user_group_week_uq").on(t.userId, t.groupId, t.weekOf)],
);
