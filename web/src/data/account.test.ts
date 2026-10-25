// The handle rule is the database's CHECK, so the page says "no" before the server has to. User details come from
// Supabase Auth's user body, and a field Google didn't send stays empty instead of becoming a made-up name.
import { describe, expect, it } from "vitest";
import { checkHandle, userDetails } from "./account";

describe("checkHandle", () => {
  it("takes letters, numbers, spaces and _ up to 16", () => {
    expect(checkHandle("Sharan_1")).toEqual({ ok: true, handle: "Sharan_1" });
    expect(checkHandle("  DJ Keys  ")).toEqual({ ok: true, handle: "DJ Keys" });
    expect(checkHandle("a".repeat(16))).toEqual({ ok: true, handle: "a".repeat(16) });
  });

  it("refuses too long", () => {
    expect(checkHandle("a".repeat(17))).toEqual({ ok: false, reason: "16 characters at most." });
  });

  it("refuses bad characters", () => {
    for (const bad of ["<script>", "émile", "a-b", "a.b", "😀"]) expect(checkHandle(bad).ok, bad).toBe(false);
    expect(checkHandle("<script>")).toEqual({ ok: false, reason: "Letters, numbers, spaces and _ only." });
  });

  it("refuses empty and non-text", () => {
    expect(checkHandle("")).toEqual({ ok: false, reason: "Type a handle first." });
    expect(checkHandle("   ")).toEqual({ ok: false, reason: "Type a handle first." });
    expect(checkHandle(undefined).ok).toBe(false);
    expect(checkHandle(42).ok).toBe(false);
  });
});

describe("userDetails", () => {
  it("reads the Google identity", () => {
    const user = {
      email: "player@example.com",
      identities: [
        { provider: "anonymous", identity_data: {} },
        { provider: "google", identity_data: { full_name: "Ada Player", avatar_url: "https://lh3.googleusercontent.com/a/x" } },
      ],
    };
    expect(userDetails(user)).toEqual({
      name: "Ada Player",
      email: "player@example.com",
      avatarUrl: "https://lh3.googleusercontent.com/a/x",
      google: true,
    });
  });

  it("falls back to user_metadata", () => {
    const user = { user_metadata: { name: "Ada", picture: "https://example.com/p.png", email: "a@example.com" } };
    expect(userDetails(user)).toEqual({ name: "Ada", email: "a@example.com", avatarUrl: "https://example.com/p.png", google: false });
  });

  it("leaves missing fields empty", () => {
    expect(userDetails({ id: "x", is_anonymous: true })).toEqual({ name: null, email: null, avatarUrl: null, google: false });
    expect(userDetails(null)).toEqual({ name: null, email: null, avatarUrl: null, google: false });
    expect(userDetails({ identities: [{ provider: "google" }] })).toEqual({ name: null, email: null, avatarUrl: null, google: true });
  });

  it("keeps only https avatars and non-blank names", () => {
    const user = { user_metadata: { full_name: "  ", avatar_url: "javascript:alert(1)", picture: "http://x.example/p.png" } };
    expect(userDetails(user)).toEqual({ name: null, email: null, avatarUrl: null, google: false });
  });
});
