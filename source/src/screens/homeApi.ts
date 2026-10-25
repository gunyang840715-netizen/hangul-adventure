// 집 짓기·집 안·마당·놀이터 화면이 쓰는 기록 — 한글 기록과 수학 기록(따로) 중 어느 쪽인지 (10-23)
// 기본은 한글 기록. 수학 쪽 화면은 App.tsx에서 <HomeCtx.Provider value={MATH_HOME}>로 감싸 같은 화면을 수학 기록으로 쓴다.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { petView, matsLeft, builtCount, buildPart, nextBuild, decoOf, setDeco, buyFurn, isBought, type PetView } from '../engine/store';
import { mathPetView, mathMatsLeft, mathBuiltCount, mathBuildPart, mathNextBuild, mathDecoOf, mathSetDeco, mathBuyFurn, mathIsBought } from '../math/mathStore';
import type { BuildDef, Species } from '../data/pets';
import { STUDY_NO_MAT } from '../data/voice';

export interface HomeApi {
  kind: 'hangul' | 'math';
  petView: (sp: Species) => PetView;
  matsLeft: () => number;
  builtCount: (id: string) => number;
  buildPart: (id: string) => number | null;
  nextBuild: () => BuildDef | null;
  decoOf: (place: string) => Record<string, string>;
  setDeco: (place: string, slot: string, id: string | null) => void;
  buyFurn: (id: string) => boolean;
  isBought: (id: string) => boolean;
  noMat: string;   // 재료가 없을 때 하는 말 (한글: 놀이로 받음 / 수학·맞춤법: 정답으로 받음)
}

export const HANGUL_HOME: HomeApi = {
  kind: 'hangul',
  petView: sp => petView(sp), matsLeft: () => matsLeft(), builtCount: id => builtCount(id), buildPart: id => buildPart(id),
  nextBuild: () => nextBuild(), decoOf: p => decoOf(p), setDeco: (p, sl, id) => setDeco(p, sl, id), buyFurn: id => buyFurn(id), isBought: id => isBought(id),
  noMat: '재료가 없어! 놀이를 하면 받을 수 있어!',
};
export const MATH_HOME: HomeApi = {
  kind: 'math',
  petView: sp => mathPetView(sp), matsLeft: () => mathMatsLeft(), builtCount: id => mathBuiltCount(id), buildPart: id => mathBuildPart(id),
  nextBuild: () => mathNextBuild(), decoOf: p => mathDecoOf(p), setDeco: (p, sl, id) => mathSetDeco(p, sl, id), buyFurn: id => mathBuyFurn(id), isBought: id => mathIsBought(id),
  noMat: STUDY_NO_MAT,
};

export const HomeCtx = createContext<HomeApi>(HANGUL_HOME);
export const useHome = () => useContext(HomeCtx);
