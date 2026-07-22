import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const statements = [
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE user_role AS ENUM ('USER', 'ADMIN'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_source') THEN CREATE TYPE ledger_source AS ENUM ('CRON', 'EXTENSION', 'IMPORT', 'MANUAL', 'LEGACY'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_level') THEN CREATE TYPE verification_level AS ENUM ('SERVER_VERIFIED', 'EXTENSION_VERIFIED', 'IMPORTED', 'MANUAL_PENDING', 'LEGACY'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_event_type') THEN CREATE TYPE membership_event_type AS ENUM ('JOINED', 'LEFT', 'KICKED', 'PAUSED', 'RESUMED'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_status') THEN CREATE TYPE period_status AS ENUM ('OPEN', 'FINALIZING', 'FINALIZED'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_result_action_type') THEN CREATE TYPE period_result_action_type AS ENUM ('CORRECTED', 'EXEMPTED', 'PAID', 'UNPAID'); END IF; END $$`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'USER' NOT NULL`,
  `ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS submission_events (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, platform platform NOT NULL, problem_slug text NOT NULL, problem_title text, difficulty text, accepted_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), source ledger_source NOT NULL, verification_level verification_level NOT NULL, provider_submission_id text, event_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS submission_code_versions (id serial PRIMARY KEY, event_id integer NOT NULL REFERENCES submission_events(id) ON DELETE CASCADE, language text, code text NOT NULL, submitted_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS membership_events (id serial PRIMARY KEY, group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, type membership_event_type NOT NULL, effective_at timestamptz NOT NULL, actor_user_id integer REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS study_periods (id serial PRIMARY KEY, group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE, period_of text NOT NULL, start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, status period_status NOT NULL DEFAULT 'OPEN', quota integer NOT NULL, penalty_type penalty_type NOT NULL, penalty_amount integer NOT NULL, timezone text NOT NULL, finalized_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS period_participants (id serial PRIMARY KEY, period_id integer NOT NULL REFERENCES study_periods(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS period_results (id serial PRIMARY KEY, period_id integer NOT NULL REFERENCES study_periods(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, solved_count integer NOT NULL, met_quota boolean NOT NULL, penalty_amount integer NOT NULL, finalized_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS period_result_actions (id serial PRIMARY KEY, period_result_id integer NOT NULL REFERENCES period_results(id) ON DELETE CASCADE, type period_result_action_type NOT NULL, solved_count integer, penalty_amount integer, reason text NOT NULL, actor_user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS group_github_installations (id serial PRIMARY KEY, group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE, installation_id text NOT NULL, repository_id text NOT NULL, repository_full_name text NOT NULL, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS submission_events_event_key_uq ON submission_events(event_key)`,
  `CREATE INDEX IF NOT EXISTS submission_events_user_time_idx ON submission_events(user_id, accepted_at)`,
  `CREATE INDEX IF NOT EXISTS submission_events_problem_idx ON submission_events(user_id, platform, problem_slug)`,
  `CREATE INDEX IF NOT EXISTS submission_code_versions_event_idx ON submission_code_versions(event_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS membership_events_group_user_time_idx ON membership_events(group_id, user_id, effective_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS study_periods_group_period_uq ON study_periods(group_id, period_of)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS period_participants_period_user_uq ON period_participants(period_id, user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS period_results_period_user_uq ON period_results(period_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS period_result_actions_result_time_idx ON period_result_actions(period_result_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS group_github_installations_group_uq ON group_github_installations(group_id)`,
  `CREATE OR REPLACE FUNCTION ledger_append_only_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only ledger row cannot be changed: %', TG_TABLE_NAME; END; $$`,
  `DROP TRIGGER IF EXISTS submission_events_append_only ON submission_events`,
  `CREATE TRIGGER submission_events_append_only BEFORE UPDATE OR DELETE ON submission_events FOR EACH ROW EXECUTE FUNCTION ledger_append_only_guard()`,
  `DROP TRIGGER IF EXISTS submission_code_versions_append_only ON submission_code_versions`,
  `CREATE TRIGGER submission_code_versions_append_only BEFORE UPDATE OR DELETE ON submission_code_versions FOR EACH ROW EXECUTE FUNCTION ledger_append_only_guard()`,
  `DROP TRIGGER IF EXISTS membership_events_append_only ON membership_events`,
  `CREATE TRIGGER membership_events_append_only BEFORE UPDATE OR DELETE ON membership_events FOR EACH ROW EXECUTE FUNCTION ledger_append_only_guard()`,
  `DROP TRIGGER IF EXISTS period_result_actions_append_only ON period_result_actions`,
  `CREATE TRIGGER period_result_actions_append_only BEFORE UPDATE OR DELETE ON period_result_actions FOR EACH ROW EXECUTE FUNCTION ledger_append_only_guard()`,
  `INSERT INTO submission_events (user_id, platform, problem_slug, problem_title, difficulty, accepted_at, source, verification_level, event_key) SELECT sl.user_id, sl.platform, sl.problem_slug, sl.problem_title, sl.difficulty, sl.accepted_at, 'LEGACY', 'LEGACY', concat('legacy:', sl.id) FROM solve_logs sl ON CONFLICT (event_key) DO NOTHING`,
  `INSERT INTO submission_code_versions (event_id, language, code, submitted_at) SELECT se.id, s.language, s.code, coalesce(s.submitted_at, sl.accepted_at) FROM submissions s JOIN solve_logs sl ON sl.id = s.solve_log_id JOIN submission_events se ON se.event_key = concat('legacy:', sl.id) WHERE NOT EXISTS (SELECT 1 FROM submission_code_versions scv WHERE scv.event_id = se.id AND scv.code = s.code)`,
  `INSERT INTO membership_events (group_id, user_id, type, effective_at, actor_user_id) SELECT m.group_id, m.user_id, 'JOINED', m.joined_at, NULL FROM memberships m WHERE NOT EXISTS (SELECT 1 FROM membership_events me WHERE me.group_id = m.group_id AND me.user_id = m.user_id AND me.type = 'JOINED' AND me.effective_at = m.joined_at)`,
];

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const statement of statements) await client.query(statement);
  await client.query("COMMIT");
  console.log(`applied ${statements.length} idempotent ledger statements`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
