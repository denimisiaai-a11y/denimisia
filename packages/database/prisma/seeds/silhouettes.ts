import type { PrismaClient } from '@prisma/client';

const WOMEN_SVG_PATH =
  'M 100 22 C 116 22 116 46 100 46 C 84 46 84 22 100 22 Z ' +
  'M 100 46 L 100 60 ' +
  'M 100 60 L 130 68 L 134 110 L 136 158 L 128 162 L 100 158 L 72 162 L 64 158 L 66 110 L 70 68 Z ' +
  'M 98 158 L 92 252 L 110 254 L 116 158 Z ' +
  'M 102 158 L 110 254 L 92 256 L 84 158 Z ' +
  'M 92 252 L 90 290 L 106 290 L 110 254 Z ' +
  'M 110 254 L 106 290 L 92 290 L 94 252 Z';

const MEN_SVG_PATH =
  'M 100 22 C 117 22 117 48 100 48 C 83 48 83 22 100 22 Z ' +
  'M 100 48 L 100 62 ' +
  'M 100 62 L 134 70 L 140 112 L 140 158 L 128 162 L 100 158 L 72 162 L 60 158 L 60 112 L 66 70 Z ' +
  'M 96 158 L 90 252 L 108 254 L 116 158 Z ' +
  'M 104 158 L 110 254 L 92 256 L 84 158 Z ' +
  'M 90 252 L 88 290 L 104 290 L 108 254 Z ' +
  'M 110 254 L 104 290 L 90 290 L 92 252 Z';

const WOMEN_LANDMARKS = {
  collar: { y: 68 },
  shoulder: { y: 76 },
  armpit: { y: 102 },
  bicep: { y: 108, x: 60 },
  elbow: { y: 130, x: 56 },
  midForearm: { y: 150, x: 54 },
  wrist: { y: 168, x: 52 },
  highWaist: { y: 116 },
  naturalWaist: { y: 120 },
  lowWaist: { y: 132 },
  hip: { y: 158 },
  crotch: { y: 168 },
  midThigh: { y: 200 },
  knee: { y: 225 },
  midCalf: { y: 258 },
  ankle: { y: 290 },
};

const MEN_LANDMARKS = {
  collar: { y: 70 },
  shoulder: { y: 78 },
  armpit: { y: 104 },
  bicep: { y: 110, x: 56 },
  elbow: { y: 134, x: 52 },
  midForearm: { y: 154, x: 50 },
  wrist: { y: 174, x: 48 },
  highWaist: { y: 118 },
  naturalWaist: { y: 124 },
  lowWaist: { y: 138 },
  hip: { y: 158 },
  crotch: { y: 170 },
  midThigh: { y: 204 },
  knee: { y: 228 },
  midCalf: { y: 260 },
  ankle: { y: 290 },
};

export async function seedSilhouettes(prisma: PrismaClient) {
  await prisma.silhouette.upsert({
    where: { gender: 'FEMALE' },
    update: {},
    create: {
      gender: 'FEMALE',
      svgPath: WOMEN_SVG_PATH,
      viewBox: '0 0 200 320',
      landmarks: WOMEN_LANDMARKS,
    },
  });
  await prisma.silhouette.upsert({
    where: { gender: 'MALE' },
    update: {},
    create: {
      gender: 'MALE',
      svgPath: MEN_SVG_PATH,
      viewBox: '0 0 200 320',
      landmarks: MEN_LANDMARKS,
    },
  });
  console.log('✅ Silhouettes (2)');
}
