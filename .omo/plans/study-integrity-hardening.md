# study-integrity-hardening - Work Plan

## TL;DR (For humans)
**What you'll get:** Existing study records stay intact while new submissions become traceable events, group data is access-controlled, and period results become retry-safe, auditable snapshots. The extension no longer crashes when a previously accepted LeetCode problem is uploaded manually; login receives only identity permissions and repository automation moves behind a separately configured GitHub App.

**Why this approach:** It fixes data disclosure and unsafe writes first, then migrates with old and new records side by side so no existing solves, code, payments, exemptions, or finalized results are lost. Before the ledger writers run, it switches the database runtime from non-interactive Neon HTTP to the transactional Neon WebSocket driver. The settled policies make period counting predictable: global history, one recognition per period, next-period join/pause, and immutable closeout with corrections.

**What it will NOT do:** It will not change Discord alarms, delete legacy data, add payment automation, or enable GitHub repository automation before its separate App configuration exists.

**Effort:** XL
**Risk:** High - it changes the authoritative data and authorization paths, so every migration step is parity-checked and reversible.
**Decisions to sanity-check:** The owner-approved period rules above; GitHub App setup remains an external prerequisite.

Your next move: start implementation, or request a high-accuracy plan review first. Full execution detail follows below.

---

> TL;DR (machine): XL/high-risk zero-loss migration: access isolation, typed ingestion, event/period ledger dual-write cutover, least-privilege GitHub authority, CI/docs; Discord excluded.

## Scope
### Must have

- Preserve all existing `solve_logs`, `submissions`, `memberships`, and `weekly_results` records; no destructive migration or silent historic recomputation.
- Prevent cross-group profile, solve, and code disclosure.
- Introduce append-only accepted-submission events and snapshot-based study periods with transactional dual-write, staged dual-read parity, and retained legacy evidence.
- Apply the approved rules: global user history; one problem counts once per period; join/pause effective next period; leave effective after the current period; finalization immutable with versioned owner corrections.
- Harden API input boundaries and distinguish verification levels without trusting a client timestamp as server proof. Count only provider/server-verified events, not historical imports or pending/manual code.
- Separate ordinary GitHub login from repository automation, use immutable admin identity, add CI, and update shipped documentation.
- Create a GitHub issue for each active component and link commits/PRs to those issues.

### Must NOT have (guardrails, anti-slop, scope boundaries)

- Do not alter Discord webhook/notification behavior, settings, schemas, or delivery semantics.
- Do not delete legacy data, backfill imagined historical re-submissions, overwrite existing paid/exempt/finalized values, or offer an irreversible group delete; archive groups instead.
- Do not add payment processing, automatic transfers, AI review, social features, or a new coding platform.
- Do not activate GitHub repository automation until a user-created GitHub App is configured with selected-repository permissions.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD with Vitest. Add `TEST_DATABASE_URL`-backed migration and route integration tests against a disposable PostgreSQL database, with a CI PostgreSQL service; retain extension VM tests.
- Evidence: `.omo/evidence/task-<N>-study-integrity-hardening.md`.
- Baseline and final commands: `npm test`, `npm run build`, `node --check extension/background.js`, `node --check extension/bridge.js`, `npm run ext:package`, and `git diff --check`.
- Database parity evidence must compare row counts and immutable fields from legacy and new tables before switching reads. `LEDGER_READ_MODE` defaults to `legacy`, then moves to `compare`; production can use `events` only after a zero-mismatch report is stored.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

