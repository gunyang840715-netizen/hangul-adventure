import type { FrontWearLayer } from './frontwear';

// Claude가 친구별 원화에서 검수한 정면 목걸이.
export const APPROVED_FRONT_NECK: Record<string, FrontWearLayer> = {
  'maltese:medal': { url: './art/pets/maltese.paint-wear-neck-medal-front.66e7bbad.webp', x: 223, y: 379, width: 179, height: 154 },
  'schnauzer:medal': { url: './art/pets/schnauzer.paint-wear-neck-medal-front.acd08219.webp', x: 238, y: 362, width: 147, height: 118 },
  'shiba:medal': { url: './art/pets/shiba.paint-wear-neck-medal-front.803458f8.webp', x: 254, y: 378, width: 109, height: 108 },
  'siamese:medal': { url: './art/pets/siamese.paint-wear-neck-medal-front.ca8fc1ac.webp', x: 262, y: 311, width: 97, height: 102 },
};
