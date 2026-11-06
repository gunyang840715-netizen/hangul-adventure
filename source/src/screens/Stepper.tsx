// 부모 설정의 숫자 고치기 칸: [−] 값 [+] (11-07 사용자 요청 — 공부량을 하나씩 자세히 고치기)
// 누를 때마다 바로 저장(onSet). 빠른 선택(presets)은 옆에 작은 버튼으로.
import type { Range } from '../lib/studyCfg';

interface Props {
  value: number;
  r: Range;
  onSet: (v: number) => void;
  fmt?: (v: number) => string;            // 값 보이기 ('30분', '×1.5')
  presets?: readonly number[];
  id?: string;                            // 시험용 data-stepper
}

export function Stepper({ value, r, onSet, fmt = v => String(v), presets, id }: Props) {
  const clamp = (v: number) => +Math.max(r.min, Math.min(r.max, v)).toFixed(2);
  const go = (d: number) => {
    // 범위 밖 값(예전 값·제한 없음)에서 누르면 가장 가까운 칸부터
    const base = value < r.min ? r.min - d : value > r.max ? r.max - d : value;
    const v = clamp(Math.round((base + d) / r.step) * r.step);
    if (v !== value) onSet(v);
  };
  const inRange = value >= r.min && value <= r.max;
  return (
    <span class="stepper" data-stepper={id} data-value={value}>
      <button class="opt step-btn" disabled={inRange && value <= r.min} onClick={() => go(-r.step)} aria-label="줄이기">−</button>
      <b class="step-val">{fmt(value)}</b>
      <button class="opt step-btn" disabled={inRange && value >= r.max} onClick={() => go(r.step)} aria-label="늘리기">＋</button>
      {presets?.map(p => <button class={`opt step-pre ${p === value ? 'on' : ''}`} onClick={() => p !== value && onSet(p)}>{fmt(p)}</button>)}
    </span>
  );
}
