import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../state/appStore";

export function RoleGate() {
  const navigate = useNavigate();
  const setRole = useAppStore((s) => s.setRole);
  const setScoutName = useAppStore((s) => s.setScoutName);
  const scoutName = useAppStore((s) => s.scoutName);
  const [nameInput, setNameInput] = useState(scoutName);

  function chooseScout() {
    if (!nameInput.trim()) return;
    setScoutName(nameInput.trim());
    setRole("scout");
    navigate("/scout");
  }

  function chooseAnalyst() {
    setRole("analyst");
    navigate("/analyst");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-4 py-12">
      <div className="flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}pastabots-logo.png`} alt="" className="h-14 w-14" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Pastabots <span className="text-red-500">Scouting</span>
          </h1>
          <p className="mt-1 text-slate-400">Pick how you're using the app.</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">I'm scouting</h2>
        <p className="mt-1 text-sm text-slate-400">Enter your name so your entries are attributed to you.</p>
        <input
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-green-500 focus:outline-none"
          placeholder="Your name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <button
          onClick={chooseScout}
          disabled={!nameInput.trim()}
          className="mt-3 w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          Start scouting
        </button>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">I'm analyzing</h2>
        <p className="mt-1 text-sm text-slate-400">Dashboard, pick list, OPR/EPA, and TBA import.</p>
        <button
          onClick={chooseAnalyst}
          className="mt-3 w-full rounded-lg bg-slate-700 px-4 py-2 font-medium text-white hover:bg-slate-600"
        >
          Open dashboard
        </button>
      </section>
    </div>
  );
}
