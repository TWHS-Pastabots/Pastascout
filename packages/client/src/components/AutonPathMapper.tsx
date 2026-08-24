import { useEffect, useRef, useState } from "react";
import type { AutonPath, StartPosition } from "@frc-scout/shared";
import { GAME_CONFIG, simplifyPath } from "@frc-scout/shared";
import { AutonPathView } from "./AutonPathView";

/** Minimum gap between captured points, in normalized units — throttles raw pointer noise. */
const MIN_POINT_GAP = 0.004;
/** RDP tolerance applied when a stroke finishes. */
const SIMPLIFY_TOLERANCE = 0.005;

type Mode = "start" | "draw";

interface DraftPoint {
  x: number;
  y: number;
  t: number;
}

export function AutonPathMapper({
  value,
  onChange,
  startPosition,
  onStartPositionChange,
}: {
  value: AutonPath;
  onChange: (p: AutonPath) => void;
  startPosition: StartPosition | null;
  onStartPositionChange: (p: StartPosition) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<Mode>("start");
  const [flipped, setFlipped] = useState(false);
  const [draft, setDraft] = useState<DraftPoint[] | null>(null);

  const startRef = useRef<number>(0);
  const drawingRef = useRef<DraftPoint[] | null>(null);
  const elapsedRef = useRef(0);

  const strokes = value.strokes ?? [];

  // Kept in a ref so pointer handlers read the live time without re-subscribing.
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000;
      if (t >= GAME_CONFIG.autonSeconds) {
        setElapsed(GAME_CONFIG.autonSeconds);
        setRunning(false);
        clearInterval(id);
      } else {
        setElapsed(t);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  function startTimer() {
    startRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
    setMode("draw");
  }

  /** Screen coords → normalized field coords, undoing the flip if it's on. */
  function toFieldCoords(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    let x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    let y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    if (flipped) {
      x = 1 - x;
      y = 1 - y;
    }
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const { x, y } = toFieldCoords(e.clientX, e.clientY);

    if (mode === "start") {
      onStartPositionChange({ x, y });
      setMode("draw");
      return;
    }

    // draw
    e.currentTarget.setPointerCapture(e.pointerId);
    const first = { x, y, t: Math.round(elapsedRef.current * 10) / 10 };
    drawingRef.current = [first];
    setDraft([first]);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const current = drawingRef.current;
    if (!current) return;

    const { x, y } = toFieldCoords(e.clientX, e.clientY);
    const last = current[current.length - 1];
    if (Math.hypot(x - last.x, y - last.y) < MIN_POINT_GAP) return;

    current.push({ x, y, t: Math.round(elapsedRef.current * 10) / 10 });
    setDraft([...current]);
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const current = drawingRef.current;
    drawingRef.current = null;
    setDraft(null);
    if (!current) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    // A tap (rather than a drag) leaves a single point — nothing to record.
    if (current.length < 2) return;

    const simplified = simplifyPath(current, SIMPLIFY_TOLERANCE);
    onChange({ ...value, waypoints: value.waypoints, strokes: [...strokes, { points: simplified }] });
  }

  function undoStroke() {
    onChange({ ...value, strokes: strokes.slice(0, -1) });
  }

  function clearAll() {
    onChange({ waypoints: [], strokes: [] });
  }

  const totalPoints = strokes.reduce((sum, s) => sum + s.points.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={startTimer}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          {running ? `Auton running: ${elapsed.toFixed(1)}s` : "Start auton timer"}
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setFlipped((f) => !f)} className="text-sm text-slate-400 hover:text-slate-200">
            Flip view
          </button>
          <button
            type="button"
            onClick={undoStroke}
            disabled={strokes.length === 0}
            className="text-sm text-slate-400 hover:text-slate-200 disabled:text-slate-700"
          >
            Undo line
          </button>
          <button type="button" onClick={clearAll} className="text-sm text-slate-400 hover:text-slate-200">
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <ModeButton active={mode === "start"} onClick={() => setMode("start")} activeClass="bg-emerald-400 text-emerald-950">
          {startPosition ? "Move start" : "Set start"}
        </ModeButton>
        <ModeButton active={mode === "draw"} onClick={() => setMode("draw")} activeClass="bg-sky-400 text-sky-950">
          Draw path
        </ModeButton>
      </div>

      <p className="text-xs text-slate-500">
        {mode === "start" && "Tap the field where the robot started."}
        {mode === "draw" && "Drag across the field to trace the robot's route. Each drag adds one line."}
      </p>

      <AutonPathView
        svgRef={svgRef}
        path={value}
        startPosition={startPosition}
        flipped={flipped}
        draft={draft}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full touch-none select-none rounded-lg border border-slate-700 ${
          mode === "draw" ? "cursor-cell" : "cursor-crosshair"
        }`}
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {strokes.length} line{strokes.length === 1 ? "" : "s"} · {value.waypoints.length} marker
          {value.waypoints.length === 1 ? "" : "s"}
          {totalPoints > 0 && ` · ${totalPoints} pts`}
        </span>
      </div>

      {value.waypoints.length > 0 && (
        <ul className="flex max-h-28 flex-col gap-1 overflow-y-auto text-xs text-slate-400">
          {value.waypoints.map((wp, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>
                #{i + 1} · t={wp.t}s {wp.eventType ? `· ${wp.eventType}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...value, waypoints: value.waypoints.filter((_, j) => j !== i) })}
                className="text-red-400 hover:text-red-300"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  activeClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-medium ${active ? activeClass : "bg-slate-800 text-slate-400"}`}
    >
      {children}
    </button>
  );
}
