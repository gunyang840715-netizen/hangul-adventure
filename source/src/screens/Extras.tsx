// 제목, 스티커북, 꾸미기, 잠자기, 부모 설정
import { useEffect, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { Buddy } from '../games/Buddies';
import { LetterGlyph } from '../art/LetterGlyph';
import { JAMO } from '../data/jamo';
import { LESSONS, UNITS, wordsFor, knownAfter } from '../data/curriculum';
import { say, sayAll, sfx, hasPack, newScene, packLoad, onPackLoad, voiceJob, onVoiceJob, voiceCount } from '../engine/audio';
import {
  load, exportCode, importCode, reset, resetProgress, isStorageOk, today, replaceAll, onChange, dev,
  setName, setSettings, giveExtraMinutes, giveExtraLesson, history, remainingMs, getResume,
  todayMs, todayLessons, todayExtraMin, todayExtraLessons, starsTotal, adventuresTotal, snackTotal, petView, type State,
} from '../engine/store';
import { status as syncStatus, onStatus, syncNow, syncSoon, syncCode, syncUrl, setSync, syncEnabled } from '../engine/sync';
import { server, onServer, connectVoice } from '../engine/boot';
import { stat } from '../engine/srs';
import { josa } from '../lib/hangul';
import { ITEM_LIST, STAGE_NAME } from '../data/pets';

// ---------- 제목 ----------
export function Title({ onStart }: { onStart: () => void }) {
  const [, force] = useState(0);
  useEffect(() => { const off = onPackLoad(() => force(x => x + 1)); force(x => x + 1); return off; }, []);
  // 음성팩을 받는 동안에는 기다리기 (처음 설치할 때 한 번). 너무 오래 걸리면 그냥 시작
  const [late, setLate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLate(true), 12000); return () => clearTimeout(t); }, []);
  const ready = packLoad.done || late;
  // 홈 화면에 앱 설치 (크롬에서 열었고 아직 설치 안 했을 때만 보임)
  const [canInstall, setCanInstall] = useState(() => !!(window as any).__INSTALL__);
  useEffect(() => { const f = () => setCanInstall(!!(window as any).__INSTALL__); window.addEventListener('installready', f); return () => window.removeEventListener('installready', f); }, []);
  const install = async (e: any) => {
    e.stopPropagation();
    const ev = (window as any).__INSTALL__;
    if (!ev) return;
    try { ev.prompt(); await ev.userChoice; } catch { /* 무시 */ }
    (window as any).__INSTALL__ = null; setCanInstall(false);
  };
  return (
    <div class="screen" onClick={() => ready && onStart()}>
      <Backdrop theme="sky" />
      <div class="layer">
        <div class="title-logo slide-up" style={{ fontSize: 96 }}>뭉치와 냥이의 글자 모험<small>한글 모험을 떠나요!</small></div>
        <div style={{ position: 'absolute', left: 110, top: 400 }} class="float"><LetterGlyph ch="ㄱ" size={160} /></div>
        <div style={{ position: 'absolute', left: 250, top: 560, animationDelay: '.5s' }} class="float"><LetterGlyph ch="ㅏ" size={130} /></div>
        <div style={{ position: 'absolute', right: 250, top: 560, animationDelay: '.9s' }} class="float"><LetterGlyph ch="ㅎ" size={130} /></div>
        <div style={{ position: 'absolute', right: 110, top: 400, animationDelay: '.3s' }} class="float"><LetterGlyph ch="ㅣ" size={160} /></div>
        <div style={{ position: 'absolute', left: 355, top: 300 }}><Buddy who="lead" size={290} motion="jump" autoTalk={false} /></div>
        <div style={{ position: 'absolute', left: 640, top: 318 }}><Buddy who="other" size={270} motion="bob" /></div>
        {canInstall && <button class="btn install-btn" data-install="1" onClick={install}>📲 홈 화면에 앱 설치</button>}
        <button class={`btn big ${ready ? 'pulse' : ''}`} style={{ position: 'absolute', left: '50%', bottom: 44, transform: 'translateX(-50%)', opacity: ready ? 1 : 0.75 }}>
          {ready ? '시작하기 ▶' : `목소리 준비 중… ${Math.round(packLoad.progress * 100)}%`}
        </button>
      </div>
    </div>
  );
}

