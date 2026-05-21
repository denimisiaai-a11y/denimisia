import type { PantsFit, SilhouetteData } from '../types';
import {
  PANTS_RISE_TO_LANDMARK,
  PANTS_HEM_TO_LANDMARK,
  PANTS_LEG_WIDTH_RATIO,
} from '../presets/pants-presets';

interface PantsOverlayProps {
  silhouette: SilhouetteData;
  fit: PantsFit;
  editable?: boolean;
}

const CENTER_X = 100;
const BODY_FULL_WIDTH = 72;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function PantsOverlay({ silhouette, fit }: PantsOverlayProps) {
  const topY =
    silhouette.landmarks[PANTS_RISE_TO_LANDMARK[fit.rise]].y +
    (fit.offsets?.topY ?? 0);

  const hemY =
    silhouette.landmarks[PANTS_HEM_TO_LANDMARK[fit.hem]].y +
    (fit.offsets?.hemY ?? 0);

  const legWidthRatio = PANTS_LEG_WIDTH_RATIO[fit.legShape];
  const widthScale = clamp(fit.offsets?.bodyWidthScale ?? 1, 0.85, 1.20);
  const legHalfWidth = BODY_FULL_WIDTH * legWidthRatio * widthScale * 0.5;

  const hipLeft = CENTER_X - (BODY_FULL_WIDTH / 2) * widthScale;
  const hipRight = CENTER_X + (BODY_FULL_WIDTH / 2) * widthScale;
  const crotchY = silhouette.landmarks.crotch.y;

  const leftLegOuterX = CENTER_X - legHalfWidth * 2;
  const rightLegOuterX = CENTER_X + legHalfWidth * 2;

  const taperOut =
    fit.legShape === 'flared' || fit.legShape === 'bootcut' ? 6 : 0;

  const d = [
    `M ${hipLeft} ${topY}`,
    `L ${hipRight} ${topY}`,
    `L ${hipRight} ${crotchY}`,
    `L ${rightLegOuterX + taperOut} ${hemY}`,
    `L ${CENTER_X + 1} ${hemY}`,
    `L ${CENTER_X + 1} ${crotchY}`,
    `L ${CENTER_X - 1} ${crotchY}`,
    `L ${CENTER_X - 1} ${hemY}`,
    `L ${leftLegOuterX - taperOut} ${hemY}`,
    `L ${hipLeft} ${crotchY}`,
    'Z',
  ].join(' ');

  return (
    <path
      d={d}
      fill="#1f2937"
      stroke="#111"
      strokeWidth={0.6}
      opacity={0.92}
    />
  );
}
