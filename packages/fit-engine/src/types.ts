export type SilhouetteGender = 'MALE' | 'FEMALE';

export type LandmarkName =
  | 'collar' | 'shoulder' | 'armpit' | 'bicep' | 'elbow' | 'midForearm' | 'wrist'
  | 'highWaist' | 'naturalWaist' | 'lowWaist' | 'hip'
  | 'crotch' | 'midThigh' | 'knee' | 'midCalf' | 'ankle';

export type LandmarkMap = Record<LandmarkName, { y: number; x?: number }>;

export interface SilhouetteData {
  id: string;
  gender: SilhouetteGender;
  svgPath: string;
  viewBox: string;
  landmarks: LandmarkMap;
  version: number;
}

export interface GarmentOffsets {
  hemY?: number;
  topY?: number;
  sleeveEndY?: number;
  bodyWidthScale?: number; // clamped client-side to 0.85–1.20
}

export type PantsFit = {
  kind: 'PANTS';
  rise: 'low' | 'mid' | 'high';
  hem: 'above-knee' | 'mid-calf' | 'ankle' | 'floor';
  legShape: 'skinny' | 'slim' | 'straight' | 'wide' | 'flared' | 'bootcut';
  silhouetteGender: SilhouetteGender | 'BOTH';
  offsets?: GarmentOffsets;
};

export type ShirtFit = {
  kind: 'SHIRTS';
  hem: 'cropped' | 'waist' | 'hip' | 'tunic';
  sleeve: 'sleeveless' | 'short' | 'three-quarter' | 'long';
  neckline: 'crew' | 'v-neck' | 'polo' | 'henley' | 'mock-neck' | 'button-up';
  bodyFit: 'slim' | 'fitted' | 'regular' | 'relaxed' | 'oversized';
  silhouetteGender: SilhouetteGender | 'BOTH';
  offsets?: GarmentOffsets;
};

export type JacketFit = {
  kind: 'JACKETS';
  hem: 'cropped' | 'hip' | 'mid' | 'long';
  sleeve: 'short' | 'three-quarter' | 'long';
  closure: 'zip' | 'button' | 'snap' | 'drape';
  bodyFit: 'fitted' | 'regular' | 'oversized';
  silhouetteGender: SilhouetteGender | 'BOTH';
  offsets?: GarmentOffsets;
};

export type FitLandmarks = PantsFit | ShirtFit | JacketFit;

export interface OverlayDescriptor {
  kind: FitLandmarks['kind'];
  fit: FitLandmarks;
}
