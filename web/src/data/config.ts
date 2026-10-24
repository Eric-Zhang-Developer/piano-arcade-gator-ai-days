// Supabase settings. Unset = the take store runs on localStorage only and the game doesn't notice.
// NEXT_PUBLIC_* reach the browser; SUPABASE_SECRET_KEY must only ever be read on the server.

export const JUDGE_VERSION = 1; // bump when web/src/game/core/judge.ts changes its rule
export const CONTRACT_VERSION = 1; // bump when Take or Results in web/src/contracts/ change shape

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const isConfigured = () => Boolean(supabaseUrl && publishableKey);
