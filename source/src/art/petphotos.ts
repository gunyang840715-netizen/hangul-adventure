// 기존 머리 WebP를 그림 폴더로 분리했다. 픽셀과 눈 위치는 그대로 유지.
import { artSrc } from "./artmap";
import { PETS } from "../data/pets";
export const PET_PHOTO: Record<string, string> = Object.fromEntries(PETS.map(p => [p.id, artSrc(`pet.${p.id}.head`) || ""]));
export const PHOTO_BOX = { x: -30, y: -30, size: 260 };
