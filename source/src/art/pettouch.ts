// 생활 화면에서만 사용: 짧게 누르기는 기존 반응, 길게 누르기는 쓰다듬기, 끌기는 손가락 따라오기.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Area, Spot } from './petbrain';

export function usePetTouch(options: { area: Area; onTap: () => void; offsetX?: number }) {
  const opt = useRef(options); opt.current = options;
  const [active, setActive] = useState(false);
  const [petting, setPetting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<Spot | null>(null);
  const pointer = useRef<null | { id: number; x: number; y: number; at: Spot; scale: number; drag: boolean; held: boolean }>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const clamp = (p: Spot): Spot => ({
    x: Math.max(opt.current.area.x0, Math.min(opt.current.area.x1, p.x)),
    y: Math.max(opt.current.area.y0, Math.min(opt.current.area.y1, p.y)),
  });
  const end = (e: PointerEvent, cancel = false) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    e.stopPropagation(); clearTimeout(timer.current); pointer.current = null;
    setActive(false); setDragging(false); setTarget(null); setPetting(false);
    if (!cancel && !p.drag && !p.held) opt.current.onTap();
  };
  return {
    active, petting, dragging, target,
    bind: {
      onPointerDown: (e: PointerEvent) => {
        if (e.button !== 0 || e.isPrimary === false || pointer.current) return;
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement, parent = el.parentElement!;
        const stage = el.closest('#stage') as HTMLElement;
        const scale = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
        const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect();
        const at = { x: (r.left - pr.left) / scale - (opt.current.offsetX ?? 0), y: (r.top - pr.top) / scale };
        pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at, scale, drag: false, held: false };
        setTarget(at); setActive(true);
        el.setPointerCapture?.(e.pointerId);
        timer.current = window.setTimeout(() => {
          if (pointer.current) { pointer.current.held = true; setPetting(true); }
        }, 550);
      },
      onPointerMove: (e: PointerEvent) => {
        const p = pointer.current;
        if (!p || p.id !== e.pointerId) return;
        e.stopPropagation();
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (!p.drag && Math.hypot(dx, dy) < 8) return;
        clearTimeout(timer.current); p.drag = true; setPetting(false); setDragging(true);
        setTarget(clamp({ x: p.at.x + dx / p.scale, y: p.at.y + dy / p.scale }));
      },
      onPointerUp: (e: PointerEvent) => end(e),
      onPointerCancel: (e: PointerEvent) => end(e, true),
      onLostPointerCapture: (e: PointerEvent) => end(e, true),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.current.onTap(); }
      },
    },
  };
}
