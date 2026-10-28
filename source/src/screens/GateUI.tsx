// 공부 먼저 (10-28 사용자 요청) 화면 조각: 잠겼다는 안내 · 오늘 분량 막대 · 열렸다는 축하 (판정은 lib/gate.ts)
import { useEffect, useState } from 'preact/hooks';
import { burst } from '../art/Scene';
import { say, sfx } from '../engine/audio';
import { onChange, load, setSettings } from '../engine/store';
import { mathState } from '../math/mathStore';
import {
  gateStatus, gateLocked, gateNeedText, gateLabel, gateProgressText, gateRule, setGate, openGateToday, closeGateToday,
  GATE_MODE_LABEL, GATE_MIN_CHOICES, GATE_N_CHOICES, GATE_KIND_LABEL, type GateKind, type GateMode, type GateStatus,
} from '../lib/gate';
import { GATE_LOCKED, GATE_OPENED } from '../data/voice';

/** 분량 막대 */
export function GateBar({ st }: { st: GateStatus }) {
  return <span class="gate-bar" data-gate-pct={st.pct}><i style={{ width: `${st.pct}%` }} /></span>;
}

/** 잠긴 곳을 눌렀을 때: 🔒 + 열리는 조건 + 막대. 아무 데나 누르면 닫히고, 5초 뒤에도 저절로 닫힘. 아이가 못 읽어도 되게 말로도 알려 줌 */
export function GateNotice({ st, onClose }: { st: GateStatus; onClose: () => void }) {
  useEffect(() => {
    say(GATE_LOCKED);
    const t = window.setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div class="overlay fade-in" data-gate-notice={st.kind} data-gate-mode={st.mode} style={{ background: 'rgba(60,30,90,.45)', zIndex: 60 }} onClick={() => { sfx.tap(); onClose(); }}>
      <div class="layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
        <div class="card slide-up gate-card">
          <div class="gate-big">🔒</div>
          <div class="gate-title">{gateNeedText(st)} 열려요!</div>
          <div class="gate-row"><span class="gate-label">{gateLabel(st)}</span><GateBar st={st} /><b>{gateProgressText(st)}</b></div>
          <button class="btn">알겠어요 ▶</button>
        </div>
      </div>
    </div>
  );
}

/** 아직 잠긴 동안만 보이는 작은 표시: '🔒 오늘 공부 ▓▓░░ 7/15분' (스스로 새로 그림 — 시간이 흐르는 동안에도) */
export function GatePill({ kind, style }: { kind: GateKind; style?: Record<string, string | number> }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force(x => x + 1), 2000);
    const off = onChange(() => force(x => x + 1));
    return () => { clearInterval(t); off(); };
  }, []);
  const st = gateStatus(kind);
  if (!gateLocked(kind)) return null;
  return (
    <div class="pill gate-pill" data-gate-pill={kind} data-gate-mode={st.mode} style={style}>
      🔒 <span class="gate-pill-label">{gateLabel(st)}</span> <GateBar st={st} /> <b>{gateProgressText(st)}</b>
    </div>
  );
}

/** 분량을 채워서 열렸을 때: 소리·색종이·말 (화면 위 배너는 GateBanner) */
export function celebrateGate() {
  sfx.fanfare();
  burst(640, 300, 'confetti');
  say(GATE_OPENED);
}

/** 열렸다는 배너 (5초 보였다가 저절로 사라짐 — 누르는 것을 막지 않음) */
export function GateBanner({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = window.setTimeout(onDone, 5000); return () => clearTimeout(t); }, []);
  return <div class="gate-banner" data-gate-banner="1">🔓 오늘 공부 끝! 이제 놀 수 있어요 🎉</div>;
}

// ---------- 부모 설정 '공부 먼저' 칸 (Extras.tsx Parent가 '오늘' 아래에 끼워 넣음) ----------
const MODES: readonly GateMode[] = ['off', 'amount', 'time'];
const fmtMin = (n: number) => (n >= 60 ? `${n / 60}시간` : `${n}분`);

