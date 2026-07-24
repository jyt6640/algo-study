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
export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const penaltyTypeEnum = pgEnum("penalty_type", ["FIXED", "PER_MISSING"]);
export const solveSourceEnum = pgEnum("solve_source", ["LEETCODE_GQL", "EXTENSION", "MANUAL"]);
// BOOK = 책·기타(직접 입력) — 온라인 저지가 아닌 문제를 손으로 기입할 때 사용
export const platformEnum = pgEnum("platform", ["LEETCODE", "PROGRAMMERS", "BOOK"]);
export const verificationLevelEnum = pgEnum("verification_level", [
  "SERVER_VERIFIED",
  "EXTENSION_VERIFIED",
  "IMPORTED",
  "MANUAL_PENDING",
  "LEGACY",
]);
export const ledgerSourceEnum = pgEnum("ledger_source", ["CRON", "EXTENSION", "IMPORT", "MANUAL", "LEGACY"]);
export const membershipEventTypeEnum = pgEnum("membership_event_type", ["JOINED", "LEFT", "KICKED", "PAUSED", "RESUMED"]);
export const periodStatusEnum = pgEnum("period_status", ["OPEN", "FINALIZING", "FINALIZED"]);
export const periodResultActionTypeEnum = pgEnum("period_result_action_type", [
  "CORRECTED",
  "EXEMPTED",
  "PAID",
  "UNPAID",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    githubId: text("github_id"), // GitHub OAuth 고유 id (로그인 사용자)
    role: userRoleEnum("role").notNull().default("USER"),
    nickname: text("nickname").notNull(),
    name: text("name"),
    image: text("image"),
    email: text("email"),
    leetcodeHandle: text("leetcode_handle"),
    programmersHandle: text("programmers_handle"),
    leetcodeSyncedAt: timestamp("leetcode_synced_at", { withTimezone: true }),
    githubToken: text("github_token"), // GitHub OAuth access token (레포 연동용)
    githubLogin: text("github_login"),
    timezone: text("timezone").notNull().default("Asia/Seoul"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_github_id_uq").on(t.githubId)],
);

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  quota: integer("quota").notNull().default(7), // 기간당 목표 문제 수
  periodDays: integer("period_days").notNull().default(7), // 목표 주기(일)
  startDate: text("start_date"), // 스터디 시작일 YYYY-MM-DD (그룹 tz). null=legacy 주단위
  endDate: text("end_date"), // 스터디 종료일 YYYY-MM-DD (포함). null=무기한
  active: boolean("active").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  penaltyType: penaltyTypeEnum("penalty_type").notNull().default("FIXED"),
  penaltyAmount: integer("penalty_amount").notNull().default(10000),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  // 벌금 정산 계좌 (방장이 등록, 멤버에게 표시. 실제 송금은 오프라인)
  accountBank: text("account_bank"),
  accountNumber: text("account_number"),
  accountHolder: text("account_holder"),
  // 리마인더·마감 알림을 보낼 Discord 웹훅 (방장이 등록)
  discordWebhook: text("discord_webhook"),
  // 연동된 GitHub 풀이 레포 ("owner/repo")
  githubRepo: text("github_repo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupGithubInstallations = pgTable(
  "group_github_installations",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull(),
    repositoryId: text("repository_id").notNull(),
    repositoryFullName: text("repository_full_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("group_github_installations_group_uq").on(t.groupId)],
);

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
    // 직접 기입(책 등)한 문제의 본문. 온라인 저지 문제는 보통 비어 있다.
    description: text("description"),
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
    // 방장이 면제 처리하면 벌금 의무 없음 (카운트가 부당할 때 보정)
    exempt: boolean("exempt").notNull().default(false),
    // 벌금 납부 추적
    paid: boolean("paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_user_group_week_uq").on(t.userId, t.groupId, t.weekOf)],
);

export const submissionEvents = pgTable(
  "submission_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    problemSlug: text("problem_slug").notNull(),
    problemTitle: text("problem_title"),
    difficulty: text("difficulty"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    source: ledgerSourceEnum("source").notNull(),
    verificationLevel: verificationLevelEnum("verification_level").notNull(),
    providerSubmissionId: text("provider_submission_id"),
    eventKey: text("event_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("submission_events_event_key_uq").on(t.eventKey),
    index("submission_events_user_time_idx").on(t.userId, t.acceptedAt),
    index("submission_events_problem_idx").on(t.userId, t.platform, t.problemSlug),
  ],
);

export const submissionCodeVersions = pgTable(
  "submission_code_versions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => submissionEvents.id, { onDelete: "cascade" }),
    language: text("language"),
    code: text("code").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submission_code_versions_event_idx").on(t.eventId, t.createdAt)],
);

// 취소(삭제)된 풀이 — 자동 재수집(cron 폴링/대량 import)으로 되살아나지 않게 막는 제외 목록.
// 사용자가 직접(수동 입력/실시간 재풀이) 등록하면 해제된다.
export const excludedSolves = pgTable(
  "excluded_solves",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    problemSlug: text("problem_slug").notNull(),
    reason: text("reason"),
    excludedBy: integer("excluded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("excluded_solve_user_platform_slug_uq").on(t.userId, t.platform, t.problemSlug)],
);

// 문제별 "치팅 의심" 신고 (멤버가 다른 사람의 풀이를 신고)
export const cheatReports = pgTable(
  "cheat_reports",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    solveLogId: integer("solve_log_id")
      .notNull()
      .references(() => solveLogs.id, { onDelete: "cascade" }),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 한 사람은 한 풀이를 한 번만 신고
    uniqueIndex("cheat_report_solve_reporter_uq").on(t.solveLogId, t.reporterId),
    index("cheat_report_group_idx").on(t.groupId),
  ],
);

export const membershipEvents = pgTable(
  "membership_events",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: membershipEventTypeEnum("type").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("membership_events_group_user_time_idx").on(t.groupId, t.userId, t.effectiveAt)],
);

export const studyPeriods = pgTable(
  "study_periods",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    periodOf: text("period_of").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: periodStatusEnum("status").notNull().default("OPEN"),
    quota: integer("quota").notNull(),
    penaltyType: penaltyTypeEnum("penalty_type").notNull(),
    penaltyAmount: integer("penalty_amount").notNull(),
    timezone: text("timezone").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("study_periods_group_period_uq").on(t.groupId, t.periodOf)],
);

export const periodParticipants = pgTable(
  "period_participants",
  {
    id: serial("id").primaryKey(),
    periodId: integer("period_id")
      .notNull()
      .references(() => studyPeriods.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("period_participants_period_user_uq").on(t.periodId, t.userId)],
);

export const periodResults = pgTable(
  "period_results",
  {
    id: serial("id").primaryKey(),
    periodId: integer("period_id")
      .notNull()
      .references(() => studyPeriods.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    solvedCount: integer("solved_count").notNull(),
    metQuota: boolean("met_quota").notNull(),
    penaltyAmount: integer("penalty_amount").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("period_results_period_user_uq").on(t.periodId, t.userId)],
);

export const periodResultActions = pgTable(
  "period_result_actions",
  {
    id: serial("id").primaryKey(),
    periodResultId: integer("period_result_id")
      .notNull()
      .references(() => periodResults.id, { onDelete: "cascade" }),
    type: periodResultActionTypeEnum("type").notNull(),
    solvedCount: integer("solved_count"),
    penaltyAmount: integer("penalty_amount"),
    reason: text("reason").notNull(),
    actorUserId: integer("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("period_result_actions_result_time_idx").on(t.periodResultId, t.createdAt)],
);
