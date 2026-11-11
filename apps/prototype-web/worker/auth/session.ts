/**
 * Server-side sessions (D1-backed) with HttpOnly/SameSite cookies.
 * Only the SHA-256 hash of the session token is stored; the cookie carries
 * the opaque token. Roles are ALWAYS resolved server-side from the database —
 * a client-supplied role is never authority (contract 18 §4).
 */

import { randomToken, sha256Hex } from "../crypto.ts";
import { SESSION_TTL_MS } from "../env.ts";
import type { Db } from "../db/d1.ts";

export interface SessionIdentityRow {
  session_id: string;
  identity_id: string;
  google_sub: string;
  email: string;
  display_name: string;
  picture_url: string | null;
  is_admin: number;
}

export interface AuthenticatedContext {
  identityId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

/** Create a session row; returns the opaque cookie token. */
export async function createSession(
  db: Db,
  identityId: string,
  now: number,
): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken(32);
  const sessionId = randomToken(12);
  const expiresAt = now + SESSION_TTL_MS;
  await db
    .prepare(
      "INSERT INTO network_session (id, identity_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(sessionId, identityId, await sha256Hex(token), now, expiresAt)
    .run();
  return { token, expiresAt };
}

/** Resolve the session cookie token to an identity + admin flag. */
export async function resolveSession(
  db: Db,
  token: string | undefined,
  now: number,
): Promise<AuthenticatedContext | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      "SELECT s.id AS session_id, s.expires_at, i.id AS identity_id, i.google_sub, i.email, " +
        "i.display_name, i.picture_url, i.last_seen_at, " +
        "(SELECT COUNT(*) FROM network_membership m WHERE m.identity_id = i.id AND m.role = 'admin' AND m.status = 'active') AS is_admin " +
        "FROM network_session s JOIN network_identity i ON i.id = s.identity_id " +
        "WHERE s.token_hash = ? AND s.revoked_at IS NULL",
    )
    .bind(await sha256Hex(token))
    .first<Record<string, unknown>>();
  if (!row) return null;
  if (Number(row.expires_at) <= now) return null;
  return {
    identityId: String(row.identity_id),
    email: String(row.email),
    displayName: String(row.display_name),
    isAdmin: Number(row.is_admin) > 0,
  };
}

/** Revoke a session (sign-out). */
export async function revokeSession(db: Db, token: string | undefined, now: number): Promise<void> {
  if (!token) return;
  await db
    .prepare("UPDATE network_session SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(now, await sha256Hex(token))
    .run();
}

/** Upsert the identity after a validated Google sign-in; returns its id. */
export async function upsertIdentity(
  db: Db,
  profile: { sub: string; email: string; name: string; picture: string | null },
  now: number,
  newIdentityId: string,
): Promise<string> {
  const existing = await db
    .prepare("SELECT id FROM network_identity WHERE google_sub = ?")
    .bind(profile.sub)
    .first<Record<string, unknown>>();
  if (existing) {
    await db
      .prepare(
        "UPDATE network_identity SET email = ?, display_name = ?, picture_url = ?, last_seen_at = ? WHERE id = ?",
      )
      .bind(profile.email, profile.name, profile.picture, now, String(existing.id))
      .run();
    return String(existing.id);
  }
  await db
    .prepare(
      "INSERT INTO network_identity (id, google_sub, email, email_verified, display_name, picture_url, created_at, last_seen_at) " +
        "VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
    )
    .bind(newIdentityId, profile.sub, profile.email, profile.name, profile.picture, now, now)
    .run();
  return newIdentityId;
}

/**
 * First-owner/admin bootstrap: only when NO admin exists AND the configured
 * BOOTSTRAP_OWNER_EMAIL (a Cloudflare var set by the owner) matches the
 * signed-in email. No self-granting endpoint; no email hard-coded in source.
 * Returns true when the membership was granted.
 */
export async function bootstrapFirstAdmin(
  db: Db,
  identityId: string,
  email: string,
  configuredBootstrapEmail: string | undefined,
  now: number,
): Promise<boolean> {
  if (!configuredBootstrapEmail) return false;
  if (email !== configuredBootstrapEmail.trim().toLowerCase()) return false;
  const adminCount = await db
    .prepare("SELECT COUNT(*) AS n FROM network_membership WHERE role = 'admin' AND status = 'active'")
    .first<Record<string, unknown>>();
  if (Number(adminCount?.n ?? 0) > 0) return false;
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'bootstrap', ?) " +
        "ON CONFLICT(identity_id, role) DO UPDATE SET status = 'active', granted_at = excluded.granted_at",
    )
    .bind(identityId, now)
    .run();
  return true;
}
