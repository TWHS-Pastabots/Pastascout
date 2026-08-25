import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  GAME_CONFIG,
  chunkForQr,
  type Alliance,
  type AutonPath,
  type MatchScoutingEntry,
  type StartPosition,
} from "@frc-scout/shared";
import { Counter, LevelPicker, SkillSlider, Toggle } from "../components/FormControls";
import { AutonPathMapper } from "../components/AutonPathMapper";
import { QrCodeCarousel } from "../components/QrCode";
import { useAppStore } from "../state/appStore";
import { queueMatchScouting } from "../lib/db";
import { flushOutbox } from "../lib/sync";

/**
 * React Router reuses the same component instance when only the route params
 * change, which would carry one team's counts, path, and ratings straight into
 * the next team's form. Keying on the params forces a fresh mount — and a
 * blank form — for every match/team/alliance combination.
 */
export function MatchScoutingForm() {
  const { matchId = "", teamNumber = "", alliance = "red" } = useParams();
  return <MatchScoutingFormFields key={`${matchId}|${teamNumber}|${alliance}`} />;
}

function MatchScoutingFormFields() {
  const { matchId = "", teamNumber = "", alliance = "red" } = useParams();
  const navigate = useNavigate();
  const scoutName = useAppStore((s) => s.scoutName);

  const [startPosition, setStartPosition] = useState<StartPosition | null>(null);
  const [mobility, setMobility] = useState(false);
  const [autonFuel, setAutonFuel] = useState(0);
  const [autonClimb, setAutonClimb] = useState(0);
  const [wonAuton, setWonAuton] = useState(false);
  const [contributedToAuton, setContributedToAuton] = useState(false);

  const [teleopFuel, setTeleopFuel] = useState(0);
  const [bumpCrossings, setBumpCrossings] = useState(0);
  const [trenchCrossings, setTrenchCrossings] = useState(0);
  const [defensePlayed, setDefensePlayed] = useState(false);
  const [teleopClimb, setTeleopClimb] = useState(0);

  const [autonPath, setAutonPath] = useState<AutonPath>({ waypoints: [], strokes: [] });
  // Default each skill to the middle of the scale so an untouched rating is neutral.
  const [skillScores, setSkillScores] = useState<Record<string, number>>(
    Object.fromEntries(GAME_CONFIG.skillCategories.map((c) => [c.id, Math.round(GAME_CONFIG.skillScaleMax / 2)]))
  );

  const [penalties, setPenalties] = useState(0);
  const [brokeDown, setBrokeDown] = useState(false);
  const [excludeFromStats, setExcludeFromStats] = useState(false);
  const [notes, setNotes] = useState("");
  const [savedEntry, setSavedEntry] = useState<MatchScoutingEntry | null>(null);
  const [showQr, setShowQr] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const entry: MatchScoutingEntry = {
      id: crypto.randomUUID(),
      matchId,
      teamNumber: Number(teamNumber),
      alliance: alliance as Alliance,
      scoutName,
      createdAt: new Date().toISOString(),
      auton: {
        startPosition,
        mobility,
        fuelScored: autonFuel,
        towerClimbLevel: autonClimb === 1 ? 1 : 0,
        wonAuton,
        contributedToAuton,
      },
      teleop: {
        fuelScored: teleopFuel,
        bumpCrossings,
        trenchCrossings,
        defensePlayed,
        towerClimbLevel: teleopClimb as 0 | 1 | 2 | 3,
      },
      autonPath,
      skillRatings: Object.entries(skillScores).map(([categoryId, score]) => ({ categoryId, score })),
      penalties,
      brokeDown,
      notes,
      excludeFromStats,
    };

    await queueMatchScouting(entry);
    flushOutbox();
    setSavedEntry(entry);
  }

  if (savedEntry) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10 text-center">
        <div>
          <h1 className="text-xl font-bold text-green-400">Saved ✓</h1>
          <p className="mt-1 text-slate-400">
            Team {savedEntry.teamNumber}, match {savedEntry.matchId} — saved on this device and will sync
            automatically once you're online.
          </p>
        </div>

        {!showQr ? (
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="rounded-xl bg-slate-800 px-4 py-3 font-medium text-slate-200 hover:bg-slate-700"
          >
            No signal? Show QR backup
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">Have an analyst scan these, in order, with their phone.</p>
            <QrCodeCarousel chunks={chunkForQr(savedEntry, "match", savedEntry.id)} />
            <p className="text-xs text-slate-500">
              This is just a faster stopgap — your full entry still syncs normally once this phone reconnects.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate("/scout")}
          className="rounded-xl bg-green-600 px-4 py-3 text-lg font-semibold text-white hover:bg-green-500"
        >
          Done — back to matches
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">
          Team {teamNumber} <span className={alliance === "red" ? "text-red-400" : "text-blue-400"}>({alliance})</span>
        </h1>
        <p className="text-slate-400">Match {matchId}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-slate-200">Autonomous ({GAME_CONFIG.autonSeconds}s)</h2>
          <AutonPathMapper
            value={autonPath}
            onChange={setAutonPath}
            startPosition={startPosition}
            onStartPositionChange={setStartPosition}
          />
          <Toggle label="Mobility (left starting zone)" value={mobility} onChange={setMobility} />
          <Counter
            label="Fuel scored (auton)"
            value={autonFuel}
            onChange={setAutonFuel}
            increments={GAME_CONFIG.fuelIncrements}
          />
          <LevelPicker label="Tower climb (auton)" value={autonClimb} levels={[1]} onChange={setAutonClimb} />
          <Toggle label="Alliance won auton" value={wonAuton} onChange={setWonAuton} />
          <Toggle
            label="This robot contributed to auton"
            value={contributedToAuton}
            onChange={setContributedToAuton}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-slate-200">Teleop</h2>
          <Counter
            label="Fuel scored (teleop)"
            value={teleopFuel}
            onChange={setTeleopFuel}
            increments={GAME_CONFIG.fuelIncrements}
          />
          <Counter label="Bump crossings" value={bumpCrossings} onChange={setBumpCrossings} />
          <Counter label="Trench crossings" value={trenchCrossings} onChange={setTrenchCrossings} />
          <Toggle label="Played defense" value={defensePlayed} onChange={setDefensePlayed} />
          <LevelPicker
            label="Tower climb (teleop)"
            value={teleopClimb}
            levels={[...GAME_CONFIG.towerLevels]}
            onChange={setTeleopClimb}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-slate-200">Skills</h2>
          {GAME_CONFIG.skillCategories.map((cat) => (
            <SkillSlider
              key={cat.id}
              label={cat.label}
              max={GAME_CONFIG.skillScaleMax}
              value={skillScores[cat.id] ?? Math.round(GAME_CONFIG.skillScaleMax / 2)}
              onChange={(v) => setSkillScores((s) => ({ ...s, [cat.id]: v }))}
            />
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-slate-200">Other</h2>
          <Counter label="Penalties drawn" value={penalties} onChange={setPenalties} />
          <Toggle label="Robot broke down" value={brokeDown} onChange={setBrokeDown} />
          <div>
            <Toggle
              label="Exclude this report from stats"
              value={excludeFromStats}
              onChange={setExcludeFromStats}
            />
            <p className="mt-1 text-xs text-slate-500">
              Use this if something made the report unreliable — wrong robot, missed most of the match, etc. It
              still saves and stays visible to analysts, it just won't count toward this team's averages.
            </p>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes…"
            rows={3}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-green-500 focus:outline-none"
          />
        </section>

        <button
          type="submit"
          className="rounded-xl bg-green-600 px-4 py-3 text-lg font-semibold text-white hover:bg-green-500"
        >
          Save entry
        </button>
        <p className="text-center text-xs text-slate-500">
          Saves to this device immediately, even offline. Syncs to the server automatically when connected.
        </p>
      </form>
    </div>
  );
}
