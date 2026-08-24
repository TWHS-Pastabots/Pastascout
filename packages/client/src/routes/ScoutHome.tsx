import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { api } from "../lib/api";
import { useAppStore } from "../state/appStore";
import { useCacheRefresh } from "../lib/cacheRefresh";

export function ScoutHome() {
  useCacheRefresh();
  const scoutName = useAppStore((s) => s.scoutName);
  const activeEventKey = useAppStore((s) => s.activeEventKey);
  const setActiveEventKey = useAppStore((s) => s.setActiveEventKey);

  const [events, setEvents] = useState<{ eventKey: string; name: string }[]>([]);
  useEffect(() => {
    api.events().then(setEvents).catch(() => {});
  }, []);

  const matches = useLiveQuery(
    () =>
      activeEventKey
        ? db.cachedMatches.where("eventKey").equals(activeEventKey).sortBy("matchNumber")
        : db.cachedMatches.toArray(),
    [activeEventKey],
    []
  );
  const teamNames = useLiveQuery(
    () => db.cachedTeams.toArray().then((teams) => new Map(teams.map((t) => [t.teamNumber, t.name]))),
    [],
    new Map<number, string>()
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Hey, {scoutName}</h1>
        <p className="text-slate-400">Pick a match and team to scout, or do pit scouting.</p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <label className="text-sm font-medium text-slate-300">Event</label>
        <select
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
          value={activeEventKey}
          onChange={(e) => setActiveEventKey(e.target.value)}
        >
          <option value="">All cached matches</option>
          {events.map((ev) => (
            <option key={ev.eventKey} value={ev.eventKey}>
              {ev.name} ({ev.eventKey})
            </option>
          ))}
        </select>
      </section>

      <Link
        to="/scout/pit"
        className="rounded-xl border border-slate-800 bg-slate-900 p-4 font-medium text-slate-100 hover:border-green-600"
      >
        Pit scouting →
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-200">Matches</h2>
        {matches.length === 0 && (
          <p className="text-sm text-slate-500">
            No matches cached yet. Connect to the server once (Settings) to pull the schedule — after that this works offline.
          </p>
        )}
        {matches.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="mb-2 text-sm font-medium text-slate-300">
              {m.type === "qual" ? "Qual" : "Playoff"} {m.matchNumber}
            </div>
            <div className="flex flex-wrap gap-2">
              {m.redTeams.map((t) => (
                <TeamChip key={t} matchId={m.id} teamNumber={t} alliance="red" name={teamNames.get(t)} />
              ))}
              {m.blueTeams.map((t) => (
                <TeamChip key={t} matchId={m.id} teamNumber={t} alliance="blue" name={teamNames.get(t)} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function TeamChip({
  matchId,
  teamNumber,
  alliance,
  name,
}: {
  matchId: string;
  teamNumber: number;
  alliance: "red" | "blue";
  name?: string;
}) {
  return (
    <Link
      to={`/scout/match/${encodeURIComponent(matchId)}/${teamNumber}/${alliance}`}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        alliance === "red" ? "bg-red-900/50 text-red-300 hover:bg-red-900" : "bg-blue-900/50 text-blue-300 hover:bg-blue-900"
      }`}
    >
      {teamNumber}
      {name ? ` · ${name}` : ""}
    </Link>
  );
}
