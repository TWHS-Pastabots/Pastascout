/**
 * Field backdrop for the auton path mapper.
 *
 * Prefers a real field image dropped in at `public/field-2026.png` (see
 * README — we can't ship FIRST's official field render ourselves). When that
 * file isn't present it falls back to this drawn approximation of the REBUILT
 * field so the mapper is still usable out of the box.
 *
 * Everything is drawn in a 600x300 viewBox; waypoints are stored normalized
 * (0-1), so swapping the backdrop never invalidates existing scouting data.
 */

const GOLD = "#eab308";
const CARPET = "#6b7280";
const STRUCTURE = "#d1d5db";

function BallGrid({
  x,
  y,
  columns,
  rows,
  gap = 7,
}: {
  x: number;
  y: number;
  columns: number;
  rows: number;
  gap?: number;
}) {
  const balls = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      balls.push(<circle key={`${row}-${col}`} cx={x + col * gap} cy={y + row * gap} r={2.6} fill={GOLD} />);
    }
  }
  return <g>{balls}</g>;
}

/** The hexagonal hub each alliance shoots fuel into. */
function Hub({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-19} y={-19} width={38} height={38} fill="none" stroke={STRUCTURE} strokeWidth={3} />
      <circle r={15} fill="none" stroke={STRUCTURE} strokeWidth={3} />
      <polygon
        points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5"
        fill="#4b5563"
        stroke={STRUCTURE}
        strokeWidth={2}
      />
    </g>
  );
}

/** Yellow/black striped guardrail along the long edges of the field. */
function Guardrail({ y }: { y: number }) {
  const segments = [];
  for (let x = 0; x < 600; x += 26) {
    segments.push(<rect key={x} x={x} y={y} width={13} height={8} fill={GOLD} />);
  }
  return (
    <g>
      <rect x={0} y={y} width={600} height={8} fill="#1f2937" />
      {segments}
    </g>
  );
}

export function DrawnField() {
  return (
    <g>
      <rect x={0} y={0} width={600} height={300} fill={CARPET} />

      <Guardrail y={0} />
      <Guardrail y={292} />

      {/* Center line */}
      <line x1={300} y1={8} x2={300} y2={292} stroke="#e5e7eb" strokeWidth={2} />

      {/* Alliance ramps/zones */}
      <rect x={150} y={40} width={42} height={220} fill="#b91c1c" stroke="#e5e7eb" strokeWidth={2} />
      <rect x={408} y={40} width={42} height={220} fill="#1d4ed8" stroke="#e5e7eb" strokeWidth={2} />

      {/* Hubs */}
      <Hub x={171} y={150} />
      <Hub x={429} y={150} />

      {/* Center fuel depot */}
      <BallGrid x={248} y={92} columns={9} rows={17} />

      {/* Corner fuel stacks */}
      <BallGrid x={22} y={40} columns={5} rows={5} />
      <BallGrid x={22} y={228} columns={5} rows={5} />
      <BallGrid x={545} y={40} columns={5} rows={5} />
      <BallGrid x={545} y={228} columns={5} rows={5} />

      {/* Trenches / end structures */}
      <rect x={8} y={120} width={34} height={60} fill="none" stroke="#111827" strokeWidth={3} />
      <rect x={558} y={120} width={34} height={60} fill="none" stroke="#111827" strokeWidth={3} />

      {/* Towers at the field ends */}
      <rect x={92} y={128} width={16} height={44} fill="#9ca3af" stroke="#e5e7eb" strokeWidth={2} />
      <rect x={492} y={128} width={16} height={44} fill="#9ca3af" stroke="#e5e7eb" strokeWidth={2} />
    </g>
  );
}