- Wave 1: create issues, access control, input/cron hardening, and CI foundation.
- Wave 2: schema/migration foundation, legacy backfill, and ingestion dual-write.
- Wave 3: period snapshots/finalization, dashboard cutover, and GitHub/App authentication split.
- Wave 4: documentation alignment, migration parity, release validation, and final audits.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | issue traceability | 2, 3, 4 |
| 2 | none | safe group reads | 3, 4, 5 |
| 3 | none | trusted event ingestion | 2, 4 |
| 4 | none | CI guardrails | 2, 3 |
| 5 | none | stable extension releases | 2, 3, 4 |
| 6 | 3 | 7, 8, 9, 10 | 5 |
| 7 | 6 | 8, 9 | none |
| 8 | 6, 7 | 9, 11 | none |
| 9 | 6, 7, 8 | 11 | none |
| 10 | 4, 6 | 11 | none |
| 11 | 2, 3, 4, 5, 6, 7, 8, 9, 10 | completion | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Create a traceable GitHub hardening backlog
  What to do / Must NOT do: Create exactly seven issues titled `Access isolation`, `Ingestion integrity`, `Extension reliability`, `Event migration`, `Period finalization`, `Auth authority`, and `CI/documentation`. Each issue must state the accepted policies, exact paths, acceptance criteria, dependencies, and its closing commit/PR references. Do not create Discord work or duplicate issues.
  Parallelization: Wave 1 | Blocked by: none | Blocks: release traceability
  References (executor has NO interview context - be exhaustive): `.omo/drafts/study-integrity-hardening.md`; `src/db/schema.ts:61-155`; `src/app/api/cron/finalize/route.ts:22-95`; GitHub repository `jyt6640/algo-study`.
  Acceptance criteria (agent-executable): `gh issue list --state open --limit 20 --json number,title,body` contains exactly one issue for each component with links between dependent issues.
  QA scenarios (name the exact tool + invocation): happy: `gh issue view <number>` verifies body; failure: rerun issue discovery and confirm no pre-existing duplicate title. Evidence `.omo/evidence/task-1-study-integrity-hardening.md`.
  Commit: N | GitHub issue records only

- [ ] 2. Enforce group-scoped visibility for member and solve reads
  What to do / Must NOT do: Add one reusable membership-aware query/guard and use it in the member profile and solve detail pages; query target membership with the requested group before exposing profile, solve, submission, or code. Preserve the approved global user-history model for valid members; do not add `groupId` to legacy solve rows in this task.
  Parallelization: Wave 1 | Blocked by: none | Blocks: safe dashboard cutover
  References (executor has NO interview context - be exhaustive): `src/lib/membership.ts`; `src/app/groups/[id]/members/[uid]/page.tsx:27-58`; `src/app/groups/[id]/solve/[solveId]/page.tsx:24-55`; `src/app/api/solves/[solveId]/submission/route.ts:43-62`.
  Acceptance criteria (agent-executable): tests prove a member can read same-group data, a member cannot read a non-member profile/solve/code by global ID, and owner-only code edits remain unchanged.
  QA scenarios (name the exact tool + invocation): create `src/app/groups/access-control.integration.test.ts`; run `TEST_DATABASE_URL=... npm run test:db -- src/app/groups/access-control.integration.test.ts`. Seed two groups/three users: same-group member page/solve returns 200; a viewer in group A requesting group B member/solve returns 404 and exposes neither code nor title. Use Playwright at `http://localhost:3000/groups/<A>/members/<B-user>` and `/solve/<B-solve>` to observe the same 404. Evidence `.omo/evidence/task-2-study-integrity-hardening.md`.
  Commit: Y | `fix(access): scope member and solution visibility to group membership`

