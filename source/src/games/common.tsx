// 게임 공통 도우미
import { useEffect, useRef } from 'preact/hooks';
import { newScene, say, sayAll, sfx, wait, stopVoice } from '../engine/audio';
import { buddy } from '../engine/bus';
import { pick, josa } from '../lib/hangul';
import { JAMO } from '../data/jamo';
import { cueParts, CUE_GAP } from '../data/voice';
import { takeBack } from '../engine/store';
export { CUE_GAP };
import type { Step } from '../engine/session';
import type { Outfit } from '../engine/store';

export interface GameProps<T extends Step['t'] = Step['t']> {
  step: Extract<Step, { t: T }>;
  onDone: () => void;
  outfit: Outfit;
  name: string;
}

export const PRAISE = ['딩동댕!', '정답이야!', '우와, 잘했어!', '최고야!', '멋져!', '대단해!', '맞았어!', '짝짝짝!'];
export const RETRY = ['다시 해 볼까?', '괜찮아, 한 번 더!', '다시 찾아 볼까?'];
/** 틀렸을 때: 상냥하고 부드럽게 (아이가 속상하지 않게) */
export const GENTLE = ['괜찮아~ 다시 찾아 보자!', '괜찮아, 천천히 다시 찾아 볼까?', '아깝다~ 다시 한번 찾아 보자!'];
export const gentle = (lines: string[] = GENTLE) => say(pick(lines));
/** 놀이에서 틀리면 받은 것(간식·꾸미기·재료) 하나를 무작위로 돌려받기 — 화면 위쪽에 날아가는 모습이 보임 */
export const penalty = () => { try { takeBack(); } catch { /* 무시 */ } };

/**
 * 말하는 중에도 바로 누를 수 있게: 누를 때마다 새 차례를 받는다(하던 말은 바로 멈춤).
 * 기다린 뒤에는 mine(내 차례)로 확인해서, 그 사이 아이가 또 눌렀으면 앞의 흐름은 조용히 끝낸다.
 */
export function useTurn() {
  const r = useRef<{ n: number; take: () => number; mine: (x: number) => boolean } | null>(null);
  if (!r.current) {
    const o = { n: 0, take: () => { stopVoice(); return ++o.n; }, mine: (x: number) => x === o.n };
    r.current = o;
  }
  return r.current;
}

/** 읽는 이름: 자모면 이름(기역), 아니면 그대로 */
export const spoken = (x: string) => JAMO[x]?.name ?? x;

/**
 * 찾을 글자를 '소리로만' 알려 줄 때 쓰는 말 (화면에는 답을 보여 주지 않는다).
 * 자음은 이름과 소리를 한 번씩("기역, 그!"), 모음은 "아!", 음절·낱말은 읽는 대로.
 */
export const cue = (x: string): string[] => cueParts(x);
/** 글자 이름과 소리를 또렷이 나눠 읽기: "기역" (쉼) "그" */
export const sayCue = (x: string) => sayAll(cueParts(x), CUE_GAP);

/** "기역을", "아를" */
export const obj = (x: string) => spoken(x) + josa(spoken(x), '을', '를');
/** "기역이야", "아야" */
export const itIs = (x: string) => spoken(x) + josa(spoken(x), '이야', '야');

export function praise(big = false) {
  sfx.ding();
  buddy({ t: big ? 'big' : 'cheer' });
  return say(big ? pick(['우와, 정말 잘했어!', '최고야, 최고!', '대단해! 짝짝짝!']) : pick(PRAISE));
}

/** 장면 시작·끝에 말소리 정리. alive()로 언마운트 여부 확인 */
export function useScene() {
  const alive = useRef(true);
  useEffect(() => {
    newScene();
    alive.current = true;
    return () => { alive.current = false; newScene(); };
  }, []);
  return {
    alive: () => alive.current,
    /** 살아 있을 때만 기다리기 */
    sleep: async (ms: number) => { await wait(ms); return alive.current; },
  };
}

export function Dots({ n, done }: { n: number; done: number }) {
  return (
    <div class="progress-dots">
      {Array.from({ length: n }, (_, i) => <i class={i < done ? 'on' : i === done ? 'now' : ''} />)}
    </div>
  );
}

export function Speaker({ onClick, style }: { onClick: () => void; style?: any }) {
  return <button class="speaker" style={style} onClick={() => { sfx.tap(); onClick(); }} aria-label="다시 듣기">🔊</button>;
}

/** 같은 것이 연달아 나오지 않게 섞기 (한 종류뿐이면 그대로) */
export function spread<T>(items: T[]): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out: T[] = [];
  while (pool.length) {
    // 남은 것 중 가장 많은 종류를 우선, 단 바로 앞과 다른 것
    const counts = new Map<T, number>();
    pool.forEach(x => counts.set(x, (counts.get(x) || 0) + 1));
    const cands = [...counts.entries()].filter(([x]) => x !== out[out.length - 1]).sort((a, b) => b[1] - a[1]);
    const pickX = cands.length ? cands[Math.random() < 0.7 || cands.length === 1 ? 0 : Math.floor(Math.random() * cands.length)][0] : pool[0];
    out.push(pickX);
    pool.splice(pool.indexOf(pickX), 1);
  }
  return out;
}
