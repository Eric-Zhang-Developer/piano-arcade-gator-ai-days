# take-store: the schema follows the contracts instead of copying the judging rule

- Date: 2026-10-24   Decided by: Sharan's agent (take-store), for Sharan   Feature: take-store
- **Context:** Eric's #64 prepares a `contract:` PR that adds a `GOOD` judgment. The schema only allowed PERFECT,
  GREAT and MISS within ±50 ms, so every take with a GOOD would be refused by the database, answered 422, and
  dropped from the browser's outbox for good. The game lane changes the contract; this lane shouldn't have to race it.
- **Options:** A: keep strict CHECKs and ship a migration with every contract change. B: CHECKs guard shape and
  sanity only (the server already re-judges every take with the game's own judge), and a take the database still
  refuses is answered 424 and kept in the outbox for later.
- **Choice:** B. Migration `20261024000003_contract_tolerant.sql`; tests in `take-store.test.ts`,
  `supabase/tests/take_store.sql` and `live-smoke.mjs`. Raw `take`/`results` JSON and `contract_version` still let
  old takes be re-judged.
- **How to undo:** a migration that restores the `in (...)` and ±50 checks; turn the 424 back into 422.