- [ ] 3. Add typed ingestion boundaries and verification provenance
  What to do / Must NOT do: Define Zod schemas shared by single, bulk, bridge-import, handle-link, and group-setting non-Discord inputs. Enforce: title ≤240 chars, difficulty/language ≤80, platform ≤32, slug ≤300, code ≤200,000 UTF-16 chars, one request ≤1 MiB UTF-8, and bulk ≤100 items; malformed shape/time gets deterministic `400`, a decoded body over limit gets `413`. Add provider/source event identity: `(platform, providerSubmissionId)` where available, else a stable server-computed SHA-256 of `(user, platform, slug, externalAcceptedAt|receivedAt, source)`; never use a browser-supplied identifier as proof. Map paths exactly: server collection with provider ID/time → `SERVER_VERIFIED`; intercepted accepted response with provider ID/time → `EXTENSION_VERIFIED`; bridge/bulk historic import → `IMPORTED`; any future manual acceptance → `MANUAL_PENDING`; manual code entry attaches only to an existing event. Preserve accepted payload compatibility where safe; do not claim client-provided data is server verified, let imported/pending events change fines, or change Discord handling.
  Parallelization: Wave 1 | Blocked by: none | Blocks: event writers
  References (executor has NO interview context - be exhaustive): `src/app/api/ingest/route.ts:28-100`; `src/app/api/ingest/bulk/route.ts:23-100`; `src/app/api/import/leetcode/route.ts:15-74`; `src/app/api/link/route.ts:11-43`; `src/lib/manualSubmission.ts`; `package.json` Zod dependency.
  Acceptance criteria (agent-executable): invalid dates, oversized or mistyped fields, >100 items/>1 MiB bodies, and invalid handles return deterministic 400/413 responses; valid extension/server/import/manual cases carry the expected verification level and timestamp source.
  QA scenarios (name the exact tool + invocation): create `src/app/api/ingest/ingestion-validation.integration.test.ts`; run `TEST_DATABASE_URL=... npm run test:db -- src/app/api/ingest/ingestion-validation.integration.test.ts`. Exercise valid server/extension/import/manual-code paths plus invalid timestamp/101-item/oversize-code/1-MiB-plus cases; assert 400/413, event ID provenance, verification level, and counted/not-counted status. Evidence `.omo/evidence/task-3-study-integrity-hardening.md`.
  Commit: Y | `fix(ingest): validate payloads and record verification provenance`

- [ ] 4. Establish CI gates and safe extension release checks
  What to do / Must NOT do: Add a push/PR workflow with a PostgreSQL service that installs dependencies, runs unit/DB tests and build, and syntax-checks extension scripts. Add `test:db` and migration-test setup/teardown scripts that require `TEST_DATABASE_URL`; generate and commit `drizzle/` migrations, and prohibit production `db:push` in the deployment documentation/workflow. Update tag release/publish workflows to run those checks, assert `ext-vX.Y.Z` equals `extension/manifest.json` version, package without test/source artifacts that should not ship, and fail before release/upload on mismatch. Do not alter Discord or force-publish Chrome Web Store releases.
  Parallelization: Wave 1 | Blocked by: none | Blocks: reliable releases
  References (executor has NO interview context - be exhaustive): `package.json:scripts`; `vitest.config.ts`; `extension/manifest.json`; `.github/workflows/release-extension.yml`; `.github/workflows/publish-extension.yml`.
  Acceptance criteria (agent-executable): CI workflow triggers on push/PR; tag workflow fails on version mismatch and succeeds with the current manifest; ZIP contains runtime extension files and excludes test files/OS metadata.
  QA scenarios (name the exact tool + invocation): `npm test`; `TEST_DATABASE_URL=postgres://... npm run test:db`; `npm run build`; `npm run ext:package`; `unzip -l <generated-zip>`; and a checked-in `scripts/verify-extension-release.mjs` invoked with matching/mismatching `GITHUB_REF_NAME=refs/tags/ext-v<manifest-version>`. Evidence `.omo/evidence/task-4-study-integrity-hardening.md`.
  Commit: Y | `ci: verify application and extension releases`

