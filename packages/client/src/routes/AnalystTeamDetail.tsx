import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GAME_CONFIG } from "@frc-scout/shared";
import { api } from "../lib/api";
import { AutonPathView } from "../components/AutonPathView";

const SKILL_LABELS: Record<string, string> = Object.fromEntries(
  GAME_CONFIG.skillCategories.map((c) => [c.id, c.label])
);

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}

export function AnalystTeamDetail() {
  const { teamNumber } = useParams();
  const num = Number(teamNumber);
  const queryClient = useQueryClient();

  const matchQuery = useQuery({
    queryKey: ["match-scouting", num],
    queryFn: () => api.matchScoutingList({ teamNumber: num }),
    enabled: Number.isFinite(num),
  });

  const pitQuery = useQuery({
    queryKey: ["pit-scouting", num],
    queryFn: () => api.pitScoutingList({ teamNumber: num }),
    enabled: Number.isFinite(num),
  });

  const setExcluded = useMutation({
    mutationFn: ({ id, excludeFromStats }: { id: string; excludeFromStats: boolean }) =>
      api.setMatchScoutingExcluded(id, excludeFromStats),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-scouting", num] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const matches = matchQuery.data ?? [];
  const pits = pitQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/analyst" className="text-sm text-green-400 hover:text-green-300">
          ← Back to stats
        </Link>
        <h2 className="mt-1 text-lg font-bold text-slate-100">Team {num} — scouting reports</h2>
      </div>

      {pitQuery.isLoading && <p className="text-slate-400">Loading pit report…</p>}
      {pits.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold text-slate-200">Pit scouting</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {pits.map((pit) => (
              <div key={pit.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-200">Pit report</span>
                  <span className="text-slate-500">{pit.scoutName}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatPill label="Drivetrain" value={pit.drivetrainType || "—"} />
                  <StatPill label="Weight" value={pit.weightLbs != null ? `${pit.weightLbs} lbs` : "—"} />
                  <StatPill label="Fuel capacity" value={pit.fuelCapacity != null ? `${pit.fuelCapacity}` : "—"} />
                  <StatPill
                    label="Claims climb"
                    value={pit.canClimbLevels.length > 0 ? pit.canClimbLevels.map((l) => `L${l}`).join(", ") : "—"}
                  />
                  <StatPill label="Under Trench" value={pit.canGoUnderTrench ? "Yes" : "No"} />
                  <StatPill label="Photos" value={String(pit.photos.length)} />
                </div>
                {pit.autonCapabilities && (
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="text-slate-500">Auton: </span>
                    {pit.autonCapabilities}
                  </p>
                )}
                {pit.notes && (
                  <p className="mt-1 text-sm text-slate-300">
                    <span className="text-slate-500">Notes: </span>
                    {pit.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-slate-200">Match reports</h3>

        {matchQuery.isLoading && <p className="text-slate-400">Loading…</p>}
        {matchQuery.error && <p className="text-red-400">Couldn't load entries — is the server reachable?</p>}
        {matchQuery.data && matches.length === 0 && (
          <p className="text-slate-400">No match scouting reports for this team yet.</p>
        )}

        {matches.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {matches.map((entry) => {
              const lineCount = (entry.autonPath.strokes ?? []).length;
              const markerCount = entry.autonPath.waypoints.length;
              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-3 ${
                    entry.excludeFromStats ? "border-red-900 bg-red-950/20" : "border-slate-800 bg-slate-900"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-200">
                      Match {entry.matchId} <span className="text-slate-500">({entry.alliance})</span>
                    </span>
                    <span className="text-slate-500">{entry.scoutName}</span>
                  </div>
                  <p className="mb-2 text-xs text-slate-600">{new Date(entry.createdAt).toLocaleString()}</p>

                  <div className="mb-2 flex items-center justify-between">
                    {entry.excludeFromStats ? (
                      <p className="text-xs font-medium text-red-400">Excluded from stats</p>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      disabled={setExcluded.isPending}
                      onClick={() =>
                        setExcluded.mutate({ id: entry.id, excludeFromStats: !entry.excludeFromStats })
                      }
                      className="text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-50"
                    >
                      {entry.excludeFromStats ? "Include in stats" : "Exclude from stats"}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <StatPill label="Auton fuel" value={String(entry.auton.fuelScored)} />
                    <StatPill label="Auton climb" value={entry.auton.towerClimbLevel ? "L1" : "None"} />
                    <StatPill label="Mobility" value={entry.auton.mobility ? "Yes" : "No"} />
                    <StatPill label="Teleop fuel" value={String(entry.teleop.fuelScored)} />
                    <StatPill label="Teleop climb" value={entry.teleop.towerClimbLevel ? `L${entry.teleop.towerClimbLevel}` : "None"} />
                    <StatPill label="Defense" value={entry.teleop.defensePlayed ? "Yes" : "No"} />
                    <StatPill label="Bump x-ings" value={String(entry.teleop.bumpCrossings)} />
                    <StatPill label="Trench x-ings" value={String(entry.teleop.trenchCrossings)} />
                    <StatPill label="Penalties" value={String(entry.penalties)} />
                    <StatPill label="Won auton" value={entry.auton.wonAuton ? "Yes" : "No"} />
                    <StatPill label="Contributed" value={entry.auton.contributedToAuton ? "Yes" : "No"} />
                    <StatPill label="Broke down" value={entry.brokeDown ? "Yes" : "No"} />
                  </div>

                  {entry.skillRatings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.skillRatings.map((r) => (
                        <span
                          key={r.categoryId}
                          className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                        >
                          {SKILL_LABELS[r.categoryId] ?? r.categoryId}: {r.score}/{GAME_CONFIG.skillScaleMax}
                        </span>
                      ))}
                    </div>
                  )}

                  {entry.notes && (
                    <p className="mt-2 text-sm text-slate-300">
                      <span className="text-slate-500">Notes: </span>
                      {entry.notes}
                    </p>
                  )}

                  <AutonPathView
                    path={entry.autonPath}
                    startPosition={entry.auton.startPosition}
                    className="mt-2 w-full rounded-lg border border-slate-700"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {lineCount} line{lineCount === 1 ? "" : "s"} · {markerCount} marker{markerCount === 1 ? "" : "s"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
