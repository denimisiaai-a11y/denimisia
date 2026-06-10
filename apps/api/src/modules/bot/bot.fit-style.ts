type SilhouetteGender = 'MALE' | 'FEMALE' | 'BOTH';

interface PantsFit {
  kind: 'PANTS';
  rise: 'low' | 'mid' | 'high';
  hem: 'above-knee' | 'mid-calf' | 'ankle' | 'floor';
  legShape: 'skinny' | 'slim' | 'straight' | 'wide' | 'flared' | 'bootcut';
  silhouetteGender: SilhouetteGender;
}

interface ShirtFit {
  kind: 'SHIRTS';
  hem: 'cropped' | 'waist' | 'hip' | 'tunic';
  sleeve: 'sleeveless' | 'short' | 'three-quarter' | 'long';
  neckline: 'crew' | 'v-neck' | 'polo' | 'henley' | 'mock-neck' | 'button-up';
  bodyFit: 'slim' | 'fitted' | 'regular' | 'relaxed' | 'oversized';
  silhouetteGender: SilhouetteGender;
}

interface JacketFit {
  kind: 'JACKETS';
  hem: 'cropped' | 'hip' | 'mid' | 'long';
  sleeve: 'short' | 'three-quarter' | 'long';
  closure: 'zip' | 'button' | 'snap' | 'drape';
  bodyFit: 'fitted' | 'regular' | 'oversized';
  silhouetteGender: SilhouetteGender;
}

export type FitLandmarks = PantsFit | ShirtFit | JacketFit;

const RISE_LABELS: Record<PantsFit['rise'], string> = {
  low: 'Low-rise',
  mid: 'Mid-rise',
  high: 'High-waisted',
};

const PANTS_HEM_LABELS: Record<PantsFit['hem'], string> = {
  'above-knee': 'above the knee',
  'mid-calf': 'mid-calf',
  ankle: 'ankle',
  floor: 'floor',
};

const PANTS_RISE_PHRASE: Record<PantsFit['rise'], string> = {
  low: 'sits at low waist',
  mid: 'sits at natural waist',
  high: 'sits at natural waist',
};

const SHIRT_HEM_PHRASE: Record<ShirtFit['hem'], string> = {
  cropped: 'ends above natural waist',
  waist: 'ends at natural waist',
  hip: 'ends at hip',
  tunic: 'extends past hip',
};

const JACKET_HEM_LABELS: Record<JacketFit['hem'], string> = {
  cropped: 'Cropped',
  hip: 'Hip-length',
  mid: 'Mid-length',
  long: 'Long',
};

const JACKET_CLOSURE_LABELS: Record<JacketFit['closure'], string> = {
  zip: 'zip-up',
  button: 'button-up',
  snap: 'snap-front',
  drape: 'open-drape',
};

const SLEEVE_LABELS: Record<ShirtFit['sleeve'], string> = {
  sleeveless: 'sleeveless',
  short: 'short sleeves',
  'three-quarter': '3/4 sleeves',
  long: 'full-length sleeves',
};

const JACKET_HEM_PHRASE: Record<JacketFit['hem'], string> = {
  cropped: 'natural waist',
  hip: 'hip line',
  mid: 'mid-thigh',
  long: 'knee',
};

function isFitLandmarks(value: unknown): value is FitLandmarks {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'PANTS' || kind === 'SHIRTS' || kind === 'JACKETS';
}

export function formatFitStyleNote(fit: unknown): string | null {
  if (!isFitLandmarks(fit)) return null;

  if (fit.kind === 'PANTS') {
    return `${RISE_LABELS[fit.rise]} ${fit.legShape} — ${PANTS_RISE_PHRASE[fit.rise]}, ends at ${PANTS_HEM_LABELS[fit.hem]}.`;
  }
  if (fit.kind === 'SHIRTS') {
    const label =
      fit.hem === 'cropped'
        ? 'Cropped'
        : fit.hem === 'tunic'
          ? 'Tunic-length'
          : 'Standard';
    return `${label} ${fit.bodyFit} tee — ${SHIRT_HEM_PHRASE[fit.hem]}.`;
  }
  return `${JACKET_HEM_LABELS[fit.hem]} ${JACKET_CLOSURE_LABELS[fit.closure]} — ends at ${JACKET_HEM_PHRASE[fit.hem]}, ${SLEEVE_LABELS[fit.sleeve as ShirtFit['sleeve']]}.`;
}
