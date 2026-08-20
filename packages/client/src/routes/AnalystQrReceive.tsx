import { useRef, useState } from "react";
import { QrReassembler, MatchScoutingEntrySchema, PitScoutingEntrySchema } from "@frc-scout/shared";
import type { MatchScoutingEntry, PitScoutingEntry } from "@frc-scout/shared";
import { QrScanner } from "../components/QrScanner";
import { queueMatchScouting, queuePitScouting } from "../lib/db";
import { flushOutbox } from "../lib/sync";

interface ReceivedItem {
  key: string;
  label: string;
  status: "ok" | "invalid";
  at: string;
}

interface InProgress {
  scanned: number;
  total: number;
}

/**
 * The receiving end of the QR offline-transfer fallback: scans the codes a
 * scout's phone is showing and queues each completed entry into this
 * device's own outbox, exactly like a normal offline-created entry — so it
 * benefits from the same retry-until-synced behavior once this device (the
 * analyst's, not the scout's) has a connection.
 */
export function AnalystQrReceive() {
  const reassemblerRef = useRef(new QrReassembler());
  const [inProgress, setInProgress] = useState<Record<string, InProgress>>({});
  const [received, setReceived] = useState<ReceivedItem[]>([]);

  function logReceived(item: ReceivedItem) {
    setReceived((prev) => [item, ...prev].slice(0, 30));
  }

  async function handleScan(text: string) {
    const result = reassemblerRef.current.add(text);

    setInProgress((prev) => {
      const next = { ...prev };
      for (const id of reassemblerRef.current.pendingIds()) {
        const p = reassemblerRef.current.progress(id);
        if (p) next[id] = p;
      }
      if (result) delete next[result.id];
      return next;
    });

    if (!result) return;
    const at = new Date().toLocaleTimeString();

    if (result.kind === "match") {
      const parsed = MatchScoutingEntrySchema.safeParse(result.payload);
      if (!parsed.success) {
        logReceived({ key: result.id, label: "Couldn't validate a scanned match entry — try rescanning", status: "invalid", at });
        return;
      }
      const entry: MatchScoutingEntry = parsed.data;
      await queueMatchScouting(entry);
      logReceived({ key: entry.id, label: `Team ${entry.teamNumber} — match ${entry.matchId}`, status: "ok", at });
    } else {
      const parsed = PitScoutingEntrySchema.safeParse(result.payload);
      if (!parsed.success) {
        logReceived({ key: result.id, label: "Couldn't validate a scanned pit entry — try rescanning", status: "invalid", at });
        return;
      }
      const entry: PitScoutingEntry = parsed.data;
      await queuePitScouting(entry);
      logReceived({ key: entry.id, label: `Team ${entry.teamNumber} — pit scouting`, status: "ok", at });
    }
    flushOutbox();
  }

  const inProgressList = Object.values(inProgress);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">Receive via QR</h2>
        <p className="mt-1 text-sm text-slate-400">
          Point this camera at a scout's QR backup codes. Each completed entry queues on this device and syncs to
          the server automatically — same as any offline entry, just relayed phone-to-phone instead of over the
          network.
        </p>
      </section>

      <QrScanner onScan={handleScan} />

      {inProgressList.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-slate-300">In progress</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-400">
            {inProgressList.map((p, i) => (
              <li key={i}>
                {p.scanned} / {p.total} parts scanned…
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-semibold text-slate-300">Received this session</h3>
        {received.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nothing scanned yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {received.map((r) => (
              <li key={r.key + r.at} className={r.status === "ok" ? "text-emerald-400" : "text-amber-400"}>
                {r.status === "ok" ? "✓" : "⚠"} {r.label} <span className="text-slate-600">· {r.at}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