- [ ] 5. Fix manual LeetCode upload when polling has no intercepted Accepted event
  What to do / Must NOT do: In `extension/content.js`, ensure the manual-upload timestamp falls back safely when `isAcceptedRecently()` reports true but `lastAccepted` is still null. Add a VM regression test for this exact state and preserve the existing accepted-interception timestamp path. Do not alter ingestion payload semantics beyond preventing the exception.
  Parallelization: Wave 1 | Blocked by: none | Blocks: stable extension releases
  References (executor has NO interview context - be exhaustive): `extension/content.js:113-149`; user stack trace in `/Users/yongtae/.codex/attachments/9ce28e1a-9b64-42ec-b059-4b2a1955b609/pasted-text.txt`; root-cause evidence in `.omo/drafts/study-integrity-hardening.md`.
  Acceptance criteria (agent-executable): the test is red against `lastAccepted.at`, green with `lastAccepted?.at`; a polling-only accepted upload invokes ingest with an ISO timestamp and no uncaught rejection; intercepted accepted upload retains its interception timestamp.
  QA scenarios (name the exact tool + invocation): `npm test -- extension/content.test.js`; reload the unpacked extension, open a previously accepted LeetCode problem, press `내 LeetCode 코드 가져오기`, and observe one successful upload or an explicit platform/API error but no `content.js:141` TypeError in Chrome DevTools. Evidence `.omo/evidence/task-5-study-integrity-hardening.md`.
  Commit: Y | `fix(extension): handle manual upload without captured acceptance state`

- [ ] 6. Add transactional event, membership-history, and period schemas without deleting legacy data
  What to do / Must NOT do: First replace `src/db/index.ts`'s `drizzle-orm/neon-http` runtime with `drizzle-orm/neon-serverless` plus `@neondatabase/serverless` `Pool` and Node WebSocket support (`ws`, `bufferutil`) so `db.transaction` is real. Follow [Drizzle’s Neon driver guidance](https://orm.drizzle.team/docs/connect-neon): HTTP is for non-interactive queries, WebSocket is required for interactive transaction support. Add generated Drizzle SQL migrations (never production `db:push`) and schema for `submission_events` (source/event key/provider ID/verification/external and received timestamps), immutable code payload/history, membership lifecycle/effective boundaries, group lifecycle/archive events, `study_periods` with rule snapshots, period participants/results/items, append-only `period_result_actions` (`CORRECTED`, `EXEMPTED`, `PAID`, `UNPAID`) and correction reasons/authors/sequences, plus read-mode/parity-run metadata. The effective result is the original finalized result plus corrections in sequence order; payment/exemption state is the latest applicable action and is never updated in place. Keep legacy `solve_logs`, `submissions`, `memberships`, and `weekly_results` intact and readable. Backfill unknown pre-existing membership/rule state as `LEGACY_UNKNOWN`, never fabricate it; snapshot a changed quota/penalty/schedule only for the next newly opened period. Encode approved global history and period eligibility; do not drop unique indexes, erase rows, or make a destructive group-delete writer.
  Parallelization: Wave 2 | Blocked by: 3 | Blocks: 7, 8, 9
  References (executor has NO interview context - be exhaustive): `src/db/schema.ts:61-155`; `drizzle.config.ts`; `src/lib/week.ts:74-131`; approved decisions in `.omo/drafts/study-integrity-hardening.md`.
  Acceptance criteria (agent-executable): migration applies to an existing fixture database without data loss; `db.transaction` rolls back a forced multi-write failure; new constraints permit multiple accepted events for the same problem while retaining idempotency for a known provider submission; legacy tables remain queryable.
  QA scenarios (name the exact tool + invocation): `TEST_DATABASE_URL=... npm run test:db -- migration-foundation`; seed legacy user/solve/code/result, migrate, force rollback, then assert original primary keys/fields survive and new tables are empty before backfill. Evidence `.omo/evidence/task-6-study-integrity-hardening.md`.
  Commit: Y | `feat(ledger): add event and period persistence foundation`

