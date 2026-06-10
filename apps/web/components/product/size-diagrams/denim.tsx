import { cn } from '@/lib/utils';
import type { Rise } from '@/lib/size-charts';

interface DenimDiagramProps {
  rise?: Rise | null;
}

// Anatomical Y-coordinates calibrated to the source image (596x846).
// SVG viewBox uses the image's native dimensions so overlays register precisely.
const BODY = {
  naturalWaistY: 285,  // narrowest point of torso — HIGH WAIST
  navelY: 320,         // just below natural waist — MID RISE
  hipBoneY: 360,       // top of hip flare — LOW RISE
  fullestHipY: 440,    // widest point — where we measure "hip"
  crotchY: 500,
  ankleY: 820,
  centerX: 298,
  // Body edges at landmark heights
  waistLeftX: 250,
  waistRightX: 348,
  hipLeftX: 218,
  hipRightX: 378,
  ankleLeftX: 280,
  ankleRightX: 320,
};

const RISE_LINES: Record<Rise, { y: number; label: string; sublabel: string }> = {
  'high-waist': { y: BODY.naturalWaistY, label: 'High Waist', sublabel: 'Above navel — natural waistline' },
  'mid-rise': { y: BODY.navelY, label: 'Mid Rise', sublabel: 'At the navel' },
  'low-rise': { y: BODY.hipBoneY, label: 'Low Rise', sublabel: 'Below navel — on the hips' },
};

export function DenimDiagram({ rise }: DenimDiagramProps) {
  const activeRise = rise ?? null;

  return (
    <div className="flex flex-col items-center gap-5">
      <svg
        viewBox="0 0 900 846"
        className="h-auto w-full max-w-[560px]"
        aria-label="Denim fit diagram — body outline with rise position markers"
      >
        <defs>
          <marker id="arrow-denim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
          </marker>
        </defs>

        {/* Body outline image (user-supplied) */}
        <image
          href="/images/size-guide-denim.png"
          x="150"
          y="0"
          width="596"
          height="846"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Rise guide lines — three horizontal dashed lines across body */}
        {(Object.entries(RISE_LINES) as [Rise, (typeof RISE_LINES)[Rise]][]).map(([key, { y, label, sublabel }]) => {
          const isActive = activeRise === key;
          const opacity = activeRise == null ? 1 : isActive ? 1 : 0.28;
          const color = isActive ? '#dc2626' : '#0a0a0a';
          const lineY = y;
          return (
            <g key={key} style={{ opacity }}>
              {/* Line across body */}
              <line
                x1={150 + BODY.waistLeftX - 20}
                y1={lineY}
                x2={150 + BODY.waistRightX + 20}
                y2={lineY}
                stroke={color}
                strokeWidth={isActive ? 2 : 1.2}
                strokeDasharray={isActive ? '0' : '5 4'}
              />
              {/* Connector out to label */}
              <line
                x1={150 + BODY.waistRightX + 20}
                y1={lineY}
                x2={770}
                y2={lineY}
                stroke={color}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {/* Label */}
              <text x="778" y={lineY - 4} fill={color} fontSize="16" fontWeight={isActive ? 700 : 600} letterSpacing="0.08em">
                {label.toUpperCase()}
              </text>
              <text x="778" y={lineY + 14} fill="#737373" fontSize="12">
                {sublabel}
              </text>
            </g>
          );
        })}

        {/* Measurement arrows on the LEFT side of the figure */}

        {/* WAIST — horizontal arrow near natural waist */}
        <g stroke="#dc2626" strokeWidth="1.2" fill="none">
          <line x1="60" y1={BODY.naturalWaistY} x2="135" y2={BODY.naturalWaistY} markerStart="url(#arrow-denim)" markerEnd="url(#arrow-denim)" />
        </g>
        <text x="22" y={BODY.naturalWaistY - 6} fill="#dc2626" fontSize="14" fontWeight="700" letterSpacing="0.08em">
          WAIST
        </text>
        <text x="22" y={BODY.naturalWaistY + 11} fill="#737373" fontSize="10">
          at natural line
        </text>

        {/* HIP — horizontal arrow at fullest hip */}
        <g stroke="#dc2626" strokeWidth="1.2" fill="none">
          <line x1="60" y1={BODY.fullestHipY} x2="135" y2={BODY.fullestHipY} markerStart="url(#arrow-denim)" markerEnd="url(#arrow-denim)" />
        </g>
        <text x="22" y={BODY.fullestHipY - 6} fill="#dc2626" fontSize="14" fontWeight="700" letterSpacing="0.08em">
          HIP
        </text>
        <text x="22" y={BODY.fullestHipY + 11} fill="#737373" fontSize="10">
          fullest part
        </text>

        {/* INSEAM — vertical arrow from crotch to ankle */}
        <g stroke="#dc2626" strokeWidth="1.2" fill="none">
          <line x1="100" y1={BODY.crotchY} x2="100" y2={BODY.ankleY} markerStart="url(#arrow-denim)" markerEnd="url(#arrow-denim)" />
        </g>
        <text
          x="60"
          y={(BODY.crotchY + BODY.ankleY) / 2}
          fill="#dc2626"
          fontSize="14"
          fontWeight="700"
          letterSpacing="0.08em"
          transform={`rotate(-90 60 ${(BODY.crotchY + BODY.ankleY) / 2})`}
        >
          INSEAM
        </text>
      </svg>

      {/* Legend strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px]">
        {(Object.entries(RISE_LINES) as [Rise, (typeof RISE_LINES)[Rise]][]).map(([key, { label }]) => {
          const isActive = activeRise === key;
          return (
            <div key={key} className={cn('flex items-center gap-2', activeRise && !isActive && 'opacity-30')}>
              <span
                className={cn('block h-[2px] w-7', isActive ? 'bg-red-600' : 'bg-ink')}
                style={{
                  backgroundImage: isActive ? 'none' : 'repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 8px)',
                }}
              />
              <span className={cn('uppercase tracking-[0.1em]', isActive ? 'font-semibold text-red-600' : 'text-ink')}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {activeRise && (
        <p className="max-w-md text-center text-[12px] leading-relaxed text-muted">
          This product is{' '}
          <strong className="text-ink">{RISE_LINES[activeRise].label.toLowerCase()}</strong>{' '}
          — {RISE_LINES[activeRise].sublabel.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
