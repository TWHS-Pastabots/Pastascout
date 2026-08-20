import { randomBytes } from "node:crypto";

/**
 * In-memory session tokens for the Analyst password gate. Deliberately not
 * persisted — a server restart just means everyone re-enters the password,
 * which is a fine tradeoff for a shared team password protecting low-stakes
 * strategy data, not a real per-user auth system.
 */
const validTokens = new Set<string>();

export function issueAnalystToken(): string {
  const token = randomBytes(24).toString("hex");
  validTokens.add(token);
  return token;
}

export function isValidAnalystToken(token: string | undefined): boolean {
  return Boolean(token && validTokens.has(token));
}
