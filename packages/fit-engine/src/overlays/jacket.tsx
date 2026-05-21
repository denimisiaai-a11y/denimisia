import type { JacketFit, SilhouetteData } from '../types';
import {
  JACKET_HEM_TO_LANDMARK,
  JACKET_SLEEVE_TO_LANDMARK,
  JACKET_BODY_WIDTH_SCALE,
} from '../presets/jacket-presets';

interface JacketOverlayProps {
  silhouette: SilhouetteData;
  fit: JacketFit;
  editable?: boolean;
}

const CENTER_X = 100;
const SHOULDER_WIDTH = 76;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function JacketOverlay({ silhouette, fit }: JacketOverlayProps) {
  const widthScale = clamp(
    (fit.offsets?.bodyWidthScale ?? 1) * JACKET_BODY_WIDTH_SCALE[fit.bodyFit],
    0.95,
    1.35,
  );
  const halfWidth = (SHOULDER_WIDTH / 2) * widthScale;

  const shoulderY = silhouette.landmarks.shoulder.y + (fit.offsets?.topY ?? 0);
  const hemY =
    silhouette.landmarks[JACKET_HEM_TO_LANDMARK[fit.hem]].y +
    (fit.offsets?.hemY ?? 0);
  const sleeveEndY =
    silhouette.landmarks[JACKET_SLEEVE_TO_LANDMARK[fit.sleeve]].y +
    (fit.offsets?.sleeveEndY ?? 0);

  const sleeveLM = silhouette.landmarks[JACKET_SLEEVE_TO_LANDMARK[fit.sleeve]];
  const sleeveOuterLeft =
    sleeveLM.x !== undefined ? sleeveLM.x - 4 : CENTER_X - halfWidth - 4;
  const sleeveOuterRight =
    sleeveLM.x !== undefined ? 200 - sleeveLM.x + 4 : CENTER_X + halfWidth + 4;

  const isOpen = fit.closure === 'drape';
  const centerGap = isOpen ? 8 : 0;

  const d = [
    `M ${CENTER_X - halfWidth * 0.45} ${silhouette.landmarks.collar.y}`,
    `L ${CENTER_X - halfWidth} ${shoulderY}`,
    `L ${sleeveOuterLeft} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 8} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 6} ${hemY}`,
    `L ${CENTER_X - centerGap / 2} ${hemY}`,
    `L ${CENTER_X - centerGap / 2} ${silhouette.landmarks.collar.y + 6}`,
    `L ${CENTER_X + centerGap / 2} ${silhouette.landmarks.collar.y + 6}`,
    `L ${CENTER_X + centerGap / 2} ${hemY}`,
    `L ${CENTER_X + halfWidth - 6} ${hemY}`,
    `L ${CENTER_X + halfWidth - 8} ${sleeveEndY}`,
    `L ${sleeveOuterRight} ${sleeveEndY}`,
    `L ${CENTER_X + halfWidth} ${shoulderY}`,
    `L ${CENTER_X + halfWidth * 0.45} ${silhouette.landmarks.collar.y}`,
    'Z',
  ].join(' ');

  return (
    <path
      d={d}
      fill="#1e293b"
      stroke="#0f172a"
      strokeWidth={0.7}
      opacity={0.94}
    />
  );
}