- [ ] 7. Backfill legacy records and dual-write all collection paths transactionally
  What to do / Must NOT do: Use the ordered deployment sequence: (1) expand schema, (2) deploy transactional dual-writers while `LEDGER_READ_MODE=legacy`, (3) capture a write watermark while cron/ingestion continue dual-writing, (4) backfill only records at/before that watermark with persisted checkpoints, (5) run parity, then (6) proceed to `compare`. Convert every legacy solve to one `LEGACY` event and attach only the currently stored code; copy historic weekly result payment/exemption/finalization fields into immutable `LEGACY_UNKNOWN` period records. Update `src/app/api/cron/collect/route.ts`, `src/app/api/ingest/route.ts`, `src/app/api/ingest/bulk/route.ts`, `src/app/api/import/leetcode/route.ts`, `src/lib/refresh.ts`, and `src/app/api/solves/[solveId]/submission/route.ts` to append events and update the legacy projection in one transaction during transition. Update join/leave/kick/group-settings writers (`src/app/api/groups/join/route.ts`, `src/app/api/groups/[id]/leave/route.ts`, `src/app/api/groups/[id]/kick/route.ts`, `src/app/api/groups/[id]/route.ts`) to write lifecycle events transactionally; make delete archive-only. A manual-code action may attach a code version to an existing event but never creates/changes acceptance. `IMPORTED` stays history-only for an open period, and an `EXTENSION_VERIFIED` event uses intercepted provider time or server receipt time if absent. Do not invent missing historical event/code versions, recalculate prior penalties, or promise legacy fallback represents post-cutover re-solves.
  Parallelization: Wave 2 | Blocked by: 6 | Blocks: 8, 9
  References (executor has NO interview context - be exhaustive): `src/lib/refresh.ts`; `src/app/api/cron/collect/route.ts:24-49`; `src/app/api/ingest/route.ts:43-100`; `src/app/api/ingest/bulk/route.ts:33-100`; `src/app/api/import/leetcode/route.ts:24-74`; `src/app/api/solves/[solveId]/submission/route.ts:43-62`.
  Acceptance criteria (agent-executable): rerunning backfill leaves counts unchanged; every legacy solve has one `LEGACY` event; existing current code and all weekly payment/exemption fields remain exactly preserved; dual-write retry does not duplicate one provider event.
  QA scenarios (name the exact tool + invocation): `TEST_DATABASE_URL=... npm run test:db -- ledger-backfill`; cover parity, source retry, code overwrite compatibility, imported-no-fine, and forced transaction failure rollback. Evidence `.omo/evidence/task-7-study-integrity-hardening.md`.
  Commit: Y | `feat(ledger): backfill legacy solves and dual-write submission events`

- [ ] 8. Finalize snapshot-based periods atomically with immutable corrections
  What to do / Must NOT do: Replace “any weekly result means done” with an `OPEN → FINALIZING → FINALIZED` locked period state machine inside the transactional writer. Materialize the approved participant and group-rule snapshots; apply group-wide pause/resume from the next period, join from the next period, leave through the current period, and count each `(platform, problem)` at most once from `SERVER_VERIFIED`/`EXTENSION_VERIFIED` events in the period. Write all results in one transaction; after it commits, call the existing `sendDiscord` path unchanged. Implement append-only owner correction records with before/after count and penalty, reason, author, created-at, and sequence; do not mutate the original finalized result. Correct custom final-period end boundaries. Do not invoke Discord before commit, alter Discord delivery/configuration, or silently rewrite a finalized result.
  Parallelization: Wave 3 | Blocked by: 6, 7 | Blocks: 9, 10
  References (executor has NO interview context - be exhaustive): `src/app/api/cron/finalize/route.ts:22-95`; `src/lib/week.ts:89-131`; `src/lib/penalty.ts`; `src/app/api/groups/[id]/results/route.ts:9-43`; approved membership/finalization decisions in `.omo/drafts/study-integrity-hardening.md`.
  Acceptance criteria (agent-executable): concurrent/retried finalization yields exactly one finalized period and one result per participant; a mid-period join is eligible only next period; leaving user remains in the current snapshot; pause/resume applies only next period; late event creates no silent rewrite; a partial final-period boundary excludes post-endDate solves; existing Discord receives at most the unchanged post-commit notification.
  QA scenarios (name the exact tool + invocation): create `src/app/api/cron/period-finalization.integration.test.ts`; run `TEST_DATABASE_URL=... npm run test:db -- src/app/api/cron/period-finalization.integration.test.ts`. Cover forced transaction error, two concurrent calls, Asia/Seoul DST-equivalent timezone boundary, custom end date, join/leave/pause timing, correction/action sequence, retry, and a mocked unchanged `sendDiscord` call after commit only. Evidence `.omo/evidence/task-8-study-integrity-hardening.md`.
  Commit: Y | `feat(ledger): finalize immutable period snapshots atomically`

