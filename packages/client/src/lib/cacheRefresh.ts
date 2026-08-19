import { useEffect } from "react";
import { api } from "./api";
import { cacheMatches, cacheTeams } from "./db";
import { useAppStore } from "../state/appStore";

const REFRESH_INTERVAL_MS = 30_000;

/** Keeps the local schedule/team cache warm whenever we can reach the server, so ScoutHome works fully offline. */
export function useCacheRefresh() {
  const eventKey = useAppStore((s) => s.activeEventKey);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [teams, matches] = await Promise.all([api.teams(), api.matches(eventKey || undefined)]);
        if (cancelled) return;
        await cacheTeams(teams);
        await cacheMatches(matches);
      } catch {
        // offline or server unreachable — cached data from the last successful refresh stays in place
      }
    }

    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", refresh);
    };
  }, [eventKey]);
}
