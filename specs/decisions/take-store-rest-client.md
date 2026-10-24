# take-store: call Supabase over fetch, no SDK

- Date: 2026-10-24   Decided by: Sharan's agent (take-store), for Sharan   Feature: take-store
- **Context:** The spec planned `@supabase/supabase-js`, but `web/package.json` is frozen and the contract PR was
  already pushed. The take store needs only four calls: anonymous sign-up, token refresh, read the user, and PostgREST.
- **Options:** A: a second `contract:` PR adding the SDK. B: plain `fetch` to the Auth and PostgREST REST APIs.
- **Choice:** B. No dependency, no extra PR for Eric, and every request is visible in one file
  (`web/src/data/auth.ts` for the browser, `web/src/data/server.ts` for the server).
- **How to undo:** add the SDK through a `contract:` PR and reimplement those two files on it; nothing else imports
  Supabase.
