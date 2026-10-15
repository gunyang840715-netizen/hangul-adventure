// 낱말 그림 (원문 I · 묶음 9): 이모지로 보이던 낱말 그림을 같은 그림체 손그림으로. 그림이 없으면 이모지를 그대로.
import { useState } from 'preact/hooks';
import { artSrc } from './artmap';
import { WORD_ART, EMOJI_ART } from './words.gen';

/** 낱말(또는 '거울의 기역'처럼 끝말이 낱말인 말) → 그림 경로. 목록에 없는 낱말은 같은 이모지의 그림(친구 녹음 예시 낱말) */
export function wordSrc(word: string | undefined | null, emoji?: string): string | undefined {
  const w = (word ?? '').trim().replace(/[.!?]$/, '');
  const n = (w && (WORD_ART[w] ?? WORD_ART[w.split(' ').pop() ?? ''])) || (emoji ? EMOJI_ART[emoji.replace(/\uFE0F/g, '')] : undefined);
  return n ? artSrc(`word.${n}`) : undefined;
}

export function WordPic({ word, emoji, size, class: cls = '' }: { word: string | undefined | null; emoji: string; size: number; class?: string }) {
  const src = wordSrc(word, emoji);
  const [bad, setBad] = useState<string | null>(null);
  if (src && src !== bad) return <img class={`word-pic ${cls}`} src={src} width={size} height={size} alt="" draggable={false} data-word={word ?? ''} onError={() => setBad(src)} />;
  return <span class={`word-emoji ${cls}`} style={{ fontSize: Math.round(size * 0.82), lineHeight: 1 }}>{emoji}</span>;
}
