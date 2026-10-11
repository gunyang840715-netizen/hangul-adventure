// 기존 그림 원본의 내용 해시 경로. 없는 그림은 기존 SVG로 그린다.
export const ART_MAP: Record<string, string> = {
  "pet.maltese.head": "art/pets/maltese.head.aef9a4b6.webp",
  "pet.poodle.head": "art/pets/poodle.head.293d8ea2.webp",
  "pet.corgi.head": "art/pets/corgi.head.812b6aae.webp",
  "pet.shiba.head": "art/pets/shiba.head.d55ed5bb.webp",
  "pet.schnauzer.head": "art/pets/schnauzer.head.049f84e3.webp",
  "pet.koshort.head": "art/pets/koshort.head.d0a291fb.webp",
  "pet.russian.head": "art/pets/russian.head.d410f733.webp",
  "pet.siamese.head": "art/pets/siamese.head.e2d611a3.webp",
  "pet.fold.head": "art/pets/fold.head.13aaa400.webp",
  "pet.persian.head": "art/pets/persian.head.3fae2f50.webp"
};

export function artSrc(id: string): string | undefined {
  const path = ART_MAP[id];
  return path ? "./" + path : undefined;
}
