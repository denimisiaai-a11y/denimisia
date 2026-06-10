import type { ShirtFit, SilhouetteData } from '../types';
import {
  SHIRT_HEM_TO_LANDMARK,
  SHIRT_SLEEVE_TO_LANDMARK,
  SHIRT_NECKLINE_DEPTH,
  SHIRT_BODY_WIDTH_SCALE,
} from '../presets/shirt-presets';

interface ShirtOverlayProps {
  silhouette: SilhouetteData;
  fit: ShirtFit;
  editable?: boolean;
}

const CENTER_X = 100;
const SHOULDER_WIDTH = 70;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ShirtOverlay({ silhouette, fit }: ShirtOverlayProps) {
  const widthScale = clamp(
    (fit.offsets?.bodyWidthScale ?? 1) * SHIRT_BODY_WIDTH_SCALE[fit.bodyFit],
    0.85,
    1.30,
  );
  const halfWidth = (SHOULDER_WIDTH / 2) * widthScale;

  const shoulderY = silhouette.landmarks.shoulder.y + (fit.offsets?.topY ?? 0);
  const hemY =
    silhouette.landmarks[SHIRT_HEM_TO_LANDMARK[fit.hem]].y +
    (fit.offsets?.hemY ?? 0);
  const sleeveEndY =
    silhouette.landmarks[SHIRT_SLEEVE_TO_LANDMARK[fit.sleeve]].y +
    (fit.offsets?.sleeveEndY ?? 0);

  const necklineDepth = SHIRT_NECKLINE_DEPTH[fit.neckline];
  const necklineY = silhouette.landmarks.collar.y + necklineDepth;

  const sleeveLM = silhouette.landmarks[SHIRT_SLEEVE_TO_LANDMARK[fit.sleeve]];
  const sleeveOuterLeft =
    sleeveLM.x !== undefined ? sleeveLM.x : CENTER_X - halfWidth;
  const sleeveOuterRight =
    sleeveLM.x !== undefined ? 200 - sleeveLM.x : CENTER_X + halfWidth;

  const d = [
    `M ${CENTER_X - halfWidth * 0.4} ${silhouette.landmarks.collar.y}`,
    `L ${CENTER_X - halfWidth} ${shoulderY}`,
    `L ${sleeveOuterLeft} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 6} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 6} ${hemY}`,
    `L ${CENTER_X + halfWidth - 6} ${hemY}`,
    `L ${CENTER_X + halfWidth - 6} ${sleeveEndY}`,
    `L ${sleeveOuterRight} ${sleeveEndY}`,
    `L ${CENTER_X + halfWidth} ${shoulderY}`,
    `L ${CENTER_X + halfWidth * 0.4} ${silhouette.landmarks.collar.y}`,
    `L ${CENTER_X + halfWidth * 0.3} ${necklineY}`,
    `L ${CENTER_X - halfWidth * 0.3} ${necklineY}`,
    'Z',
  ].join(' ');

  return (
    <path
      d={d}
      fill="#374151"
      stroke="#1f2937"
      strokeWidth={0.6}
      opacity={0.92}
    />
  );
}