// ---------- 잠자기 (시간이 풀리면 저절로 깨어나 이어서) ----------
export function Sleep({ onParent, onWake, demo }: { onParent: () => void; onWake: () => void; demo?: boolean }) {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    const n = load().name;
    sayAll([`${n}${josa(n, '아', '야')}, 오늘도 정말 잘했어!`, '이제 눈을 쉬게 해 주자. 내일 또 만나!']);
    // 다음 날이 되거나, 부모가 시간을 더 주면(다른 기기에서 줘도 연동됨) 깨어나기
    const t = setInterval(() => {
      if (demo || remainingMs() > 0) {
        clearInterval(t);
        setWaking(true);
        say('다시 놀 수 있어!');
        setTimeout(onWake, 2200);
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);
  const hasResume = !!getResume();
  return (
    <div class="screen">
      <Backdrop theme={waking ? 'sky' : 'night'} />
      <div class="layer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <Buddy who="lead" size={320} mood={waking ? 'wow' : 'sleep'} motion={waking ? 'jump' : 'bob'} autoTalk={false} />
          <Buddy who="other" size={250} mood={waking ? 'wow' : 'sleep'} motion={waking ? 'jump' : 'bob'} />
        </div>
        <div style={{ fontSize: 64, color: '#fff' }}>{waking ? '다시 놀 수 있어요! ☀️' : '오늘은 여기까지! 🌙'}</div>
        <div style={{ fontSize: 32, color: '#e5dbff' }}>{hasResume ? '하던 모험은 시간이 되면 그 자리부터 이어서 해요 🚩' : '내일 또 모험하자'}</div>
      </div>
      <div class="topbar"><GearLite onOpen={onParent} /></div>
    </div>
  );
}

function GearLite({ onOpen }: { onOpen: () => void }) {
  let t = 0;
  return <button class="iconbtn" style={{ marginLeft: 'auto', opacity: .5, width: 60, height: 60, fontSize: 28 }}
    onPointerDown={() => { t = window.setTimeout(onOpen, 2000); }} onPointerUp={() => clearTimeout(t)} onPointerLeave={() => clearTimeout(t)}>⚙️</button>;
}

// ---------- 스티커북 ----------
const ORDER = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅊ', 'ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ',
  'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ', 'ㅑ', 'ㅕ', 'ㅛ', 'ㅠ', 'ㅐ', 'ㅔ', 'ㅒ', 'ㅖ', 'ㅘ', 'ㅝ', 'ㅚ', 'ㅟ', 'ㅢ', 'ㅙ', 'ㅞ'];

export function Book({ onBack }: { onBack: () => void }) {
  const s = load();
  const [tab, setTab] = useState<'jamo' | 'word'>('jamo');
  const [sel, setSel] = useState<string | null>(null);
  const known = (ch: string) => !!s.items['j:' + ch];
  const words = s.lessonIdx > 0 ? wordsFor(knownAfter(s.lessonIdx - 1)) : [];
  useEffect(() => { newScene(); say('스티커북이야! 글자 친구를 눌러 봐.'); }, []);
  const tapJ = (ch: string, e: any) => {
    if (!known(ch)) { sfx.boing(); say('아직 못 만난 친구야.'); return; }
    sfx.pop(); const [x, y] = centerOf(e.currentTarget); burst(x, y);
    setSel(ch);
    const j = JAMO[ch];
    sayAll(j.kind === 'c' && j.sound ? [j.name, j.sound, j.ex.word] : [j.name, j.ex.word], 420);
  };
  return (
    <div class="screen">
      <Backdrop theme="castle" ground={false} />
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🗺️</button>
        <button class={`btn small ${tab === 'jamo' ? '' : 'yellow'}`} onClick={() => setTab('jamo')}>글자 친구 {ORDER.filter(known).length}/{ORDER.length}</button>
        <button class={`btn small ${tab === 'word' ? '' : 'yellow'}`} onClick={() => setTab('word')}>낱말 그림 {words.length}</button>
      </div>
      <div class="layer">
      {tab === 'jamo' ? (<>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 112, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {[['자음', ORDER.slice(0, 19)], ['모음', ORDER.slice(19)]].map(([label, list]) => (
            <>
              <div style={{ alignSelf: 'flex-start', marginLeft: 70, fontSize: 26, color: '#7a5b8f' }}>{label}</div>
              <div class="book-grid">
                {(list as string[]).map(ch => known(ch)
                  ? <button class="book-cell" onClick={(e) => tapJ(ch, e)}><LetterGlyph ch={ch} size={70} /><span>{JAMO[ch].name}</span></button>
                  : <button class="book-cell locked" onClick={(e) => tapJ(ch, e)}>?</button>)}
              </div>
            </>
          ))}
        </div>
        {sel && (
          <div class="overlay fade-in" style={{ position: 'fixed', background: 'rgba(60,30,90,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSel(null)}>
            <div class="card slide-up" key={sel} style={{ width: 620, height: 460, gap: 40, padding: 30 }}>
              <LetterGlyph ch={sel} size={300} class="glyph-bounce" />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 60 }}>{JAMO[sel].name}</div>
                <div style={{ fontSize: 110 }}>{JAMO[sel].ex.emoji}</div>
                <div style={{ fontSize: 40 }}>{JAMO[sel].ex.word}</div>
              </div>
            </div>
          </div>
        )}
      </>) : (
        <div style={{ position: 'absolute', left: 50, top: 120, right: 50, bottom: 20, overflowY: 'auto', touchAction: 'pan-y', display: 'flex', flexWrap: 'wrap', gap: 16, alignContent: 'flex-start' }}>
          {words.length === 0 && <div class="pill" style={{ fontSize: 34 }}>자음을 배우면 낱말을 읽을 수 있어!</div>}
          {words.map(w => (
            <button class="card" style={{ width: 170, height: 170, flexDirection: 'column' }} onClick={(e) => { sfx.tap(); const [x, y] = centerOf(e.currentTarget); burst(x, y); say(w.text); }}>
              <div style={{ fontSize: 76 }}>{w.emoji}</div><div style={{ fontSize: 36 }}>{w.text}</div>
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

// ---------- 부모 설정 ----------
const SYNC_ERR: [RegExp, string][] = [
  [/bad_code/, '연동 코드가 서버와 다릅니다'],
  [/old_server/, '서버 코드가 옛 버전입니다 — 새 서버 코드로 바꾸고 "새 버전"으로 다시 배포해 주세요'],
  [/no_url/, '서버 주소가 없습니다'],
  [/unknown_action/, '서버 코드가 옛 버전입니다 (새 서버 코드로 다시 배포)'],
  [/abort/i, '서버 응답이 늦습니다'],
  [/fetch|network|load failed|json/i, '인터넷 연결 또는 서버 주소를 확인해 주세요'],
];
const errText = (e: string) => (SYNC_ERR.find(([r]) => r.test(e))?.[1]) ?? e;
const fmtTime = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

function SyncPanel() {
  const [, force] = useState(0);
  useEffect(() => { const a = onStatus(() => force(x => x + 1)); const b = onServer(() => force(x => x + 1)); const c = onVoiceJob(() => force(x => x + 1)); return () => { a(); b(); c(); }; }, []);
  const [code, setCode] = useState(syncCode());
  const [url, setUrl] = useState(syncUrl());
  const st = syncStatus;
  const on = syncEnabled();
  const state = !on ? '설정 안 됨 (이 기기만 저장)' : st.busy ? '연동 중…' : st.ok ? `연동됨 · 마지막 ${fmtTime(st.at)}` : st.error ? `연결 안 됨 — ${errText(st.error)}` : '확인 중…';
  const voice = !on ? '서버 연결 후 사용'
    : !server.checked ? '확인 중…'
    : !server.reachable ? `서버에 연결되지 않음${server.error ? ' — ' + errText(server.error) : ''}`
    : !server.tts ? '고품질 음성팩 사용 중 · 음성팩에 없는 새 문장은 기기 음성으로 읽음 (추가 비용 없음)'
    : voiceJob.error === 'azure_key' ? 'Azure 키가 올바르지 않습니다'
    : voiceJob.error === 'no_tts' ? (server.tts ? '새 음성을 만들지 못했습니다 (Azure 키·사용량 확인)' : '고품질 음성팩 사용 중 (추가 비용 없음)')
    : voiceJob.left ? `빠진 문장 녹음 받는 중… 남은 ${voiceJob.left}개 (앱을 켜 두면 몇 분 안에 끝남)`
    : '빠진 문장 없음';
  return (
    <>
      <h3>두 기기 진도 연동</h3>
      <div class="row"><b style={{ color: on && st.ok ? '#2b8a3e' : on && st.error ? '#c92a2a' : '#555' }}>● {state}</b>
        {on && <button class="opt" onClick={() => syncNow()}>지금 연동</button>}</div>
      <div class="row">연동 코드 <input type="text" value={code} onInput={(e: any) => setCode(e.target.value)} style={{ width: 230 }} placeholder="예: ABCD-EFGH-IJKL" /></div>
      <div class="row">서버 주소 <input type="text" value={url} onInput={(e: any) => setUrl(e.target.value)} style={{ width: 640, fontSize: 16 }} placeholder="https://script.google.com/macros/s/…/exec" /></div>
      <div class="row">
        <button class="opt" onClick={async () => { setSync(code, url); await syncNow(); connectVoice(); force(x => x + 1); }}>저장하고 연동</button>
        <span style={{ fontSize: 16, color: '#868e96' }}>설정 링크로 한 번 열면 자동으로 채워집니다. 두 기기에 같은 코드·주소를 넣으면 진도가 합쳐집니다.</span>
      </div>
      <div class="row">녹음 음성 {voiceCount()}개 · {voice}
        {on && server.reachable && <button class="opt" onClick={() => connectVoice()}>음성 다시 확인</button>}</div>
    </>
  );
}

export function Parent({ onClose, onDemo, demo }: { onClose: () => void; onDemo: (on: boolean) => void; demo: boolean }) {
  const [, force] = useState(0);
  useEffect(() => onChange(() => force(x => x + 1)), []);
  const s = load();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [nameIn, setNameIn] = useState(s.name);
  const [ask, setAsk] = useState<null | 'progress' | 'all'>(null);
  const done = (m: string) => { setMsg(m); syncSoon(400); force(x => x + 1); };
  const min = Math.round(todayMs() / 60000);
  const lesson = LESSONS[Math.min(s.lessonIdx, LESSONS.length - 1)];
  const limit = s.settings.dailyMin ? s.settings.dailyMin + todayExtraMin() : 0;

  const jumpTo = (idx: number) => {
    const n: State = JSON.parse(JSON.stringify(load()));
    const t = today();
    const mk = (id: string) => { if (!n.items[id] || n.items[id].box < 3) n.items[id] = { box: 3, due: t + 4, seen: 1, right: 1, wrong: 0, last: t - 1 }; };
    for (let i = 0; i < idx; i++) {
      const l = LESSONS[i];
      if (l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons') l.items.forEach(ch => mk('j:' + ch));
      if (l.kind === 'batchim') l.items.forEach(ch => mk('b:' + ch));
    }
    n.lessonIdx = idx;
    // 다시 공부 묶음·복습 기록도 새로 (옮긴 단계부터 바로 시작)
    n.hold = null; n.holdT = Date.now(); n.lastPass = null; n.lastPassT = Date.now();
    n.lessonsByDay[String(t)] = {};
    n.extraLessons[String(t)] = {};
    replaceAll(n);
    done(`${idx + 1}단계로 옮겼습니다. 다른 기기도 연동되면 같이 바뀝니다.`);
  };
  const Opt = ({ on, children, onClick }: any) => <button class={`opt ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>;
  const box = (ch: string) => { const it = s.items['j:' + ch]; return it ? it.box : -1; };
  const boxColor = ['#ffe3e3', '#ffc9c9', '#ffe8cc', '#fff3bf', '#d3f9d8', '#b2f2bb'];
  const weak = Object.keys(s.items).filter(k => k.startsWith('j:') || k.startsWith('w:')).map(k => ({ k, st: stat(k) })).filter(x => x.st.wrong > 0).sort((a, b) => b.st.wrong / (b.st.seen || 1) - a.st.wrong / (a.st.seen || 1)).slice(0, 8);
  const hist = history(14);

  return (
    <div class="parent">
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <h2 style={{ margin: 0 }}>부모 설정</h2>
        <button class="opt" style={{ marginLeft: 'auto', fontSize: 22 }} onClick={onClose}>닫기 ✕</button>
      </div>
      {!isStorageOk() && <p style={{ color: '#c92a2a' }}>⚠️ 이 브라우저에서 진도가 저장되지 않고 있습니다. 연동을 켜 두거나 '백업 코드'로 진도를 옮겨 두세요.</p>}

      <h3>오늘</h3>
      <div class="row">사용 {min}분{limit ? ` / ${limit}분` : ' (제한 없음)'} · 새 단계 {todayLessons()}/{s.settings.newPerDay + todayExtraLessons()}개 · 현재 {Math.min(s.lessonIdx + 1, LESSONS.length)}/{LESSONS.length}단계 ({UNITS[lesson.unit - 1].name} · {lesson.title})</div>
      <div class="row">
        <button class="opt" onClick={() => { giveExtraMinutes(10); done('오늘 10분을 더 주었습니다.'); }}>오늘 +10분</button>
        <button class="opt" onClick={() => { giveExtraMinutes(30); done('오늘 30분을 더 주었습니다.'); }}>오늘 +30분</button>
        <button class="opt" onClick={() => { giveExtraLesson(); done('오늘 새 단계를 1개 더 열었습니다.'); }}>새 단계 +1개</button>
      </div>

      <h3>초기화</h3>
      <div class="row">
        <button class="opt" style={{ color: '#c92a2a' }} onClick={() => setAsk('progress')}>공부 진도만 처음부터</button>
        <button class="opt" style={{ color: '#c92a2a' }} onClick={() => setAsk('all')}>전체 초기화</button>
        <span style={{ fontSize: 16, color: '#868e96' }}>진도만: 1단계부터 다시 (강아지·고양이·꾸미기·간식·별은 그대로) · 전체: 모두 처음으로 (이름·설정·연동은 그대로). 연동된 다른 기기도 같이 바뀝니다.</span>
      </div>
      {ask && (
        <div class="overlay" style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(40,20,60,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 34px', maxWidth: 560, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 26, fontWeight: 'bold', marginBottom: 12 }}>{ask === 'all' ? '전체 초기화할까요?' : '공부 진도를 처음부터 할까요?'}</div>
            <div style={{ fontSize: 18, color: '#555', marginBottom: 22 }}>{ask === 'all' ? '진도, 강아지·고양이 성장, 꾸미기 아이템, 간식, 별이 모두 지워집니다.' : '1단계부터 다시 시작합니다. 강아지·고양이·꾸미기·간식·별은 그대로입니다.'} 되돌릴 수 없습니다.</div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
              <button class="opt" onClick={() => setAsk(null)}>취소</button>
              <button class="opt" data-reset-ok="1" style={{ background: '#c92a2a', color: '#fff' }} onClick={() => {
                if (ask === 'all') { reset(); done('전체 초기화했습니다.'); } else { resetProgress(); done('공부 진도를 1단계부터 다시 시작합니다.'); }
                setAsk(null); setNameIn(load().name);
              }}>초기화</button>
            </div>
          </div>
        </div>
      )}

      <SyncPanel />

      <h3>기본 설정</h3>
      <div class="row">아이 이름 <input type="text" value={nameIn} onInput={(e: any) => setNameIn(e.target.value)} style={{ width: 160 }} />
        <button class="opt" onClick={() => { const v = nameIn.trim().slice(0, 10) || '친구'; setName(v); setNameIn(v); done(`이름을 '${v}'(으)로 바꿨습니다.`); }}>저장</button></div>
      <div class="row">하루 사용 시간 {[20, 30, 45, 60, 0].map(m => <Opt on={s.settings.dailyMin === m} onClick={() => { setSettings({ dailyMin: m }); done('저장했습니다.'); }}>{m ? `${m}분` : '제한 없음'}</Opt>)}</div>
      <div class="row">하루 새 단계 {[1, 2, 3].map(m => <Opt on={s.settings.newPerDay === m} onClick={() => { setSettings({ newPerDay: m }); done('저장했습니다.'); }}>{m}개</Opt>)}</div>
      <div class="row">받침·낱말 쓰기 (한 세트에 글자마다) {[5, 10, 15].map(m => <Opt on={s.settings.traceReps === m} onClick={() => { setSettings({ traceReps: m }); done('다음 모험부터 적용됩니다.'); }}>{m}번</Opt>)} <span style={{ color: '#888', fontSize: 18 }}>· 새 글자는 10번씩 4번(총 40번, 마지막 10번은 그림자 없이)</span>
        <span style={{ fontSize: 16, color: '#868e96' }}>받침·낱말 단계에서 세트마다 글자당 이 횟수만큼 (끝 3번은 그림자 없이 혼자 쓰기)</span></div>
      <div class="row">받아쓰기 시험 통과 기준 {[60, 80, 100].map(m => <Opt on={(s.settings.testPass || 80) === m} onClick={() => { setSettings({ testPass: m }); done('다음 시험부터 적용됩니다.'); }}>{m}%</Opt>)} <span style={{ color: '#888', fontSize: 18 }}>· 그날 끝 시험에 떨어지면 다음 단계가 안 열리고, 다음날 복습 시험에 떨어지면 전 단계를 다시 공부</span></div>
      <div class="row" style={{ fontSize: 18, color: '#666' }}>시험 상태: {s.hold ? `복습 시험 불합격 → ${s.hold.lesson + 1}단계 다시 공부 중` : s.lastPass ? `마지막 통과 ${s.lastPass.lesson + 1}단계 (${s.lastPass.items.join(' ')})` : '아직 없음'}</div>
      <div class="row">말 빠르기 {[[0.85, '느리게'], [1, '보통'], [1.15, '빠르게']].map(([v, l]) => <Opt on={s.settings.voiceRate === v} onClick={() => { setSettings({ voiceRate: v as number }); done('저장했습니다.'); }}>{l}</Opt>)}</div>
      <div class="row">배경 음악 <Opt on={s.settings.music} onClick={() => { setSettings({ music: true }); done('저장했습니다.'); }}>켜기</Opt><Opt on={!s.settings.music} onClick={() => { setSettings({ music: false }); done('저장했습니다.'); }}>끄기</Opt></div>
      <div class="row">음성: {hasPack() ? '녹음 음성 사용 중' : '기기 내장 음성 사용 중 (녹음 음성 없음)'}</div>
      <div class="row" style={{ fontSize: 18, color: '#666' }} data-build={__BUILD__}>앱 버전: {__BUILD__}</div>

      <h3>글자별 숙련도 (0=처음 ~ 5=완전히 익힘)</h3>
      <div class="row" style={{ gap: 6 }}>
        {ORDER.map(ch => { const b = box(ch); return <div style={{ width: 54, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: b < 0 ? '#f1f3f5' : boxColor[b], color: b < 0 ? '#adb5bd' : '#333', fontSize: 22 }}>{ch}<br /><small style={{ fontSize: 14 }}>{b < 0 ? '-' : b}</small></div>; })}
      </div>
      {weak.length > 0 && <div class="row">자주 틀린 것: {weak.map(w => <span style={{ background: '#fff0f6', padding: '4px 10px', borderRadius: 8 }}>{w.k.slice(2)} ({w.st.wrong}/{w.st.seen})</span>)}</div>}

      <h3>최근 2주 (두 기기 합계)</h3>
      <table><tr><th>날짜</th>{hist.map(h => <th>{fmtDay(h.day)}</th>)}</tr><tr><td>분</td>{hist.map(h => <td>{Math.round(h.ms / 60000)}</td>)}</tr><tr><td>새 단계</td>{hist.map(h => <td>{h.lessons}</td>)}</tr></table>

      <h3>단계 이동</h3>
      <div class="row">
        <select style={{ fontSize: 20, padding: 8 }} onChange={(e: any) => jumpTo(+e.target.value)} value={Math.min(s.lessonIdx, LESSONS.length - 1)}>
          {LESSONS.map((l, i) => <option value={i}>{i + 1}. {UNITS[l.unit - 1].name} · {l.title}</option>)}
        </select>
        <span style={{ fontSize: 16, color: '#868e96' }}>앞 단계 글자는 '익힌 것'으로 처리됩니다.</span>
      </div>
      <div class="row">
        <Opt on={demo} onClick={() => onDemo(!demo)}>체험 모드 {demo ? '켜짐' : '꺼짐'}</Opt>
        <span style={{ fontSize: 16, color: '#868e96' }}>켜면 시간 제한 없이 모든 단계를 눌러 볼 수 있고, 화면 오른쪽 위 ⏭로 장면을 넘길 수 있습니다. 앱을 다시 열면 꺼집니다.</span>
      </div>

      <h3>진도 백업</h3>
      <div class="row"><button class="opt" onClick={() => { setCode(exportCode()); setMsg('아래 코드를 복사해 두세요.'); }}>백업 코드 만들기</button>
        <button class="opt" onClick={() => { const ok = importCode(code); if (ok) { setNameIn(load().name); done('불러왔습니다.'); } else setMsg('코드가 올바르지 않습니다.'); }}>코드로 불러오기</button>
        <button class="opt" onClick={() => { navigator.clipboard?.writeText(code).then(() => setMsg('복사했습니다.')); }}>복사</button></div>
      <textarea value={code} onInput={(e: any) => setCode(e.target.value)} placeholder="백업 코드 (예전 '몽글이' 앱의 백업 코드도 불러올 수 있습니다)" />

      {msg && <p style={{ color: '#5f3dc4', position: 'sticky', bottom: 0, background: '#f3efff', padding: 12, borderRadius: 10 }}>{msg}</p>}
      <p style={{ fontSize: 15, color: '#999' }}>꾸미기 아이템 {s.owned.length}/{ITEM_LIST.length} · 간식 {snackTotal()}개 · {petView('dog').name} Lv.{petView('dog').level}({STAGE_NAME[petView('dog').stage]}) · {petView('cat').name} Lv.{petView('cat').level}({STAGE_NAME[petView('cat').stage]}) · 별 {starsTotal()} · 누적 모험 {adventuresTotal()}회 · 오늘 {fmtDay(today())} · 기기 {dev()}</p>
    </div>
  );
}

function fmtDay(d: number) {
  const dt = new Date(d * 86400000);
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}
