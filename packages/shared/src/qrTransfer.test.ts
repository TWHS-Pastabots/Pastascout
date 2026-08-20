import { describe, expect, it } from "vitest";
import { chunkForQr, parseQrChunk, QrReassembler } from "./qrTransfer";

describe("chunkForQr / parseQrChunk", () => {
  it("round-trips a small payload as a single chunk", () => {
    const payload = { id: "abc-123", teamNumber: 254, notes: "fast robot" };
    const chunks = chunkForQr(payload, "match", "abc-123", 600);
    expect(chunks).toHaveLength(1);

    const parsed = parseQrChunk(chunks[0]);
    expect(parsed).toEqual({ kind: "match", id: "abc-123", index: 0, total: 1, body: JSON.stringify(payload) });
  });

  it("splits a large payload into multiple chunks with correct indices", () => {
    const payload = { id: "big-1", notes: "x".repeat(2000) };
    const chunks = chunkForQr(payload, "pit", "big-1", 500);
    expect(chunks.length).toBeGreaterThan(1);

    chunks.forEach((c, i) => {
      const parsed = parseQrChunk(c)!;
      expect(parsed.index).toBe(i);
      expect(parsed.total).toBe(chunks.length);
      expect(parsed.kind).toBe("pit");
      expect(parsed.id).toBe("big-1");
    });
  });

  it("preserves a literal pipe character embedded in the JSON content", () => {
    const payload = { id: "pipe-1", notes: "defense | shuttling | strong auton" };
    const chunks = chunkForQr(payload, "match", "pipe-1", 600);
    const parsed = parseQrChunk(chunks[0])!;
    expect(JSON.parse(parsed.body)).toEqual(payload);
  });

  it("rejects text that isn't one of our codes", () => {
    expect(parseQrChunk("https://example.com")).toBeNull();
    expect(parseQrChunk("FRCQ1|match|abc|not-a-number|1|{}")).toBeNull();
    expect(parseQrChunk("FRCQ1|bogus-kind|abc|0|1|{}")).toBeNull();
    expect(parseQrChunk("")).toBeNull();
  });
});

describe("QrReassembler", () => {
  it("returns null until every chunk has been added, then the parsed payload", () => {
    const payload = { id: "e1", teamNumber: 971, fuel: 12 };
    const chunks = chunkForQr(payload, "match", "e1", 20); // force multiple chunks
    expect(chunks.length).toBeGreaterThan(1);

    const reassembler = new QrReassembler();
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(reassembler.add(chunks[i])).toBeNull();
    }
    const result = reassembler.add(chunks[chunks.length - 1]);
    expect(result).toEqual({ kind: "match", id: "e1", payload });
  });

  it("handles chunks scanned out of order", () => {
    const payload = { id: "e2", value: "shuffled" };
    const chunks = chunkForQr(payload, "pit", "e2", 10);
    const reassembler = new QrReassembler();

    const shuffled = [...chunks].reverse();
    let result = null;
    for (const c of shuffled) result = reassembler.add(c) ?? result;
    expect(result).toEqual({ kind: "pit", id: "e2", payload });
  });

  it("is idempotent when the same chunk is scanned twice", () => {
    const chunks = chunkForQr({ id: "e3", a: "x".repeat(30) }, "match", "e3", 20);
    expect(chunks.length).toBeGreaterThan(1);
    const reassembler = new QrReassembler();
    reassembler.add(chunks[0]);
    reassembler.add(chunks[0]); // duplicate scan — must not corrupt or double-count
    let result = null;
    for (let i = 1; i < chunks.length; i++) result = reassembler.add(chunks[i]) ?? result;
    expect(result).not.toBeNull();
  });

  it("tracks progress and pending ids for an in-flight transfer", () => {
    const chunks = chunkForQr({ id: "e4", a: "x".repeat(50) }, "match", "e4", 20);
    const reassembler = new QrReassembler();
    reassembler.add(chunks[0]);
    expect(reassembler.progress("e4")).toEqual({ scanned: 1, total: chunks.length });
    expect(reassembler.pendingIds()).toEqual(["e4"]);
  });

  it("tracks two simultaneous transfers independently", () => {
    const a = chunkForQr({ id: "a1", v: 1 }, "match", "a1", 600);
    const b = chunkForQr({ id: "b1", v: 2 }, "pit", "b1", 600);
    const reassembler = new QrReassembler();
    expect(reassembler.add(a[0])).toEqual({ kind: "match", id: "a1", payload: { id: "a1", v: 1 } });
    expect(reassembler.add(b[0])).toEqual({ kind: "pit", id: "b1", payload: { id: "b1", v: 2 } });
  });
});
