import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { suggestPickList, type PickStrategy, type TeamStatLine } from "@frc-scout/shared";
import { api } from "../lib/api";
import { useAppStore } from "../state/appStore";

const STRATEGIES: { id: PickStrategy; label: string; blurb: string }[] = [
  { id: "balanced", label: "Best overall", blurb: "Rank by raw contribution and reliability." },
  { id: "complement", label: "Fits our style", blurb: "Favor robots that cover what we're weak at." },
  { id: "mirror", label: "More of us", blurb: "Favor robots that play the game the way we do." },
  { id: "defensive", label: "Defensive partner", blurb: "Favor strong defenders over scorers." },
];

export function AnalystPickList() {
  const eventKey = useAppStore((s) => s.activeEventKey);
  const serverUrl = useAppStore((s) => s.serverUrl);
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["stats", eventKey, "picklist"],
    queryFn: () => api.stats(eventKey),
    enabled: !!eventKey,
  });
  const pickListQuery = useQuery({ queryKey: ["pick-list"], queryFn: api.pickList });

  const [order, setOrder] = useState<number[]>([]);
  useEffect(() => {
    if (pickListQuery.data) setOrder(pickListQuery.data);
  }, [pickListQuery.data]);

  // Our own team number lives server-side so every analyst laptop agrees on it.
  const [ourTeam, setOurTeam] = useState<string>("");
  useEffect(() => {
    api
      .getSetting("ourTeamNumber")
      .then((r) => setOurTeam(r.value ?? ""))
      .catch(() => {});
  }, []);

  const [strategy, setStrategy] = useState<PickStrategy>("complement");

  useEffect(() => {
    if (!serverUrl) return;
    const ws = new WebSocket(serverUrl.replace(/^http/, "ws") + "/ws");
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "pick-list-updated") queryClient.invalidateQueries({ queryKey: ["pick-list"] });
        if (msg.type === "match-scouting-updated") queryClient.invalidateQueries({ queryKey: ["stats"] });
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, [serverUrl, queryClient]);

  const dragIndex = useRef<number | null>(null);

  async function persist(next: number[]) {
    setOrder(next);
    await api.setPickList(next);
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex.current === null) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(targetIndex, 0, moved);
    dragIndex.current = null;
    persist(next);
  }

  async function saveOurTeam(value: string) {
    setOurTeam(value);
    try {
      await api.setSetting("ourTeamNumber", value);
    } catch {
      // offline — the number still applies locally for this session
    }
  }

  const teamsByNumber = useMemo(
    () => new Map(statsQuery.data?.teams.map((t) => [t.teamNumber, t]) ?? []),
    [statsQuery.data]
  );

  const suggestions = useMemo(() => {
    const teams = statsQuery.data?.teams;
    if (!teams?.length) return [];
    return suggestPickList({
      teams: teams as TeamStatLine[],
      ourTeamNumber: ourTeam ? Number(ourTeam) : null,
      strategy,
      excludeTeams: order,
    });
  }, [statsQuery.data, ourTeam, strategy, order]);

  if (!eventKey) return <p className="text-slate-400">Select an event above to build a pick list.</p>;

  const ourTeamMissing = ourTeam !== "" && !teamsByNumber.has(Number(ourTeam));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-300">Our team number</span>
            <input
              value={ourTeam}
              onChange={(e) => saveOurTeam(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 498"
              inputMode="numeric"
              className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-300">Strategy</span>
            <div className="flex flex-wrap gap-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrategy(s.id)}
                  title={s.blurb}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    strategy === s.id ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{STRATEGIES.find((s) => s.id === strategy)?.blurb}</p>
        {ourTeamMissing && (
          <p className="mt-2 text-xs text-amber-400">
            Team {ourTeam} isn't in this event's data, so "fits our style" falls back to ranking by contribution.
          </p>
        )}
        {!ourTeam && (strategy === "complement" || strategy === "mirror") && (
          <p className="mt-2 text-xs text-amber-400">
            Enter your team number above for this strategy to compare against your own robot.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-slate-100">Our pick list</h2>
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => persist([...order, ...suggestions.slice(0, 8).map((s) => s.teamNumber)])}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
              >
                Fill top 8
              </button>
            )}
          </div>
          <p className="mb-3 text-xs text-slate-500">Drag to reorder. Shared live with every analyst laptop.</p>
          <ol className="flex flex-col gap-2">
            {order.map((teamNumber, i) => {
              const t = teamsByNumber.get(teamNumber);
              return (
                <li
                  key={teamNumber}
                  draggable
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(i)}
                  className="flex cursor-grab items-center justify-between rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-slate-200"
                >
                  <span>
                    <span className="mr-2 text-slate-500">{i + 1}.</span>
                    {teamNumber} {t && <span className="text-slate-500">{t.teamName}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => persist(order.filter((n) => n !== teamNumber))}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    remove
                  </button>
                </li>
              );
            })}
            {order.length === 0 && <p className="text-sm text-slate-500">No teams picked yet.</p>}
          </ol>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-100">Suggested picks</h2>
          <p className="mb-3 text-xs text-slate-500">
            Ranked by EPA and OPR, adjusted for fit, reliability, and consistency. Tap to add.
          </p>

          {statsQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {!statsQuery.isLoading && suggestions.length === 0 && (
            <p className="text-sm text-slate-500">
              No teams left to suggest. Import an event and scout some matches to get recommendations.
            </p>
          )}

          <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={s.teamNumber}
                type="button"
                onClick={() => persist([...order, s.teamNumber])}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left hover:border-sky-600"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-200">
                    <span className="mr-2 text-slate-600">#{i + 1}</span>
                    {s.teamNumber} <span className="text-slate-500">{s.teamName}</span>
                  </span>
                  <span className="shrink-0 rounded bg-sky-950 px-2 py-0.5 text-xs font-semibold text-sky-300">
                    {s.score.toFixed(1)}
                  </span>
                </div>
                {s.reasons.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {s.reasons.map((r) => (
                      <li key={r} className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
                {s.warnings.map((w) => (
                  <p key={w} className="mt-1 text-[11px] text-amber-400">
                    ⚠ {w}
                  </p>
                ))}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
