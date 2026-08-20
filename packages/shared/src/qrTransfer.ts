/**
 * QR-code offline transfer protocol.
 *
 * A scout's phone can save a scouting entry with zero signal (the IndexedDB
 * outbox already handles that), but there's no way for that entry to reach
 * anyone else until the phone gets connectivity back — which, at a bad venue,
 * might not be until the event's over. As a stopgap, a scout can show the
 * saved entry as a sequence of QR codes for an analyst to scan directly,
 * phone-to-phone, no network involved at all.
 *
 * A single QR code can only reliably hold a few hundred bytes before it gets
 * too dense to scan off another phone's screen, so a full entry (auton path,
 * skill ratings, notes) is split across multiple codes and reassembled once
 * all of them have been scanned. This is a redundant fast-path, not the
 * authoritative copy — the scout's own device still syncs the full entry
 * normally once it reconnects, upserting over whatever the QR relay already
 * delivered.
 */

const MAGIC = "FRCQ1";

/**
 * Conservative default — keeps codes scannable off a phone screen at a
 * slight distance/angle. Verified empirically: a naive "as much as fits"
 * chunk size (600 chars) produced QR codes dense enough that even a clean,
 * noise-free synthetic scan failed at anything under ~500px; real camera
 * capture (screen glare, motion, imperfect angle) needs more headroom than
 * that, not less. 300 chars keeps the QR version low enough to decode
 * reliably at a moderate render size — see QrCode.tsx's default size.
 */
export const DEFAULT_QR_CHUNK_CHARS = 300;

export type QrEntryKind = "match" | "pit";

export interface QrChunk {
  kind: QrEntryKind;
  id: string;
  index: number;
  total: number;
  body: string;
}

/**
 * Splits a JSON-serializable entry into QR-code payload strings. `id` should
 * be the entry's own id (used as the reassembly key on the scanning side).
 */
export function chunkForQr(
  payload: unknown,
  kind: QrEntryKind,
  id: string,
  maxCharsPerChunk: number = DEFAULT_QR_CHUNK_CHARS
): string[] {
  const json = JSON.stringify(payload);
  const total = Math.max(1, Math.ceil(json.length / maxCharsPerChunk));
  const chunks: string[] = [];
  for (let i = 0; i < total; i++) {
    const body = json.slice(i * maxCharsPerChunk, (i + 1) * maxCharsPerChunk);
    chunks.push(`${MAGIC}|${kind}|${id}|${i}|${total}|${body}`);
  }
  return chunks;
}

/**
 * Parses one scanned QR code's text back into a chunk descriptor, or null if
 * it isn't one of ours (e.g. someone's camera picked up an unrelated code).
 * The body is rejoined on "|" so a literal pipe character inside JSON content
 * (e.g. in a scout's notes) doesn't corrupt reassembly.
 */
export function parseQrChunk(text: string): QrChunk | null {
  const parts = text.split("|");
  if (parts.length < 6 || parts[0] !== MAGIC) return null;

  const [, kind, id, indexStr, totalStr, ...rest] = parts;
  if (kind !== "match" && kind !== "pit") return null;

  const index = Number(indexStr);
  const total = Number(totalStr);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total) return null;
  if (!id) return null;

  return { kind, id, index, total, body: rest.join("|") };
}

/**
 * Accumulates chunks (possibly scanned out of order, possibly duplicated)
 * for one or more in-flight transfers at once, keyed by entry id. Call
 * `add()` for every scanned code; once a given id's chunks are all present,
 * `add()` returns the reassembled, parsed payload for it.
 */
export class QrReassembler {
  private byId = new Map<string, { kind: QrEntryKind; total: number; parts: Map<number, string> }>();

  /** Returns the parsed payload once complete, or null if more chunks are still needed. */
  add<T = unknown>(text: string): { kind: QrEntryKind; id: string; payload: T } | null {
    const chunk = parseQrChunk(text);
    if (!chunk) return null;

    let entry = this.byId.get(chunk.id);
    if (!entry) {
      entry = { kind: chunk.kind, total: chunk.total, parts: new Map() };
      this.byId.set(chunk.id, entry);
    }
    entry.parts.set(chunk.index, chunk.body);

    if (entry.parts.size < entry.total) return null;

    const json = Array.from({ length: entry.total }, (_, i) => entry!.parts.get(i) ?? "").join("");
    this.byId.delete(chunk.id);
    try {
      return { kind: entry.kind, id: chunk.id, payload: JSON.parse(json) as T };
    } catch {
      return null; // corrupted scan somewhere in the sequence — caller can ask to rescan
    }
  }

  /** Progress for an in-flight transfer, for a "2 of 4 scanned" style indicator. */
  progress(id: string): { scanned: number; total: number } | null {
    const entry = this.byId.get(id);
    return entry ? { scanned: entry.parts.size, total: entry.total } : null;
  }

  /** All transfer ids currently in progress (not yet complete), most useful for a status list. */
  pendingIds(): string[] {
    return Array.from(this.byId.keys());
  }
}
