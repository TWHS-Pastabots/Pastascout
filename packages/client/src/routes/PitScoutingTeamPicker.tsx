import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../lib/db";
import { useCacheRefresh } from "../lib/cacheRefresh";

export function PitScoutingTeamPicker() {
  useCacheRefresh();
  const teams = useLiveQuery(() => db.cachedTeams.orderBy("teamNumber").toArray(), [], []);
  const completed = useLiveQuery(
    () => db.pitScoutingOutbox.toArray().then((rows) => new Set(rows.map((r) => r.payload.teamNumber))),
    [],
    new Set<number>()
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold text-slate-100">Pit scouting</h1>
      <p className="text-slate-400">Pick a team to fill out their pit scouting sheet.</p>
      {teams.length === 0 && (
        <p className="text-sm text-slate-500">No teams cached yet — connect once via Settings to pull the team list.</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {teams.map((t) => (
          <Link
            key={t.teamNumber}
            to={`/scout/pit/${t.teamNumber}`}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              completed.has(t.teamNumber)
                ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                : "border-slate-800 bg-slate-900 text-slate-200"
            }`}
          >
            {t.teamNumber}
            <div className="truncate text-xs text-slate-500">{t.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
