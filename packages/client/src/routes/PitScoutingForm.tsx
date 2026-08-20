import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { chunkForQr, type PitScoutingEntry } from "@frc-scout/shared";
import { useAppStore } from "../state/appStore";
import { queuePitScouting } from "../lib/db";
import { flushOutbox } from "../lib/sync";
import { Toggle } from "../components/FormControls";
import { PhotoUpload } from "../components/PhotoUpload";
import { QrCodeCarousel } from "../components/QrCode";

/** Keyed on the team so switching teams gives a blank form (see MatchScoutingForm). */
export function PitScoutingForm() {
  const { teamNumber = "" } = useParams();
  return <PitScoutingFormFields key={teamNumber} />;
}

function PitScoutingFormFields() {
  const { teamNumber = "" } = useParams();
  const navigate = useNavigate();
  const scoutName = useAppStore((s) => s.scoutName);

  const [drivetrainType, setDrivetrainType] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [autonCapabilities, setAutonCapabilities] = useState("");
  const [canClimbLevels, setCanClimbLevels] = useState<number[]>([]);
  const [canGoUnderTrench, setCanGoUnderTrench] = useState(false);
  const [fuelCapacity, setFuelCapacity] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [savedEntry, setSavedEntry] = useState<PitScoutingEntry | null>(null);
  const [showQr, setShowQr] = useState(false);

  function toggleClimbLevel(level: number) {
    setCanClimbLevels((levels) => (levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const entry: PitScoutingEntry = {
      id: crypto.randomUUID(),
      teamNumber: Number(teamNumber),
      scoutName,
      createdAt: new Date().toISOString(),
      drivetrainType,
      weightLbs: weightLbs ? Number(weightLbs) : undefined,
      autonCapabilities,
      canClimbLevels: canClimbLevels as (1 | 2 | 3)[],
      canGoUnderTrench,
      fuelCapacity: fuelCapacity ? Number(fuelCapacity) : undefined,
      photos,
      notes,
    };

    await queuePitScouting(entry);
    flushOutbox();
    setSavedEntry(entry);
  }

  if (savedEntry) {
    // Photos are excluded from the QR payload — even one compressed photo is
    // far too big for a scannable code. They still sync normally once this
    // phone reconnects, same as everything else; the QR is just a fast-path.
    const qrPayload = { ...savedEntry, photos: [] };

    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10 text-center">
        <div>
          <h1 className="text-xl font-bold text-emerald-400">Saved ✓</h1>
          <p className="mt-1 text-slate-400">
            Team {savedEntry.teamNumber} — saved on this device and will sync automatically once you're online.
          </p>
        </div>

        {!showQr ? (
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="rounded-xl bg-slate-800 px-4 py-3 font-medium text-slate-200 hover:bg-slate-700"
          >
            📱 No signal? Show QR backup
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">Have an analyst scan these, in order, with their phone.</p>
            <QrCodeCarousel chunks={chunkForQr(qrPayload, "pit", savedEntry.id)} />
            {savedEntry.photos.length > 0 && (
              <p className="text-xs text-amber-400">
                {savedEntry.photos.length} photo(s) aren't included — those sync over the network only.
              </p>
            )}
            <p className="text-xs text-slate-500">
              This is just a faster stopgap — your full entry still syncs normally once this phone reconnects.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate("/scout/pit")}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-500"
        >
          Done — back to teams
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-bold text-slate-100">Pit scouting · Team {teamNumber}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Drivetrain type</span>
          <input
            value={drivetrainType}
            onChange={(e) => setDrivetrainType(e.target.value)}
            placeholder="e.g. Swerve, West Coast Drive"
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-300">Robot weight (lbs)</span>
            <input
              type="number"
              min={0}
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-300">Fuel capacity (balls)</span>
            <input
              type="number"
              min={0}
              value={fuelCapacity}
              onChange={(e) => setFuelCapacity(e.target.value)}
              placeholder="How many can it hold?"
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>

        <Toggle label="Can go under the Trench" value={canGoUnderTrench} onChange={setCanGoUnderTrench} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Auton capabilities</span>
          <textarea
            value={autonCapabilities}
            onChange={(e) => setAutonCapabilities(e.target.value)}
            rows={2}
            placeholder="What can they do in auton? How many paths?"
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
          <div className="mb-2 text-sm font-medium text-slate-300">Claims it can climb to</div>
          <div className="flex gap-2">
            {[1, 2, 3].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => toggleClimbLevel(lvl)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium ${
                  canClimbLevels.includes(lvl) ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                Level {lvl}
              </button>
            ))}
          </div>
        </div>

        <PhotoUpload photos={photos} onChange={setPhotos} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-500"
        >
          Save
        </button>
      </form>
    </div>
  );
}
