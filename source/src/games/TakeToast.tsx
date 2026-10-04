// 놀이에서 틀려서 돌려준 것: 화면 위쪽에서 작게 보여 주고 날아가게 (−1)
import { useEffect, useState } from 'preact/hooks';
import { onTake, type Taken } from '../engine/store';
import { SnackIcon, ItemIcon } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sfx } from '../engine/audio';

interface T extends Taken { k: number }
let k = 0;

export function TakeToast() {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => onTake(t => {
    const x = { ...t, k: ++k };
    setList(l => [...l.slice(-3), x]);
    setTimeout(() => sfx.whoosh(), 120);
    setTimeout(() => setList(l => l.filter(o => o.k !== x.k)), 1700);
  }), []);
  if (!list.length) return null;
  return (
    <div class="take-layer">
      {list.map((t, i) => (
        <div class="take-toast" key={t.k} data-take={t.kind} style={{ right: `calc(var(--side) + ${30 + i * 150}px)` }}>
          <div class="take-icon">{t.kind === 'snack' ? <SnackIcon id={t.id} size={70} /> : t.kind === 'item' ? <ItemIcon id={t.id} size={76} /> : <MatIcon size={74} />}</div>
          <b>−1</b>
        </div>
      ))}
    </div>
  );
}
