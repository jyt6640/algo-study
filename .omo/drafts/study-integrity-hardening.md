---
slug: study-integrity-hardening
status: planned-awaiting-execution
intent: clear
review_required: false
pending-action: await explicit implementation start; do not use subagents
approach: Preserve all legacy records; harden access and inputs first; migrate to append-only submission events and snapshot-based period finalization through dual write/read before retiring no legacy tables.
---

# Draft: study-integrity-hardening

## Components (topology ledger)
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| ACCESS | Group members cannot view a non-member's solves, profile, or code through global IDs. | active | `src/app/groups/[id]/members/[uid]/page.tsx:27-49`; `src/app/groups/[id]/solve/[solveId]/page.tsx:31-55` |
| EXTENSION | Manual LeetCode code upload never dereferences an absent accepted-submit capture. | active | `extension/content.js:113-149`; user stack trace `content.js:141` |
| INGEST | All token-authenticated ingestion inputs are bounded, typed, auditable, and carry a verification state. | active | `src/app/api/ingest/route.ts:28-100`; `src/app/api/ingest/bulk/route.ts:23-100` |
| LEDGER | Existing solves, code, payments, exemptions, and weekly results survive a migration to append-only events. | active | `src/db/schema.ts:61-155`; `src/app/api/import/leetcode/route.ts:15-74` |
| PERIODS | A period snapshots members and rules, finalizes atomically, and is retry-safe. | active | `src/app/api/cron/finalize/route.ts:22-95`; `src/lib/week.ts:89-131` |
| AUTH | Admin identity and GitHub repository access no longer depend on broad login scopes or a nickname. | active | `src/auth.ts:10-58`; `src/lib/admin.ts:5-24` |
| OPS | CI proves server and extension behavior; documentation describes the shipped product. | active | `.github/workflows/*.yml`; `README.md:80-121`; `vercel.json:3-11` |
| DISCORD | Webhook alarms and their SSRF hardening are not changed in this request. | deferred | User direction: "디스코드 알람은 아직 빼고" |

## Open assumptions (announced defaults)
<!-- assumption | adopted default | rationale | reversible? -->
| Data preservation | Add-only migration, legacy tables retained read-only after dual-read parity; no existing row deletion. Direct group deletion becomes archival. | User requires no data loss. | yes |
| Legacy history | Backfill one `LEGACY` event per existing `solve_logs` row and preserve only the currently stored code. | Earlier re-submissions/code versions were never persisted. | no historical recovery possible |
| Legacy rollback | Legacy rows remain an evidence/fallback projection only. `LEDGER_READ_MODE=legacy|compare|events` permits rollback for legacy-representable views, but post-cutover re-solves exist only in the event ledger and are never discarded to simulate a rollback. | The legacy unique key cannot represent later re-solves. | yes |
| Existing settlement records | Preserve `weekly_results`, `paid`, `paidAt`, `exempt`, and `finalizedAt`; do not silently recompute old penalties. | Historical money records must be auditable. | yes |
| Transaction runtime | Replace the current `drizzle-orm/neon-http` runtime connection with `drizzle-orm/neon-serverless` and a Neon WebSocket pool for all writer/finalizer transactions. | Drizzle documents HTTP as non-interactive and WebSockets for interactive transactions. | yes |
| Verification and time | Count only `SERVER_VERIFIED` and `EXTENSION_VERIFIED` accepted events in an open period. External provider time is authoritative when present; otherwise the server receipt time is stored. `IMPORTED` is visible history but does not alter an open/finalized fine, and `MANUAL_PENDING` cannot count until owner-approved correction. Manual code entry attaches code only. | A browser timestamp or imported historical solve is not server proof. | yes |
| Pause and lifecycle | A group pause/resume is group-wide and effective from the following period; current-period participants still finalize. Join is next-period effective and leave is end-of-current-period effective. | Owner-approved policy extended to the existing group-level pause model. | yes |
| Admin bootstrap | `ADMIN_GITHUB_ID` is a numeric immutable GitHub ID. It grants bootstrap administration without nickname matching; persisted role grants are append-only/audited and are not automatically revoked when the environment value changes. | Avoids mutable-login authorization and accidental lockout. | yes |
| Discord | Do not remove, redesign, or add webhook behavior in this work. | Explicit scope exclusion. | yes |
| Test strategy | Add DB-backed integration tests for migration/finalization plus route tests; retain existing unit tests. | Current suite is utility/extension-only. | yes |

## Findings (cited - path:lines)

- Cross-group profile/code IDOR is confirmed in `src/app/groups/[id]/members/[uid]/page.tsx:27-49` and `src/app/groups/[id]/solve/[solveId]/page.tsx:31-55`.
- `solve_logs` is unique by `(user, platform, slug)` and `submissions` by `solveLogId`, so accepted-event and code history are lossy: `src/db/schema.ts:77-114`.
- Finalization treats a period as complete if any result row exists, processes members outside a transaction, and reads current membership/rules: `src/app/api/cron/finalize/route.ts:22-95`.
- GitHub login requests `repo workflow` and stores the OAuth token in plaintext: `src/auth.ts:10-58`; `src/db/schema.ts:22-31`.
- Admin authorization is nickname-based with a hardcoded login: `src/lib/admin.ts:5-24`.
- No DB/API integration harness exists; current tests are `src/lib/*.test.ts` and `extension/*.test.js`.
- Release workflows package/publish but do not run test/build or verify tag and manifest version parity: `.github/workflows/publish-extension.yml`, `.github/workflows/release-extension.yml`.
- LeetCode manual upload throws when polling detects an accepted result without an intercepted submission because `extension/content.js:141` reads `lastAccepted.at` while it is null; the exact expression reproduces twice and optional chaining removes the throw.

## Decisions (with rationale)

- Accepted 2026-07-22: solve history remains global per user; group membership and period eligibility determine whether a solve counts in a group.
- Accepted 2026-07-22: the same problem counts once per period, not once ever.
- Accepted 2026-07-22: join and pauses apply from the next period; a leave remains accountable through the current period.
- Accepted 2026-07-22: a finalized period is immutable; late verified submissions require a versioned owner correction rather than rewriting the prior result.
- Accepted 2026-07-22: historical imports are visible but cannot change an open or finalized fine without a versioned owner correction; pending/manual code never creates an accepted solve.
- Accepted 2026-07-22: group deletion is archival, and group-wide pause/resume takes effect from the next period.

## Scope IN

- Create GitHub issues for every active component after plan approval.
- Fix the verified LeetCode manual-upload null-state bug and lock it with an extension regression test.
- Fix access control and introduce regression tests.
- Add Zod-backed ingestion boundaries and explicit verification/source fields.
- Add zero-loss event/period/membership-history schema, backfill, transaction-backed dual write/read parity, and retry-safe finalization.
- Replace broad GitHub login/repository authority with separate least-privilege integration and immutable admin bootstrap.
- Add CI gates and align product/API documentation to shipped behavior.

## Scope OUT (Must NOT have)

- Discord webhook/notification changes.
- Deleting legacy records or silently recalculating historic settlement outcomes.
- Payment processing, automatic transfers, AI review, social features, or additional platforms.

## Open questions

None. Owner approved all recommended defaults on 2026-07-22.

## Approval gate
status: plan approved
The owner approved the recommended policy defaults. The plan will create one GitHub issue per active component, then implement in the dependency order ACCESS/INGEST/EXTENSION/OPS -> LEDGER -> PERIODS/READS/AUTH -> operational cutover. Implementation starts only when the owner explicitly starts work; the owner also requested that no subagents be used.
