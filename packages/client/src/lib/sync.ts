import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { api } from "./api";

let syncing = false;

/** Push every unsynced outbox record to the server. Safe to call repeatedly — upserts by UUID. */
export async function flushOutbox() {
  if (syncing) return;
  syncing = true;
  try {
    const unsyncedMatches = await db.matchScoutingOutbox.where("synced").equals(0).toArray();
    for (const record of unsyncedMatches) {
      try {
        await api.postMatchScouting(record.payload);
        await db.matchScoutingOutbox.update(record.id, { synced: 1, lastError: undefined });
      } catch (err) {
        await db.matchScoutingOutbox.update(record.id, {
          attempts: record.attempts + 1,
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const unsyncedPits = await db.pitScoutingOutbox.where("synced").equals(0).toArray();
    for (const record of unsyncedPits) {
      try {
        await api.postPitScouting(record.payload);
        await db.pitScoutingOutbox.update(record.id, { synced: 1, lastError: undefined });
      } catch (err) {
        await db.pitScoutingOutbox.update(record.id, {
          attempts: record.attempts + 1,
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    syncing = false;
  }
}

const SYNC_INTERVAL_MS = 15_000;

/** Mount once near the app root: retries the outbox on an interval and whenever the browser regains connectivity. */
export function useBackgroundSync() {
  useEffect(() => {
    flushOutbox();
    const interval = setInterval(flushOutbox, SYNC_INTERVAL_MS);
    window.addEventListener("online", flushOutbox);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", flushOutbox);
    };
  }, []);
}

/** Live count of entries still waiting to sync, for a status badge in the UI. */
export function useUnsyncedCount() {
  const matchCount = useLiveQuery(() => db.matchScoutingOutbox.where("synced").equals(0).count(), [], 0);
  const pitCount = useLiveQuery(() => db.pitScoutingOutbox.where("synced").equals(0).count(), [], 0);
  return (matchCount ?? 0) + (pitCount ?? 0);
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}
