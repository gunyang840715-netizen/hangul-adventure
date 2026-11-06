// 제목, 스티커북, 꾸미기, 잠자기, 부모 설정
import { appTitle } from '../lib/appTitle';
import { useEffect, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { Buddy } from '../games/Buddies';
import { WordPic } from '../art/WordPic';
import { LetterGlyph } from '../art/LetterGlyph';
import { JAMO } from '../data/jamo';
import { LESSONS, UNITS, wordsFor, knownAfter } from '../data/curriculum';
import { say, sayAll, sfx, hasPack, newScene, packLoad, onPackLoad, voiceJob, onVoiceJob, voiceCount } from '../engine/audio';
import {
  load, exportCode, importCode, reset, resetProgress, isStorageOk, storageNeedsRecovery, today, replaceAll, onChange, dev,
  setName, setSettings, giveExtraMinutes, giveExtraLesson, history, remainingMs, getResume,
  todayMs, todayLessons, todayExtraMin, todayExtraLessons, starsTotal, adventuresTotal, snackTotal, petView, type State,
} from '../engine/store';
import { status as syncStatus, onStatus, syncNow, syncSoon, syncCode, syncUrl, setSync, syncEnabled } from '../engine/sync';
import { server, onServer, connectVoice } from '../engine/boot';
import { stat } from '../engine/srs';
import { josa } from '../lib/hangul';
import { ITEM_LIST, ITEM } from '../data/pets';
import { unlockTable } from '../data/unlock';
import { STAGES, CATS, DAY_MIN_CHOICES, TIME_CHOICES, ITEM_EVERY, MAT_EVERY, SP_CAT, catSecRange } from '../math/mathData';
import { mathState, todayMath, todayCat, mathTotalCorrect, mathMatsLeft, mathSnackTotal, mathPetView, setMathLv, setMathDayMin, setMathTime, setMathName, modeTitle, spellStats, spellWrong } from '../math/mathStore';
import { SENTS, SP_SEC_RANGE, makeSpellQ } from '../math/spellData';
import { GateParent } from './GateUI';
import { Stepper } from './Stepper';
import { RANGE, letterSetCount, letterReps, dictReps, catMax, upMin, passRate, setStudy } from '../lib/studyCfg';
import { letterSets } from '../engine/session';
import '../math/math.css';

// ---------- 제목 ----------
export function Title({ onStart, onMath }: { onStart: () => void; onMath?: () => void }) {
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
      <Backdrop theme="title" />
      <div class="layer">
        <div class="title-logo slide-up" style={{ fontSize: 96 }}>{appTitle(load().name)}<small>한글 모험을 떠나요!</small></div>
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
        {/* 수학·맞춤법 모드 (초등 2학년 아이 — 한글과 따로). 버튼 이름은 부모 설정의 '화면 이름'(기기 저장값, 10-25 사용자 요청으로 '○○ 수학' 대신 이름만), 없으면 '수학·맞춤법' */}
        {onMath && <button class="btn sky m-math-btn" data-math-start="1" onClick={(e) => { e.stopPropagation(); onMath(); }}>✏️ {modeTitle()}</button>}
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
        <div style={{ fontSize: 64, color: '#fff', textShadow: '0 4px 0 rgba(60,30,90,.45), 0 0 22px rgba(40,20,80,.55)' }}>{waking ? '다시 놀 수 있어요! ☀️' : '오늘은 여기까지! 🌙'}</div>
        <div style={{ fontSize: 32, color: '#f3edff', textShadow: '0 3px 0 rgba(60,30,90,.45), 0 0 16px rgba(40,20,80,.6)' }}>{hasResume ? '하던 모험은 시간이 되면 그 자리부터 이어서 해요 🚩' : '내일 또 모험하자'}</div>
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
                <WordPic word={JAMO[sel].ex.word} emoji={JAMO[sel].ex.emoji} size={130} />
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
              <WordPic word={w.text} emoji={w.emoji} size={100} /><div style={{ fontSize: 36 }}>{w.text}</div>
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
  [/local_read/, '이 기기의 기존 기록을 먼저 복구해 주세요'],
  [/bad_state/, '받은 기록을 확인할 수 없어 이 기기의 기록을 그대로 보관했어요'],
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
  const copyBackup = async () => {
    if (!code) { setMsg('먼저 백업 코드를 만들어 주세요.'); return; }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard');
      await navigator.clipboard.writeText(code); setMsg('복사했습니다.');
    } catch { setMsg('자동으로 복사하지 못했어요. 아래 백업 코드를 길게 눌러 복사해 주세요.'); }
  };
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
      {!isStorageOk() && <p style={{ color: '#c92a2a' }}>{storageNeedsRecovery()
        ? '⚠️ 기존 기록을 읽지 못해 원본을 보존하고 저장·연동을 잠시 멈췄습니다. 앱을 다시 열거나 보관한 정상 백업 코드로 복원해 주세요.'
        : "⚠️ 이 브라우저에서 진도가 저장되지 않고 있습니다. 연동을 켜 두거나 '백업 코드'로 진도를 옮겨 두세요."}</p>}

      <h3>오늘</h3>
      <div class="row">사용 {min}분{limit ? ` / ${limit}분` : ' (제한 없음)'} · 새 단계 {todayLessons()}/{s.settings.newPerDay + todayExtraLessons()}개 · 현재 {Math.min(s.lessonIdx + 1, LESSONS.length)}/{LESSONS.length}단계 ({UNITS[lesson.unit - 1].name} · {lesson.title})</div>
      <div class="row">
        <button class="opt" onClick={() => { giveExtraMinutes(10); done('오늘 10분을 더 주었습니다.'); }}>오늘 +10분</button>
        <button class="opt" onClick={() => { giveExtraMinutes(30); done('오늘 30분을 더 주었습니다.'); }}>오늘 +30분</button>
        <button class="opt" onClick={() => { giveExtraLesson(); done('오늘 새 단계를 1개 더 열었습니다.'); }}>새 단계 +1개</button>
      </div>

      <StudyParent onSaved={done} jumpTo={jumpTo} />

      <GateParent onSaved={done} />

      <h3>초기화</h3>
      <div class="row">
        <button class="opt" disabled={storageNeedsRecovery()} style={{ color: '#c92a2a' }} onClick={() => setAsk('progress')}>공부 진도만 처음부터</button>
        <button class="opt" style={{ color: '#c92a2a' }} onClick={() => setAsk('all')}>전체 초기화</button>
        <span style={{ fontSize: 16, color: '#868e96' }}>진도만: 1단계부터 다시 (강아지·고양이·꾸미기·간식·별은 그대로) · 전체: 모두 처음으로 (이름·설정·연동은 그대로). 연동된 다른 기기도 같이 바뀝니다.</span>
      </div>
      {ask && (
        <div class="overlay" style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(40,20,60,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 34px', maxWidth: 560, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 26, fontWeight: 'bold', marginBottom: 12 }}>{ask === 'all' ? '전체 초기화할까요?' : '공부 진도를 처음부터 할까요?'}</div>
            <div style={{ fontSize: 18, color: '#555', marginBottom: 22 }}>{ask === 'all' ? '진도, 강아지·고양이 성장, 꾸미기 아이템, 간식, 별이 모두 지워집니다. 수학 기록은 그대로 둡니다.' : '1단계부터 다시 시작합니다. 강아지·고양이·꾸미기·간식·별은 그대로입니다.'} 되돌릴 수 없습니다.</div>
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
      <div class="row" style={{ fontSize: 16, color: '#868e96' }}>하루 사용 시간·하루 새 단계·쓰기 횟수·받아쓰기는 위 '📚 공부량·진도'에서 고칩니다.</div>
      <div class="row" style={{ fontSize: 18, color: '#666' }}>시험 상태: {s.hold ? `복습 시험 불합격 → ${s.hold.lesson + 1}단계 다시 공부 중` : s.lastPass ? `마지막 통과 ${s.lastPass.lesson + 1}단계 (${s.lastPass.items.join(' ')})` : '아직 없음'}</div>
      <div class="row">말 빠르기 {[[0.85, '느리게'], [1, '보통'], [1.15, '빠르게']].map(([v, l]) => <Opt on={s.settings.voiceRate === v} onClick={() => { setSettings({ voiceRate: v as number }); done('저장했습니다.'); }}>{l}</Opt>)}</div>
      <div class="row">배경 음악 <Opt on={s.settings.music} onClick={() => { setSettings({ music: true }); done('저장했습니다.'); }}>켜기</Opt><Opt on={!s.settings.music} onClick={() => { setSettings({ music: false }); done('저장했습니다.'); }}>끄기</Opt></div>
      <div class="row">음성: {hasPack() ? '녹음 음성 사용 중' : '기기 내장 음성 사용 중 (녹음 음성 없음)'}</div>
      <div class="row" style={{ fontSize: 18, color: '#666' }} data-build={__BUILD__}>앱 버전: {__BUILD__}</div>

      <MathParent onSaved={done} />

      <h3>글자별 숙련도 (0=처음 ~ 5=완전히 익힘)</h3>
      <div class="row" style={{ gap: 6 }}>
        {ORDER.map(ch => { const b = box(ch); return <div style={{ width: 54, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: b < 0 ? '#f1f3f5' : boxColor[b], color: b < 0 ? '#adb5bd' : '#333', fontSize: 22 }}>{ch}<br /><small style={{ fontSize: 14 }}>{b < 0 ? '-' : b}</small></div>; })}
      </div>
      {weak.length > 0 && <div class="row">자주 틀린 것: {weak.map(w => <span style={{ background: '#fff0f6', padding: '4px 10px', borderRadius: 8 }}>{w.k.slice(2)} ({w.st.wrong}/{w.st.seen})</span>)}</div>}

      <h3>최근 2주 (두 기기 합계)</h3>
      <table><tr><th>날짜</th>{hist.map(h => <th>{fmtDay(h.day)}</th>)}</tr><tr><td>분</td>{hist.map(h => <td>{Math.round(h.ms / 60000)}</td>)}</tr><tr><td>새 단계</td>{hist.map(h => <td>{h.lessons}</td>)}</tr></table>

      <h3>체험 모드</h3>
      <div class="row">
        <Opt on={demo} onClick={() => onDemo(!demo)}>체험 모드 {demo ? '켜짐' : '꺼짐'}</Opt>
        <span style={{ fontSize: 16, color: '#868e96' }}>켜면 시간 제한 없이 모든 단계를 눌러 볼 수 있고, 화면 오른쪽 위 ⏭로 장면을 넘길 수 있습니다. 앱을 다시 열면 꺼집니다.</span>
      </div>

      <h3>진도 백업</h3>
      <div class="row"><button class="opt" disabled={storageNeedsRecovery()} onClick={() => { setCode(exportCode()); setMsg('아래 코드를 복사해 두세요.'); }}>백업 코드 만들기</button>
        <button class="opt" onClick={() => { const ok = importCode(code); if (ok) { setNameIn(load().name); done('불러왔습니다.'); } else setMsg('코드가 올바르지 않습니다.'); }}>코드로 불러오기</button>
        <button class="opt" onClick={copyBackup}>복사</button></div>
      <textarea value={code} onInput={(e: any) => setCode(e.target.value)} placeholder="백업 코드 (예전 '몽글이' 앱의 백업 코드도 불러올 수 있습니다)" />

      {msg && <p style={{ color: '#5f3dc4', position: 'sticky', bottom: 0, background: '#f3efff', padding: 12, borderRadius: 10 }}>{msg}</p>}
      <p style={{ fontSize: 15, color: '#999' }}>꾸미기 아이템 {s.owned.filter(id => ITEM[id]).length}/{ITEM_LIST.length} · 간식 {snackTotal()}개 · {petView('dog').name} Lv.{petView('dog').level} · {petView('cat').name} Lv.{petView('cat').level} · 별 {starsTotal()} · 누적 모험 {adventuresTotal()}회 · 오늘 {fmtDay(today())} · 기기 {dev()}</p>
      <p style={{ fontSize: 15, color: '#999' }} data-unlock-table="1">레벨이 오르면 열리는 것(크기는 그대로 — 친구마다 간식 먹은 점수로 레벨, 한글·수학 같음): {unlockTable().map(r => `Lv.${r.lv} ${r.text}`).join(' / ')} — 꾸미기는 그 친구, 강아지 집·고양이 집은 지금 그 집 친구, 놀이터는 둘 중 높은 레벨. 이미 입힌 것·지은 것은 그대로.</p>
    </div>
  );
}

function fmtDay(d: number) {
  const dt = new Date(d * 86400000);
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}

// ---------- 부모 설정: 수학·맞춤법 (초등 2학년 아이 — 한글 진도와 따로) ----------
function MathParent({ onSaved }: { onSaved: (m: string) => void }) {
  const m = mathState();
  const t = todayMath(m);
  const [nameIn, setNameIn] = useState(m.name);
  const [showWrong, setShowWrong] = useState(false);
  const sp = spellStats(m), spToday = todayCat(SP_CAT, m);
  const Opt = ({ on, children, onClick }: any) => <button class={`opt ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>;
  return (
    <>
      <h3>수학·맞춤법{m.name ? ` (${m.name})` : ''}</h3>
      <div class="row" data-math-parent="1">오늘 공부 {Math.floor(t.ms / 60000)}분/{m.dayMin}분 · {t.solved}문제 · 맞힘 {t.correct}개 · 지금까지 맞힌 문제 {mathTotalCorrect(m)}개 · 옷장 꾸미기 {m.owned.length}/{ITEM_LIST.length} · 재료 {mathMatsLeft(m)}개 · 간식 {mathSnackTotal(m)}개
        {(['dog', 'cat'] as const).map(k => { const v = mathPetView(k, m); return ` · ${v.name} Lv.${v.level}`; })}</div>
      <div class="row">화면 이름 <input type="text" value={nameIn} onInput={(e: any) => setNameIn(e.target.value)} style={{ width: 160 }} data-math-name="1" />
        <button class="opt" onClick={() => { setMathName(nameIn); setNameIn(mathState().name); onSaved(nameIn.trim() ? `첫 화면 버튼과 제목이 '${nameIn.trim().slice(0, 10)}'(으)로 보입니다.` : `이름을 비웠습니다. 첫 화면 버튼은 '${modeTitle()}'(으)로 보입니다.`); }}>저장</button>
        <span style={{ fontSize: 16, color: '#868e96' }}>첫 화면 버튼·제목(이름만, 없으면 '수학·맞춤법')과 '○○ 옷장', '○○ 집 꾸미기'에 보임 (이 기기와 연동된 기기에만 저장)</span></div>
      <div class="row" data-spell-parent="1">✍️ 맞춤법: 문제 {sp.total}개(문장 {SENTS.length}개) · 풀어 본 문제 {sp.seen}개 · 지금 틀린 문제 {sp.wrong}개 · 오늘 {spToday.solved}문제 중 {spToday.correct}개 맞힘
        {sp.wrong > 0 && <button class="opt" onClick={() => setShowWrong(x => !x)}>{showWrong ? '틀린 문제 닫기' : '틀린 문제 보기'}</button>}</div>
      {showWrong && <div class="row" style={{ fontSize: 17, color: '#495057', display: 'block', lineHeight: 1.6 }} data-spell-wrong-list="1">
        {spellWrong(m).map(k => { const q = makeSpellQ(k, () => 0); return q ? <div>• {q.before}<b style={{ color: '#2b8a3e' }}>{q.ans}</b>{q.after} <span style={{ color: '#c92a2a' }}>(틀린 말: {q.wrong})</span></div> : null; })}
      </div>}
      <div class="row" style={{ fontSize: 16, color: '#868e96' }}>항목마다 단계·하루 공부 시간·하루 문제 수·다음 단계 조건·문제 시간은 위 '📚 공부량·진도'에서 고칩니다.</div>
      <div class="row" style={{ fontSize: 16, color: '#868e96' }}>
        항목마다 단계가 따로 · 하루 공부 시간이 끝날 때(또는 그 항목을 {catMax()}문제 다 풀 때), 그날 그 항목을 {upMin()}문제 이상 풀고 {Math.round(passRate() * 100)}% 이상 맞혔으면 그 항목만 다음 단계(하루 한 단계까지 — 그날 단계를 직접 바꾼 항목은 다음 날 판정) · 정답 {ITEM_EVERY}개마다 꾸미기, {MAT_EVERY}개마다 집 재료와 간식(틀려도 안 가져감, 간식은 수학 '간식 주기'에서 먹임 — 강아지·고양이는 한글처럼 아기부터 간식 점수만큼 자람) ·
        한글 진도·하루 사용 시간·한글 옷장·한글 집과 따로 · '골고루'만 풀면 항목마다 문제 수가 적어 단계가 거의 안 오름(복습용) · 두 기기 연동됨<br />
        맞춤법: 속담·명언·좋은 말 문장 속 괄호에서 바른 말 둘 중 하나 고르기(단계 없음, 쉬운 문제가 먼저 나오기 쉬움) · 같은 문장도 괄호 자리를 바꿔 다시 나옴 · 틀린 문제는 다음에 다시 나오고(열 문제쯤 뒤·다음 날), 맞히면 이틀 뒤 한 번 더 확인 · '틀린 문제 다시 풀기'로 따로 풀 수 있음 · 하루 공부 시간·하루 {catMax()}문제·정답 보상은 수학과 같이 셈
      </div>
    </>
  );
}

// ---------- 부모 설정: 📚 공부량·진도 (11-07 사용자 요청 — "진도랑 하루 공부량이랑 다 디테일하게 내가 일일이 수정할 수 있게,
//  한글이랑 수학이랑 횟수랑 시간이랑 다") — 값과 범위는 lib/studyCfg.ts, 누를 때마다 바로 저장·연동 ----------
const GUIDE_NAME: Record<string, string> = { full: '따라 쓰기', faint: '흐린 선', none: '혼자' };
/** '따라 쓰기 5 · 흐린 선 5' */
function guideText(gs: string[]) {
  const n: Record<string, number> = {};
  gs.forEach(g => { n[g] = (n[g] || 0) + 1; });
  return ['full', 'faint', 'none'].filter(k => n[k]).map(k => `${GUIDE_NAME[k]} ${n[k]}`).join(' · ');
}
const fmtMinute = (n: number) => (n >= 60 && n % 60 === 0 ? `${n / 60}시간` : n > 60 ? `${Math.floor(n / 60)}시간 ${n % 60}분` : `${n}분`);

function StudyParent({ onSaved, jumpTo }: { onSaved: (m: string) => void; jumpTo: (idx: number) => void }) {
  const s = load();
  const m = mathState();
  const Opt = ({ on, children, onClick }: any) => <button class={`opt ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>;
  const cur = Math.min(s.lessonIdx, LESSONS.length - 1);
  const lesson = LESSONS[cur];
  const sets = letterSets();
  const ls = letterSetCount(), lr = letterReps();
  const later = '다음 모험부터 적용됩니다. (하던 모험은 그대로)';
  const dm = s.settings.dailyMin;
  const cm = catMax(), um = upMin(), up = Math.round(passRate() * 100);
  return (
    <>
      <h3>📚 공부량·진도</h3>
      <div class="study-note" style={{ margin: '0 0 6px' }}>－ / ＋ 를 누를 때마다 바로 저장되고, 연동된 다른 기기에도 같이 바뀝니다. 기본값: 한글 새 글자 10번×4세트·하루 30분·새 단계 1개 / 수학 하루 30분·항목당 150문제·20문제 이상 90%면 다음 단계.</div>

      <div class="study-box" data-study="h">
        <h4>한글</h4>
        <div class="row" data-study-progress="1"><span class="study-lbl">진도</span>
          <button class="opt" disabled={storageNeedsRecovery() || cur <= 0} onClick={() => jumpTo(cur - 1)}>◀ 앞 단계</button>
          <select disabled={storageNeedsRecovery()} style={{ fontSize: 20, padding: 8, maxWidth: 520 }} onChange={(e: any) => jumpTo(+e.target.value)} value={cur}>
            {LESSONS.map((l, i) => <option value={i}>{i + 1}. {UNITS[l.unit - 1].name} · {l.title}</option>)}
          </select>
          <button class="opt" disabled={storageNeedsRecovery() || cur >= LESSONS.length - 1} onClick={() => jumpTo(cur + 1)}>다음 단계 ▶</button>
          <span class="study-note">지금 {cur + 1}/{LESSONS.length}단계 ({UNITS[lesson.unit - 1].name} · {lesson.title}) · 옮기면 앞 단계 글자는 '익힌 것'으로 처리, 오늘 새 단계 수는 0부터</span></div>
        <div class="row" data-study-row="dailyMin"><span class="study-lbl">하루 사용 시간</span>
          <Stepper id="dailyMin" value={dm} r={RANGE.dailyMin} fmt={v => (v ? fmtMinute(v) : '제한 없음')} presets={[20, 30, 45, 60]} onSet={v => { setSettings({ dailyMin: v }); onSaved(`한글 하루 사용 시간을 ${fmtMinute(v)}으로 바꿨습니다.`); }} />
          <Opt on={!dm} onClick={() => { setSettings({ dailyMin: 0 }); onSaved('한글 하루 사용 시간: 제한 없음'); }}>제한 없음</Opt></div>
        <div class="row" data-study-row="newPerDay"><span class="study-lbl">하루 새 단계</span>
          <Stepper id="newPerDay" value={s.settings.newPerDay} r={RANGE.newPerDay} fmt={v => `${v}개`} onSet={v => { setSettings({ newPerDay: v }); onSaved(`하루 새 단계를 ${v}개로 바꿨습니다. ('공부 먼저' 한글 학습량도 같은 값)`); }} /></div>
        <div class="row" data-study-row="letter"><span class="study-lbl">새 글자 쓰기</span>
          <Stepper id="ls" value={ls} r={RANGE.ls} fmt={v => `${v}세트`} onSet={v => { setStudy({ ls: v }); onSaved(`새 글자 쓰기 ${v}세트 × ${lr}번 = 글자마다 ${v * lr}번. ${later}`); }} />
          <span>×</span>
          <Stepper id="lr" value={lr} r={RANGE.lr} fmt={v => `${v}번`} presets={[5, 10]} onSet={v => { setStudy({ lr: v }); onSaved(`새 글자 쓰기 ${ls}세트 × ${v}번 = 글자마다 ${ls * v}번. ${later}`); }} />
          <b data-letter-total={ls * lr}>= 글자마다 {ls * lr}번 · 놀이 {ls}판</b></div>
        <div class="row study-note" style={{ display: 'block', margin: '0 0 8px', lineHeight: 1.6 }} data-letter-plan="1">
          {sets.map((g, i) => <span>{i + 1}세트: {guideText(g)} → 놀이{i < sets.length - 1 ? ' / ' : ''}</span>)}<br />
          세트 수 = 세트 사이 놀이 수. 처음 세트는 따라 쓰기(화살표·번호), 뒤로 갈수록 흐린 선 → 그림자 없이 혼자 쓰기로 바뀝니다.
        </div>
        <div class="row" data-study-row="traceReps"><span class="study-lbl">받침·낱말 쓰기 (세트마다)</span>
          <Stepper id="traceReps" value={Math.max(1, Math.min(15, s.settings.traceReps || 10))} r={RANGE.traceReps} fmt={v => `${v}번`} presets={[5, 10, 15]} onSet={v => { setSettings({ traceReps: v }); onSaved(`받침·낱말 단계 쓰기를 세트마다 ${v}번으로 바꿨습니다. ${later}`); }} />
          <span class="study-note">받침·낱말·복습 단계는 3세트(사이사이 놀이), 끝 몇 번은 혼자 쓰기</span></div>
        <div class="row" data-study-row="dict"><span class="study-lbl">받아쓰기 시험</span>
          <span>글자마다</span>
          <Stepper id="dr" value={dictReps()} r={RANGE.dr} fmt={v => `${v}번`} onSet={v => { setStudy({ dr: v }); onSaved(`받아쓰기는 글자마다 ${v}번 묻습니다. 다음 시험부터 적용됩니다.`); }} />
          <span>통과</span>
          <Stepper id="testPass" value={s.settings.testPass || 80} r={RANGE.testPass} fmt={v => `${v}%`} onSet={v => { setSettings({ testPass: v }); onSaved(`받아쓰기 통과 기준을 ${v}%로 바꿨습니다. 다음 시험부터 적용됩니다.`); }} /></div>
        <div class="row study-note" style={{ margin: '0 0 6px' }}>그날 끝 시험에 떨어지면 다음 단계가 안 열리고, 다음날 복습 시험에 떨어지면 전 단계를 다시 공부합니다(이 규칙은 그대로).</div>
      </div>

      <div class="study-box" data-study="m">
        <h4>수학·맞춤법{m.name ? ` (${m.name})` : ''}</h4>
        {CATS.map(c => (
          <div class="row" style={{ gap: 6 }} data-math-cat={c.id}><span class="study-lbl">{c.icon} {c.name} 진도</span>
            {c.stages.map((st, i) => <Opt on={m.lv[c.id] === i} onClick={() => { setMathLv(c.id, i); onSaved(`${c.name}을 ${i + 1}단계(${STAGES[st].name} ${STAGES[st].sub})로 바꿨습니다.`); }}>{i + 1}. {STAGES[st].name} · {STAGES[st].sub}</Opt>)}
          </div>
        ))}
        <div class="row" data-math-daymin="1"><span class="study-lbl">하루 공부 시간</span>
          <Stepper id="dayMin" value={m.dayMin} r={RANGE.dayMin} fmt={fmtMinute} presets={DAY_MIN_CHOICES} onSet={v => { setMathDayMin(v); onSaved(`수학·맞춤법 하루 공부 시간을 ${fmtMinute(v)}으로 바꿨습니다. 오늘 공부한 시간은 그대로 셉니다.`); }} />
          <span class="study-note">문제 화면에서만 셈(3분 넘게 안 만지면 멈춤) · 다 되면 풀던 문제까지 풀고 끝</span></div>
        <div class="row" data-study-row="cm"><span class="study-lbl">한 항목 하루 최대</span>
          <Stepper id="cm" value={cm} r={RANGE.cm} fmt={v => `${v}문제`} presets={[50, 100, 150]} onSet={v => { setStudy({ cm: v }); onSaved(`덧셈·뺄셈·곱셈·나눗셈·맞춤법은 하루 항목마다 ${v}문제까지 풉니다.`); }} /></div>
        <div class="row" data-study-row="up"><span class="study-lbl">다음 단계 조건</span>
          <span>그날</span>
          <Stepper id="um" value={um} r={RANGE.um} fmt={v => `${v}문제 이상`} onSet={v => { setStudy({ um: v }); onSaved(`그날 그 항목을 ${v}문제 이상 풀고 ${up}% 이상 맞히면 다음 단계로 갑니다.`); }} />
          <Stepper id="up" value={up} r={RANGE.up} fmt={v => `${v}% 이상`} onSet={v => { setStudy({ up: v }); onSaved(`그날 그 항목을 ${um}문제 이상 풀고 ${v}% 이상 맞히면 다음 단계로 갑니다.`); }} /></div>
        {um > cm && <div class="row" style={{ color: '#c92a2a', fontSize: 18 }} data-study-warn="up">⚠️ 다음 단계에 필요한 문제 수({um})가 하루 최대({cm})보다 많아 단계가 오르지 않습니다.</div>}
        <div class="row study-note" style={{ margin: '0 0 6px' }}>공부 시간이 끝날 때(또는 그 항목을 하루 최대까지 풀 때) 판정 · 하루 한 단계까지</div>
        <div class="row" data-study-row="timeMul"><span class="study-lbl">문제마다 시간</span>
          <Stepper id="timeMul" value={m.timeMul} r={RANGE.timeMul} fmt={v => (v ? `×${v}` : '끄기')} presets={TIME_CHOICES.filter(([v]) => v > 0).map(([v]) => v)} onSet={v => { setMathTime(v); onSaved(`문제 시간 ×${v} — 다음 문제부터 적용됩니다.`); }} />
          <Opt on={m.timeMul === 0} onClick={() => { setMathTime(0); onSaved('문제 시간 제한을 껐습니다.'); }}>끄기</Opt></div>
        <div class="row study-note" style={{ margin: '0 0 6px' }}>
          {m.timeMul ? <>지금 문제 시간: {CATS.map(c => { const [a, b] = catSecRange(c.id); const f = (x: number) => Math.round(x * m.timeMul); return `${c.name} ${a === b ? f(a) : `${f(a)}~${f(b)}`}초`; }).join(' · ')} · 맞춤법 {Math.round(SP_SEC_RANGE[0] * m.timeMul)}~{Math.round(SP_SEC_RANGE[1] * m.timeMul)}초 (×1 = 보통)</> : '문제 시간 제한 없음'} — 시간이 다 되면 틀린 것으로 하고 정답을 보여 줌
        </div>
      </div>
    </>
  );
}
