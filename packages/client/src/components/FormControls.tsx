export function Counter({
  label,
  value,
  onChange,
  increments,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** Extra quick-add steps (e.g. [5, 10]) for counts that climb fast. */
  increments?: readonly number[];
}) {
  const bigSteps = (increments ?? []).filter((n) => n > 1);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, value - 1))}
            className="h-9 w-9 rounded-full bg-slate-800 text-lg font-bold text-slate-200 hover:bg-slate-700"
          >
            −
          </button>
          <span className="w-8 text-center text-lg font-semibold text-slate-100">{value}</span>
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className="h-9 w-9 rounded-full bg-slate-800 text-lg font-bold text-slate-200 hover:bg-slate-700"
          >
            +
          </button>
        </div>
      </div>

      {bigSteps.length > 0 && (
        <div className="mt-2 flex gap-2">
          {bigSteps.map((step) => (
            <button
              key={`minus-${step}`}
              type="button"
              onClick={() => onChange(Math.max(0, value - step))}
              className="flex-1 rounded-lg bg-slate-800 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700"
            >
              −{step}
            </button>
          ))}
          {bigSteps.map((step) => (
            <button
              key={`plus-${step}`}
              type="button"
              onClick={() => onChange(value + step)}
              className="flex-1 rounded-lg bg-green-900/60 py-1.5 text-xs font-medium text-green-300 hover:bg-green-800"
            >
              +{step}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium ${
        value ? "border-green-600 bg-green-950 text-green-300" : "border-slate-800 bg-slate-900 text-slate-300"
      }`}
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-green-500" : "bg-slate-700"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export function LevelPicker({
  label,
  value,
  levels,
  onChange,
}: {
  label: string;
  value: number;
  levels: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
      <div className="mb-2 text-sm font-medium text-slate-300">{label}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium ${
            value === 0 ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-400"
          }`}
        >
          None
        </button>
        {levels.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange(lvl)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium ${
              value === lvl ? "bg-green-600 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            L{lvl}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SkillSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const steps = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-300">
        <span>{label}</span>
        <span className="text-slate-400">
          {value}/{max}
        </span>
      </div>
      <div className="flex gap-1">
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} of ${max}`}
            onClick={() => onChange(n)}
            className={`h-9 flex-1 rounded text-[10px] font-semibold ${
              n <= value ? "bg-green-500 text-green-950" : "bg-slate-800 text-slate-600"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
