import type { LandmarkName, JacketFit } from '../types';

export const JACKET_HEM_TO_LANDMARK: Record<JacketFit['hem'], LandmarkName> = {
  cropped: 'naturalWaist',
  hip: 'hip',
  mid: 'midThigh',
  long: 'knee',
};

export const JACKET_SLEEVE_TO_LANDMARK: Record<JacketFit['sleeve'], LandmarkName> = {
  short: 'bicep',
  'three-quarter': 'elbow',
  long: 'wrist',
};

export const JACKET_BODY_WIDTH_SCALE: Record<JacketFit['bodyFit'], number> = {
  fitted: 1.02,
  regular: 1.10,
  oversized: 1.22,
};
