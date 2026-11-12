// 글자 합치기 (2026-11-12 사용자 요청: "낱말 공부 하기 전에 가, 나, 다 … 튜, 퓨, 휴까지 자음이랑 모음 합친 글씨도 읽으면서 쓰는 연습")
//  · 받침 없는 기본 글자 140개 = 자음 14 × 모음 10. 순서는 사용자가 말한 그대로:
//    가 나 다 라 마 바 사 아 자 차 카 타 파 하 → 거 너 더 러 … 허 → … → 규 뉴 듀 … 튜 퓨 휴
//    (모음은 앱에서 배우는 순서 ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ ㅑ ㅕ ㅛ ㅠ, 자음은 가나다 순서)
//  · 하루(모험 하나)에 한 줄(14글자). 진도표(curriculum.ts)의 단계 번호는 그대로 두고, 첫 '낱말' 단계 바로 앞에 놓는다.
import { compose } from '../lib/hangul';
import { LESSONS } from './curriculum';

export const SYL_VOWELS = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ', 'ㅑ', 'ㅕ', 'ㅛ', 'ㅠ'] as const;
export const SYL_CONS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;

/** 줄(모음)마다 14글자: [가 나 다 … 하], [거 너 더 … 허], … */
export const SYL_ROWS: string[][] = SYL_VOWELS.map(v => SYL_CONS.map(c => compose(c, v)));
export const SYL_ROW_COUNT = SYL_ROWS.length;
export const SYL_ALL: string[] = SYL_ROWS.flat();
const ROW_OF = new Map<string, number>();
SYL_ROWS.forEach((row, r) => row.forEach(s => ROW_OF.set(s, r)));
/** 그 글자가 몇째 줄인지 (기본 글자가 아니면 -1) */
export const sylRowOf = (s: string) => ROW_OF.get(s) ?? -1;

/** 이 단계가 놓이는 자리 = 첫 '낱말' 단계의 번호. 그 앞 글자 단계에서 자음 14·모음 10을 모두 배운다 */
export const SYL_GATE = LESSONS.findIndex(l => l.kind === 'words');
/** 지도·인사에서 이 단계가 속한 단원 (낱말 다리 — '글자를 합쳐 낱말 읽기') */
export const SYL_UNIT = LESSONS[SYL_GATE].unit;

export const SYL_NAME = '글자 합치기';
/** '가~하' */
export const sylRowLabel = (r: number) => `${SYL_ROWS[r][0]}~${SYL_ROWS[r][SYL_ROWS[r].length - 1]}`;
/** '글자 합치기 3 · 고~호' (인사·이어하기·부모 설정에 보이는 이름) */
export const sylRowTitle = (r: number) => `${SYL_NAME} ${r + 1} · ${sylRowLabel(r)}`;

// ---------- 모험(세션) 번호 ----------
// 글자 합치기 모험은 진도표 단계 번호와 겹치지 않는 큰 번호를 쓴다(1000 + 줄).
// 이어하기 기록(resume.lessonIdx)에 이 번호가 들어가므로, 아직 업데이트 안 된 기기는 '지금 할 단계가 아님'으로 보고 그 이어하기를 쓰지 않는다
// (예전 판이 글자 합치기 모험을 낱말 단계로 잘못 이어서 낱말 단계를 통과시키는 일이 없게).
export const SYL_BASE = 1000;
export const sylIdx = (row: number) => SYL_BASE + row;
export const isSylIdx = (idx: number) => idx >= SYL_BASE && idx < SYL_BASE + SYL_ROW_COUNT;
export const sylRowOfIdx = (idx: number) => idx - SYL_BASE;