- [ ] 9. Install staged ledger reads and mismatch diagnostics
  What to do / Must NOT do: Add `LEDGER_READ_MODE=legacy|compare|events`, defaulting to `legacy`. Implement dashboard, activity, member profile, expected penalties, results API, and study-status event/period readers, but in `compare` run both readers and persist structured mismatch diagnostics (group, period, member, old/new value, query version) for operators. Use group membership only for access/eligibility, preserving global history display for authorized current members. Keep legacy views as evidence/fallback and do not remove old tables or make `events` the production default in this task.
  Parallelization: Wave 3 | Blocked by: 6, 7, 8 | Blocks: 10, 11
  References (executor has NO interview context - be exhaustive): `src/app/groups/[id]/page.tsx:61-122`; `src/app/groups/[id]/activity/page.tsx:30-62`; `src/app/groups/[id]/members/[uid]/page.tsx:36-68`; `src/app/api/me/route.ts:32-89`; `src/app/api/groups/[id]/results/route.ts`.
  Acceptance criteria (agent-executable): `legacy` returns legacy projections, `compare` returns legacy projections plus persisted diagnostics, and `events` reads only events; period ledger is immutable after finalization; a mismatch report identifies group/period/member rather than silently choosing a result.
  QA scenarios (name the exact tool + invocation): create `src/lib/ledger/read-mode.integration.test.ts`; run `TEST_DATABASE_URL=... npm run test:db -- src/lib/ledger/read-mode.integration.test.ts`. Seed mismatch and parity fixtures, then assert legacy/compare/events behavior and persisted diagnostics; use Playwright on one authorized group dashboard to observe legacy output in compare mode. Evidence `.omo/evidence/task-9-study-integrity-hardening.md`.
  Commit: Y | `feat(ledger): serve group progress from period snapshots`

