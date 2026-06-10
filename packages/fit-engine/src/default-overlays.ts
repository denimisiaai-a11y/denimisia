import type { FitLandmarks, SilhouetteGender } from './types';

export function defaultPlaceholderFit(
  type: 'PANTS' | 'SHIRTS' | 'JACKETS' | null,
  silhouetteGender: SilhouetteGender,
): FitLandmarks | null {
  if (type === 'PANTS') {
    return {
      kind: 'PANTS',
      rise: 'mid',
      hem: 'ankle',
      legShape: 'straight',
      silhouetteGender,
    };
  }
  if (type === 'SHIRTS') {
    return {
      kind: 'SHIRTS',
      hem: 'hip',
      sleeve: 'short',
      neckline: 'crew',
      bodyFit: 'regular',
      silhouetteGender,
    };
  }
  if (type === 'JACKETS') {
    return {
      kind: 'JACKETS',
      hem: 'hip',
      sleeve: 'long',
      closure: 'zip',
      bodyFit: 'regular',
      silhouetteGender,
    };
  }
  return null;
}
