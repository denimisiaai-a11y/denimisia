import type { LandmarkName, PantsFit } from '../types';

export const PANTS_RISE_TO_LANDMARK: Record<PantsFit['rise'], LandmarkName> = {
  high: 'highWaist',
  mid: 'naturalWaist',
  low: 'lowWaist',
};

export const PANTS_HEM_TO_LANDMARK: Record<PantsFit['hem'], LandmarkName> = {
  'above-knee': 'midThigh',
  'mid-calf': 'midCalf',
  ankle: 'ankle',
  floor: 'ankle',
};

export const PANTS_LEG_WIDTH_RATIO: Record<PantsFit['legShape'], number> = {
  skinny: 0.30,
  slim: 0.36,
  straight: 0.42,
  wide: 0.55,
  flared: 0.50,
  bootcut: 0.46,
};