- [ ] 10. Reduce GitHub authority and move admin identity to immutable data
  What to do / Must NOT do: Restrict login to identity scopes and stop persisting OAuth access tokens. Introduce explicit GitHub App configuration (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_WEBHOOK_SECRET`) plus selected-existing-repository installation callback/selection routes and persisted `group_github_installations` metadata (installation ID, selected repo ID/full name, enabled state; never an installation token). Request only `Contents: write`, `Workflows: write`, `Issues: write` (label management), and mandatory `Metadata: read`, because existing automation writes `.github/*` files and labels; obtain a one-hour installation token only at execution time and restrict it to the selected repository. GitHub documents that installation tokens may be scoped to selected installation repositories and expire after one hour: [installation token documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app). Remove “create a new repository” mode unless a separate App permission/test is deliberately added. Add `users.role` plus append-only/audited role-grant records; bootstrap admin authorization from numeric `ADMIN_GITHUB_ID`, never nickname/login. Keep prior persisted grants until an explicit audited revocation. Existing repository automation must remain unavailable until valid App credentials and an authorized installation exist. Do not request/persist Discord secrets or a broad OAuth repository token.
  Parallelization: Wave 3 | Blocked by: 4 | Blocks: final release
  References (executor has NO interview context - be exhaustive): `src/auth.ts:7-84`; `src/db/schema.ts:18-35`; `src/lib/admin.ts:5-24`; `src/app/api/groups/[id]/github/route.ts:16-93`; `src/lib/github.ts:1-89`; `.env.example`.
  Acceptance criteria (agent-executable): normal sign-in requests no `repo`/`workflow`; no access token is written to `users`; only the numeric configured admin or explicit audited role grant can use admin-only routes; repository setup rejects missing/invalid App installation, rejects new-repository creation, and accepts an authorized selected repository with mocked App credentials.
  QA scenarios (name the exact tool + invocation): create `src/app/api/groups/github-app.integration.test.ts` and `src/lib/admin.integration.test.ts`; run `TEST_DATABASE_URL=... npm run test:db -- src/app/api/groups/github-app.integration.test.ts src/lib/admin.integration.test.ts`. Assert OAuth scope configuration, absent persisted OAuth token, numeric-admin/non-admin/grant/revocation access, missing App config, invalid webhook/callback state, selected-repository token restriction, and new-repository rejection. Evidence `.omo/evidence/task-10-study-integrity-hardening.md`.
  Commit: Y | `feat(auth): separate GitHub automation authority from login`

- [ ] 11. Publish operational documentation and complete safe cutover
  What to do / Must NOT do: Update README, PRD, extension copy, and screens to describe configurable periods, daily cron reality, token-only extension setup, data verification labels, code visibility, archive-not-delete lifecycle, staged ledger reads, and the GitHub App prerequisite. Run and store a zero-mismatch parity report in `compare` mode before setting production `LEDGER_READ_MODE=events`; if any mismatch exists, retain `legacy`/`compare`, remediate it, and rerun parity. Document the precise rollback: set `LEDGER_READ_MODE=legacy`, redeploy, retain all event writes, and investigate diagnostics rather than deleting events. Do not claim Chrome Web Store publication succeeded unless the workflow result proves it, change Discord documentation beyond marking it out of scope, or claim legacy fallback fully represents post-cutover re-solves.
  Parallelization: Wave 4 | Blocked by: 2, 3, 4, 5, 6, 7, 8, 9, 10 | Blocks: completion
  References (executor has NO interview context - be exhaustive): `README.md:61-121`; `PRD.md`; `src/app/page.tsx:19-23`; `src/app/groups/[id]/PublicStudy.tsx:26-34`; `src/app/groups/[id]/MemberPanel.tsx:75-85`; `extension/content.js:168`; `extension/content-programmers.js:135`; `vercel.json:3-11`.
  Acceptance criteria (agent-executable): repository docs and visible product text no longer promise fixed weekly behavior/API address/hourly polling; production-cutover checklist has a stored zero-mismatch report and rollback procedure; all new environment variables are documented; nonzero mismatch blocks `events` mode.
  QA scenarios (name the exact tool + invocation): `rg -n "API 주소|매시간|고정 주간" README.md PRD.md src extension`; `npm run build`; `npm run test:db -- src/lib/ledger/read-mode.integration.test.ts`; use Playwright to visit home, public study, authorized group and token flows; inspect the CI workflow run plus stored parity artifact. Evidence `.omo/evidence/task-11-study-integrity-hardening.md`.
  Commit: Y | `docs: document verified period ledger operations`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality and authorization review
- [ ] F3. Real browser and database manual QA
- [ ] F4. Migration parity and scope-fidelity audit

## Commit strategy

- Keep issue creation separate from code commits.
- One commit per todo, retaining migration/schema/tests together.
- Do not commit `.omo/` planning/evidence artifacts unless explicitly requested.
- Open a draft PR only after all migration parity and final verification tasks pass.

## Success criteria

- No group member can access a non-member's profile, solve, or code by changing an ID.
- Legacy records are retained and have a documented, verified one-to-one `LEGACY` event mapping.
- New accepted events preserve provenance and re-solves; period counts apply the approved policy exactly once per `(platform, problem)` per period.
- Period finalization is transactional, retry-safe, membership/rule-snapshotted, and immutable except for traceable corrections.
- Login has no broad repository scope/token persistence; GitHub automation needs an explicitly configured selected-repository App installation; admin identity is immutable.
- CI validates test/build/extension package and release tags; deployed product/docs describe actual behavior.
