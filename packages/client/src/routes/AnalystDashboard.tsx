import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAppStore } from "../state/appStore";

const WEIGHT_LABELS: Record<string, string> = {
  epa: "EPA",
  opr: "OPR",
  avgFuel: "Avg Fuel",
  avgSkill: "Avg Skill",
};

export function AnalystDashboard() {
  const eventKey = useAppStore((s) => s.activeEventKey);
  const [weights, setWeights] = useState({ epa: 0.45, opr: 0.25, avgFuel: 0.15, avgSkill: 0.15 });

  const { data, isLoading, error } = useQuery({
    queryKey: ["stats", eventKey, weights],
    queryFn: () => api.stats(eventKey, weights),
    enabled: !!eventKey,
    refetchInterval: 20_000,
  });

  if (!eventKey) return <p className="text-slate-400">Select an event above to see stats.</p>;
  if (isLoading) return <p className="text-slate-400">Loading…</p>;
  if (error) return <p className="text-red-400">Couldn't load stats — is the server reachable?</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 font-semibold text-slate-100">Ranking weights</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(weights).map(([key, val]) => (
            <label key={key} className="flex flex-col gap-1 text-sm text-slate-300">
              {WEIGHT_LABELS[key] ?? key}: {val.toFixed(2)}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={val}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {data.matchesPlayed} played matches used for OPR/EPA · {data.teams.length} teams
        </p>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">EPA</th>
              <th className="px-3 py-2">OPR</th>
              <th className="px-3 py-2">Avg Fuel</th>
              <th className="px-3 py-2">Avg Climb</th>
              <th className="px-3 py-2">Avg Skill</th>
              <th className="px-3 py-2" title="Share of scouted matches where the alliance won auton">
                Auton W%
              </th>
              <th className="px-3 py-2" title="Share of scouted matches where this robot contributed in auton">
                Auton C%
              </th>
              <th className="px-3 py-2">Scouted</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => (
              <tr key={t.teamNumber} className="border-t border-slate-800 text-slate-200">
                <td className="px-3 py-2 text-slate-400">{t.rank}</td>
                <td className="px-3 py-2 font-medium">
                  {t.teamNumber} <span className="text-slate-500">{t.teamName}</span>
                </td>
                <td className="px-3 py-2">{t.epa.toFixed(1)}</td>
                <td className="px-3 py-2">{t.opr.toFixed(1)}</td>
                <td className="px-3 py-2">{t.avgFuel.toFixed(1)}</td>
                <td className="px-3 py-2">{t.avgClimb.toFixed(1)}</td>
                <td className="px-3 py-2">{t.avgSkill.toFixed(1)}</td>
                <td className="px-3 py-2">{t.autonWinRate.toFixed(0)}%</td>
                <td className="px-3 py-2">{t.autonContributionRate.toFixed(0)}%</td>
                <td className="px-3 py-2 text-slate-500">{t.matchesScoutedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
