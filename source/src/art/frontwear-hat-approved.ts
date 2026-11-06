import type { FrontWearLayer } from './frontwear';

// Claude가 친구별 원화에서 검수한 정면 모자(친구마다 직접 착용 그림).
export const APPROVED_FRONT_HAT: Record<string, FrontWearLayer> = {
  'fold:bow': { url: './art/pets/fold.paint-wear-hat-bow-front.c81ce5e2.webp', x: 210, y: 93, width: 221, height: 147 },
  'persian:bow': { url: './art/pets/persian.paint-wear-hat-bow-front.6d4b1144.webp', x: 201, y: 100, width: 239, height: 159 },
  'russian:bow': { url: './art/pets/russian.paint-wear-hat-bow-front.44b28e49.webp', x: 198, y: 66, width: 245, height: 158 },
  'siamese:bow': { url: './art/pets/siamese.paint-wear-hat-bow-front.055d717d.webp', x: 214, y: 99, width: 223, height: 137 },
  'koshort:bow': { url: './art/pets/koshort.paint-wear-hat-bow-front.f39a2be8.webp', x: 240, y: 128, width: 176, height: 108 },
};