/** onSaved: 부모 설정의 안내 글 · 연동 저장 · 다시 그리기 (Parent의 done) */
export function GateParent({ onSaved }: { onSaved: (m: string) => void }) {
  const s = load();
  const Opt = ({ on, children, onClick }: { on: boolean; children: any; onClick: () => void }) => <button class={`opt ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>;
  const block = (kind: GateKind) => {
    const r = gateRule(kind, s), st = gateStatus(kind, s);
    const who = GATE_KIND_LABEL[kind];
    const cap = kind === 'h' ? s.settings.dailyMin : mathState().dayMin;   // 하루 사용(공부) 시간 — 한글은 0이면 제한 없음
    const tooLong = r.mode === 'time' && cap > 0 && r.min >= cap;
    return (
      <div data-gate-parent={kind} data-gate-mode={r.mode} style={{ marginBottom: 10 }}>
        <div class="row">
          <b style={{ minWidth: 110 }}>{who}</b>
          {MODES.map(md => <Opt on={r.mode === md} onClick={() => { setGate(kind, { mode: md }); onSaved(md === 'off' ? `${who}: 공부 먼저를 껐습니다. 항상 열려 있습니다.` : `${who}: ${GATE_MODE_LABEL[md]}(으)로 정했습니다.`); }}>{GATE_MODE_LABEL[md]}</Opt>)}
          {r.mode === 'amount' && kind === 'h' && <>
            <span>오늘의 새 단계</span>
            {[1, 2, 3].map(n => <Opt on={s.settings.newPerDay === n} onClick={() => { setSettings({ newPerDay: n }); onSaved(`오늘의 새 단계 ${n}개를 마치면 열립니다. (위 기본 설정의 '하루 새 단계'도 ${n}개로 같이 바뀝니다)`); }}>{n}개</Opt>)}
            <span style={{ fontSize: 16, color: '#868e96' }}>마치면 열림 · 기본 설정의 '하루 새 단계'와 같은 값</span>
          </>}
          {r.mode === 'amount' && kind === 'm' && <>
            <span>맞힌 문제</span>
            {GATE_N_CHOICES.map(n => <Opt on={r.n === n} onClick={() => { setGate(kind, { n }); onSaved(`${who}: 오늘 문제를 ${n}개 맞히면 열립니다.`); }}>{n}개</Opt>)}
            <span style={{ fontSize: 16, color: '#868e96' }}>수학·맞춤법 합쳐서 · 틀린 것은 안 셈</span>
          </>}
          {r.mode === 'time' && <>
            <span>공부 시간</span>
            {GATE_MIN_CHOICES[kind].map(n => <Opt on={r.min === n} onClick={() => { setGate(kind, { min: n }); onSaved(`${who}: 오늘 ${fmtMin(n)} 공부하면 열립니다.`); }}>{fmtMin(n)}</Opt>)}
            <span style={{ fontSize: 16, color: '#868e96' }}>{kind === 'h' ? '오늘 앱을 쓴 시간 · 3분 넘게 안 만지면 멈춤' : '문제 푼 시간 · 3분 넘게 안 만지면 멈춤'}</span>
          </>}
        </div>
        {tooLong && <div class="row" style={{ color: '#c92a2a', fontSize: 18 }} data-gate-warn="1">⚠️ 정한 시간({fmtMin(r.min)})이 하루 {kind === 'h' ? '사용' : '공부'} 시간({fmtMin(cap)}) 이상이라 채우기 전에 하루가 끝납니다. 더 짧게 정해 주세요.</div>}
        <div class="row" style={{ fontSize: 18, color: '#666' }} data-gate-state={st.open ? 'open' : 'locked'}>
          {r.mode === 'off' ? '지금: 꺼짐 — 항상 열려 있음' : `지금: ${st.open ? '🔓 열림' : '🔒 잠김'} · ${gateLabel(st)} ${gateProgressText(st)}${st.free ? ' · 오늘은 부모가 열어 줌' : ''}`}
          {r.mode !== 'off' && !st.free && !st.met && <button class="opt" data-gate-free={kind} onClick={() => { openGateToday(kind); onSaved(`${who}: 오늘은 분량 없이 바로 열어 줬습니다. 내일은 다시 분량을 채워야 합니다.`); }}>오늘은 바로 열어 주기</button>}
          {r.mode !== 'off' && st.free && <button class="opt" data-gate-unfree={kind} onClick={() => { closeGateToday(kind); onSaved(`${who}: 열어 준 것을 취소했습니다.`); }}>열어 준 것 취소</button>}
        </div>
      </div>
    );
  };
  return (
    <>
      <h3>🔒 공부 먼저</h3>
      <div class="row" style={{ fontSize: 16, color: '#868e96', display: 'block', lineHeight: 1.6 }} data-gate-help="1">
        오늘 공부 분량을 채워야 꾸미기·집 짓기 같은 공부 아닌 곳이 열립니다. 하루가 지나면 다시 채워야 합니다.<br />
        잠기는 곳 — 한글: 스티커북, 우리 집(꾸미기·친구 고르기·집 짓기·집 안·놀이터·마당) / 수학·맞춤법: 옷장, 집 꾸미기, 간식 주기. 모험·놀이·문제·맞춤법은 항상 열려 있습니다.<br />
        학습량 — 한글: 오늘의 새 단계 / 수학·맞춤법: 맞힌 문제 수. 시간 — 한글: 오늘 앱을 쓴 시간 / 수학·맞춤법: 문제를 푼 시간. 설정은 연동된 기기에 같이 적용됩니다. 체험 모드에서는 잠기지 않습니다.
      </div>
      {block('h')}
      {block('m')}
    </>
  );
}
