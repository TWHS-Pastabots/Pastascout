import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { AutonPathView } from "../components/AutonPathView";

export function AnalystTeamDetail() {
  const { teamNumber } = useParams();
  const num = Number(teamNumber);

  const { data, isLoading, error } = useQuery({
    queryKey: ["match-scouting", num],
    queryFn: () => api.matchScoutingList({ teamNumber: num }),
    enabled: Number.isFinite(num),
  });

  return (
    <div className="flex flex-col gap-4">
      <Link to="/analyst" className="text-sm text-green-400 hover:text-green-300">
        ← Back to stats
      </Link>
      <h2 className="text-lg font-bold text-slate-100">Team {num} — auton paths</h2>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <p className="text-red-400">Couldn't load entries — is the server reachable?</p>}
      {data && data.length === 0 && <p className="text-slate-400">No scouting entries for this team yet.</p>}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((entry) => {
            const lineCount = (entry.autonPath.strokes ?? []).length;
            const markerCount = entry.autonPath.waypoints.length;
            return (
              <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-200">
                    Match {entry.matchId} <span className="text-slate-500">({entry.alliance})</span>
                  </span>
                  <span className="text-slate-500">{entry.scoutName}</span>
                </div>
                <AutonPathView
                  path={entry.autonPath}
                  startPosition={entry.auton.startPosition}
                  className="w-full rounded-lg border border-slate-700"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {lineCount} line{lineCount === 1 ? "" : "s"} · {markerCount} marker{markerCount === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
