import { useEffect, useState } from "react";
import type { AutonPath, AutonStroke, StartPosition } from "@frc-scout/shared";
import { DrawnField } from "./FieldBackdrop";

const EVENT_COLORS: Record<string, string> = {
  pickup: "#facc15",
  score: "#34d399",
  crossObstacle: "#818cf8",
};

/**
 * Drop a real field render here to replace the drawn fallback. Built via
 * BASE_URL (not a bare "/…" path) so it still resolves once deployed under
 * GitHub Pages' /Pastascout/ subpath instead of the domain root.
 */
const FIELD_IMAGE_URL = `${import.meta.env.BASE_URL}field-2026.webp`;

export const VIEW_W = 600;
/** Matches the field render's native 600x315 so the image isn't stretched. */
export const VIEW_H = 315;
/** The drawn fallback is authored against a 600x300 box; scale it to fit. */
const DRAWN_FIELD_SCALE_Y = VIEW_H / 300;

interface DraftPoint {
  x: number;
  y: number;
  t: number;
}

/**
 * The field backdrop plus a path's strokes/start/markers, shared by the
 * interactive drawing mapper (scout side) and the read-only viewer
 * (analyst side) so the two never drift out of sync visually.
 */
export function AutonPathView({
  svgRef,
  path,
  startPosition,
  flipped = false,
  draft,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  svgRef?: React.Ref<SVGSVGElement>;
  path: AutonPath;
  startPosition: StartPosition | null;
  flipped?: boolean;
  draft?: DraftPoint[] | null;
  className?: string;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<SVGSVGElement>) => void;
}) {
  const [hasFieldImage, setHasFieldImage] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasFieldImage(true);
    img.onerror = () => setHasFieldImage(false);
    img.src = FIELD_IMAGE_URL;
  }, []);

  const strokes = path.strokes ?? [];

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={className}
    >
      <g transform={flipped ? `rotate(180 ${VIEW_W / 2} ${VIEW_H / 2})` : undefined}>
        {hasFieldImage ? (
          <image href={FIELD_IMAGE_URL} x={0} y={0} width={VIEW_W} height={VIEW_H} preserveAspectRatio="none" />
        ) : (
          <g transform={`scale(1 ${DRAWN_FIELD_SCALE_Y})`}>
            <DrawnField />
          </g>
        )}

        {strokes.map((stroke, i) => (
          <StrokeLine key={`stroke-${i}`} stroke={stroke} />
        ))}
        {draft && draft.length > 1 && <StrokeLine stroke={{ points: draft }} draft />}

        {startPosition && (
          <g>
            <rect
              x={startPosition.x * VIEW_W - 9}
              y={startPosition.y * VIEW_H - 9}
              width={18}
              height={18}
              rx={3}
              fill="#34d399"
              stroke="#0f172a"
              strokeWidth={2}
            />
            <text
              x={startPosition.x * VIEW_W}
              y={startPosition.y * VIEW_H + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill="#0f172a"
              transform={flipped ? `rotate(180 ${startPosition.x * VIEW_W} ${startPosition.y * VIEW_H})` : undefined}
            >
              S
            </text>
          </g>
        )}

        {path.waypoints.map((wp, i) => (
          <g key={`marker-${i}`}>
            <circle
              cx={wp.x * VIEW_W}
              cy={wp.y * VIEW_H}
              r={8}
              fill={wp.eventType ? EVENT_COLORS[wp.eventType] : "#f8fafc"}
              stroke="#0f172a"
              strokeWidth={2}
            />
            <text
              x={wp.x * VIEW_W}
              y={wp.y * VIEW_H + 3.5}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill="#0f172a"
              transform={flipped ? `rotate(180 ${wp.x * VIEW_W} ${wp.y * VIEW_H})` : undefined}
            >
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Dark casing under a light line so the route stays readable over any field art. */
function StrokeLine({ stroke, draft = false }: { stroke: AutonStroke | { points: DraftPoint[] }; draft?: boolean }) {
  const d = stroke.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * VIEW_W} ${p.y * VIEW_H}`).join(" ");

  return (
    <g>
      <path d={d} fill="none" stroke="#0f172a" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={draft ? "#7dd3fc" : "#f8fafc"}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}
