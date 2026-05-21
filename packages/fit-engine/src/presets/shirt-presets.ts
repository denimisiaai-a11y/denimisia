import type { LandmarkName, ShirtFit } from '../types';

export const SHIRT_HEM_TO_LANDMARK: Record<ShirtFit['hem'], LandmarkName> = {
  cropped: 'naturalWaist',
  waist: 'lowWaist',
  hip: 'hip',
  tunic: 'midThigh',
};

export const SHIRT_SLEEVE_TO_LANDMARK: Record<ShirtFit['sleeve'], LandmarkName> = {
  sleeveless: 'armpit',
  short: 'bicep',
  'three-quarter': 'elbow',
  long: 'wrist',
};

export const SHIRT_NECKLINE_DEPTH: Record<ShirtFit['neckline'], number> = {
  crew: 4,
  'v-neck': 12,
  polo: 8,
  henley: 10,
  'mock-neck': 2,
  'button-up': 6,
};

export const SHIRT_BODY_WIDTH_SCALE: Record<ShirtFit['bodyFit'], number> = {
  slim: 0.92,
  fitted: 0.98,
  regular: 1.04,
  relaxed: 1.10,
  oversized: 1.20,
};
