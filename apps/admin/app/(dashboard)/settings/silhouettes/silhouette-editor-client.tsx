'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { LandmarkName, SilhouetteData } from '@repo/fit-engine';
import { adminFetch } from '@/lib/api';

const LANDMARK_NAMES: LandmarkName[] = [
  'collar',
  'shoulder',
  'armpit',
  'bicep',
  'elbow',
  'midForearm',
  'wrist',
  'highWaist',
  'naturalWaist',
  'lowWaist',
  'hip',
  'crotch',
  'midThigh',
  'knee',
  'midCalf',
  'ankle',
];

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export function SilhouetteEditorClient() {
  const { data: session } = useSession();
  const token =
    (session as { accessToken?: string } | null)?.accessToken ?? undefined;

  const [silhouettes, setSilhouettes] = useState<SilhouetteData[] | null>(null);
  const [selectedGender, setSelectedGender] = useState<'MALE' | 'FEMALE'>(
    'FEMALE',
  );
  const [draft, setDraft] = useState<SilhouetteData | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/silhouettes`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((body: unknown) => {
        if (cancelled) return;
        const rows = Array.isArray(body)
          ? (body as SilhouetteData[])
          : ((body as { data?: SilhouetteData[] }).data ?? []);
        setSilhouettes(rows);
        const initial = rows.find((s) => s.gender === selectedGender);
        if (initial) setDraft(initial);
      })
      .catch(() => {
        if (!cancelled) setSilhouettes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGender]);

  const dragPin = useCallback((landmark: LandmarkName, deltaY: number) => {
    setDraft((d) => {
      if (!d) return d;
      const current = d.landmarks[landmark];
      return {
        ...d,
        landmarks: {
          ...d.landmarks,
          [landmark]: { ...current, y: Math.round(current.y + deltaY) },
        },
      };
    });
  }, []);

  const onSave = async () => {
    if (!draft || !token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminFetch<SilhouetteData>(
        `/admin/silhouettes/${draft.gender}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({ landmarks: draft.landmarks }),
        },
      );
      setSilhouettes((arr) =>
        arr ? arr.map((s) => (s.id === updated.id ? updated : s)) : [updated],
      );
      setDraft(updated);
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!silhouettes) return <p className="text-sm text-secondary">Loading…</p>;
  if (!draft)
    return <p className="text-sm text-secondary">No silhouette selected.</p>;

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-2">
        {silhouettes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedGender(s.gender)}
            className={`w-full px-3 py-2 rounded text-left text-sm ${
              selectedGender === s.gender
                ? 'bg-on-surface text-surface'
                : 'border border-outline-variant'
            }`}
          >
            {s.gender === 'FEMALE' ? 'Women' : 'Men'}{' '}
            <span className="text-xs opacity-70">v{s.version}</span>
          </button>
        ))}
      </aside>

      <section className="space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-secondary">
          Editing {selectedGender === 'FEMALE' ? 'Women' : 'Men'} silhouette —
          version {draft.version}. Drag red pins vertically to set landmark
          positions.
        </p>

        <div className="grid grid-cols-[240px_1fr] gap-6 items-start">
          <svg
            width={240}
            height={400}
            viewBox={draft.viewBox}
            className="border border-outline-variant rounded bg-surface"
          >
            <path
              d={draft.svgPath}
              fill="#e6e6e6"
              stroke="#999"
              strokeWidth={0.8}
            />
            {LANDMARK_NAMES.map((name) => {
              const point = draft.landmarks[name];
              if (!point) return null;
              return (
                <g key={name}>
                  <line
                    x1={60}
                    y1={point.y}
                    x2={140}
                    y2={point.y}
                    stroke="#c00"
                    strokeDasharray="2 2"
                    strokeWidth={0.8}
                  />
                  <DraggablePin
                    cx={60}
                    cy={point.y}
                    onDelta={(d) => dragPin(name, d)}
                    ariaLabel={`Adjust ${name}`}
                  />
                  <text
                    x={146}
                    y={point.y + 3}
                    fontSize={9}
                    fontWeight={700}
                    fill="#c00"
                  >
                    {name}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="text-xs space-y-2">
            <p className="text-secondary">
              Landmark Y positions (relative to the SVG viewBox):
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
              {LANDMARK_NAMES.map((name) => (
                <div key={name} className="flex justify-between">
                  <span>{name}</span>
                  <span className="text-secondary">
                    y = {draft.landmarks[name]?.y ?? '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 space-x-2">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="px-4 py-2 bg-on-surface text-surface text-[11px] tracking-widest rounded disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save landmarks'}
              </button>
              {savedAt && (
                <span className="text-[10px] text-secondary">
                  Saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 mt-2">Error: {error}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

interface DraggablePinProps {
  cx: number;
  cy: number;
  ariaLabel: string;
  onDelta: (deltaY: number) => void;
}

function DraggablePin({ cx, cy, ariaLabel, onDelta }: DraggablePinProps) {
  const onPointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    const startY = e.clientY;
    const target = e.target as SVGCircleElement;
    target.setPointerCapture(e.pointerId);
    const onMove = (mv: PointerEvent) => {
      const delta = mv.clientY - startY;
      target.setAttribute('cy', String(cy + delta));
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onDelta(up.clientY - startY);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#fff"
      stroke="#c00"
      strokeWidth={2}
      style={{ cursor: 'ns-resize' }}
      role="slider"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
    />
  );
}
