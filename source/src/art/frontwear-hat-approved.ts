import type { FrontWearLayer } from './frontwear';

// Claude가 친구별 원화에서 검수한 정면 모자(친구마다 직접 착용 그림).
export const APPROVED_FRONT_HAT: Record<string, FrontWearLayer> = {
  'fold:bow': { url: './art/pets/fold.paint-wear-hat-bow-front.c81ce5e2.webp', x: 210, y: 93, width: 221, height: 147 },
  'persian:bow': { url: './art/pets/persian.paint-wear-hat-bow-front.6d4b1144.webp', x: 201, y: 100, width: 239, height: 159 },
  'russian:bow': { url: './art/pets/russian.paint-wear-hat-bow-front.44b28e49.webp', x: 198, y: 66, width: 245, height: 158 },
  'siamese:bow': { url: './art/pets/siamese.paint-wear-hat-bow-front.055d717d.webp', x: 214, y: 99, width: 223, height: 137 },
  'koshort:bow': { url: './art/pets/koshort.paint-wear-hat-bow-front.f39a2be8.webp', x: 240, y: 128, width: 176, height: 108 },
  'corgi:captain': { url: './art/pets/corgi.paint-wear-hat-captain-front.3d2de0af.webp', x: 186, y: 126, width: 256, height: 141 },
  'maltese:captain': { url: './art/pets/maltese.paint-wear-hat-captain-front.bcbbb62c.webp', x: 175, y: 88, width: 310, height: 158 },
  'poodle:captain': { url: './art/pets/poodle.paint-wear-hat-captain-front.5d94d1a1.webp', x: 176, y: 89, width: 281, height: 155 },
  'schnauzer:captain': { url: './art/pets/schnauzer.paint-wear-hat-captain-front.a0833875.webp', x: 195, y: 124, width: 247, height: 133 },
  'shiba:captain': { url: './art/pets/shiba.paint-wear-hat-captain-front.546fc030.webp', x: 177, y: 81, width: 309, height: 155 },
};
