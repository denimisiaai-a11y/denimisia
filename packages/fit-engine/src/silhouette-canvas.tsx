import type { FitLandmarks, GarmentOffsets, SilhouetteData } from './types';
import { PantsOverlay } from './overlays/pants';
import { ShirtOverlay } from './overlays/shirt';
import { JacketOverlay } from './overlays/jacket';
import { DragHandleSet } from './drag-handles';
import {
  PANTS_RISE_TO_LANDMARK,
  PANTS_HEM_TO_LANDMARK,
} from './presets/pants-presets';
import { SHIRT_HEM_TO_LANDMARK } from './presets/shirt-presets';
import { JACKET_HEM_TO_LANDMARK } from './presets/jacket-presets';

interface SilhouetteCanvasCallout {
  landmarkY: number;
  label: string;
}

interface SilhouetteCanvasProps {
  silhouette: SilhouetteData;
  fit: FitLandmarks | null;
  callouts?: SilhouetteCanvasCallout[];
  editable?: boolean;
  onOffsetsChange?: (next: GarmentOffsets) => void;
  width?: number;
  height?: number;
}

function dragAnchors(
  silhouette: SilhouetteData,
  fit: FitLandmarks,
): { topY: number; hemY: number } {
  if (fit.kind === 'PANTS') {
    return {
      topY:
        silhouette.landmarks[PANTS_RISE_TO_LANDMARK[fit.rise]].y +
        (fit.offsets?.topY ?? 0),
      hemY:
        silhouette.landmarks[PANTS_HEM_TO_LANDMARK[fit.hem]].y +
        (fit.offsets?.hemY ?? 0),
    };
  }
  if (fit.kind === 'SHIRTS') {
    return {
      topY: silhouette.landmarks.shoulder.y + (fit.offsets?.topY ?? 0),
      hemY:
        silhouette.landmarks[SHIRT_HEM_TO_LANDMARK[fit.hem]].y +
        (fit.offsets?.hemY ?? 0),
    };
  }
  return {
    topY: silhouette.landmarks.shoulder.y + (fit.offsets?.topY ?? 0),
    hemY:
      silhouette.landmarks[JACKET_HEM_TO_LANDMARK[fit.hem]].y +
      (fit.offsets?.hemY ?? 0),
  };
}

export function SilhouetteCanvas({
  silhouette,
  fit,
  callouts = [],
  editable = false,
  onOffsetsChange,
  width = 220,
  height = 380,
}: SilhouetteCanvasProps) {
  const showHandles = editable && fit !== null && onOffsetsChange !== undefined;
  const handleAnchors = showHandles && fit ? dragAnchors(silhouette, fit) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={silhouette.viewBox}
      role="img"
      aria-label={`${silhouette.gender.toLowerCase()} silhouette with garment overlay`}
    >
      <path
        d={silhouette.svgPath}
        fill="#e6e6e6"
        stroke="#999"
        strokeWidth={0.8}
      />

      {fit?.kind === 'PANTS' && (
        <PantsOverlay silhouette={silhouette} fit={fit} editable={editable} />
      )}
      {fit?.kind === 'SHIRTS' && (
        <ShirtOverlay silhouette={silhouette} fit={fit} editable={editable} />
      )}
      {fit?.kind === 'JACKETS' && (
        <JacketOverlay silhouette={silhouette} fit={fit} editable={editable} />
      )}

      {callouts.map((c, i) => (
        <g key={`callout-${i}`}>
          <line
            x1={64}
            y1={c.landmarkY}
            x2={80}
            y2={c.landmarkY}
            stroke="#c00"
            strokeWidth={1.5}
          />
          <line
            x1={120}
            y1={c.landmarkY}
            x2={136}
            y2={c.landmarkY}
            stroke="#c00"
            strokeWidth={1.5}
          />
          <text
            x={142}
            y={c.landmarkY + 3}
            fontSize={9}
            fontWeight={700}
            fill="#c00"
          >
            {c.label}
          </text>
        </g>
      ))}

      {showHandles && fit && handleAnchors && onOffsetsChange && (
        <DragHandleSet
          topY={handleAnchors.topY}
          hemY={handleAnchors.hemY}
          offsets={fit.offsets ?? {}}
          onOffsetsChange={onOffsetsChange}
        />
      )}
    </svg>
  );
}
