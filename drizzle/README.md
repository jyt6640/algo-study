# Database migrations

`scripts/migrate.mjs` is the authoritative additive migration for the current production database. It is idempotent, runs in one transaction, keeps legacy tables, and backfills the new ledger from existing rows. Run it with `npm run db:migrate` after setting `DATABASE_URL`.
