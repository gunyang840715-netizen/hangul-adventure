// 강아지·고양이에게 알리는 신호 (맞혔다, 틀렸다, 세기 등)
export type BuddyEv =
  | { t: 'cheer' | 'big' | 'oops' | 'wave' }
  | { t: 'count' | 'hint' | 'say'; text: string; who?: 'dog' | 'cat' }
  | { t: 'eat'; who: 'dog' | 'cat' };
const subs = new Set<(e: BuddyEv) => void>();
export function onBuddy(f: (e: BuddyEv) => void) { subs.add(f); return () => { subs.delete(f); }; }
export function buddy(e: BuddyEv) { subs.forEach(f => f(e)); }
