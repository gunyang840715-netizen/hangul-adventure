// 소리: 녹음 음성팩(있으면) → 없으면 기기 내장 음성. 효과음·배경음은 직접 합성.
import { load } from './store';
import { buddy } from './bus';

/** 캐릭터 목소리 묶음: 앱 문장 → 녹음 키 목록 (d=강아지 유라, c=고양이 명쾌한, f=그 목소리로 고정) */
type CharPool = { d?: string[]; c?: string[]; f?: 'd' | 'c' };
declare global { interface Window { __VOICE__?: Record<string, string>; __VOICE_ALIAS__?: Record<string, string>; __VOICE_POOL__?: Record<string, CharPool>; __VOICE_EX__?: { d?: Record<string, CharEx>; c?: Record<string, CharEx> } } }
/** 글자별 예시 낱말(캐릭터가 말하는 것): w=낱말, e=그림, k=녹음 키 */
export type CharEx = { w: string; e: string; k: string };

let ctx: AudioContext | null = null;
let master: GainNode, sfxGain: GainNode, musicGain: GainNode, voiceGain: GainNode;

export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
    voiceGain = ctx.createGain(); voiceGain.gain.value = 1.0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.15;
    voiceGain.connect(limiter); limiter.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 첫 터치에서 호출: 오디오/음성 잠금 해제 */
export function unlock() {
  audioCtx();
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; speechSynthesis.speak(u);
  } catch { /* 없음 */ }
}

// ---------------- 음성 ----------------
const decoded = new Map<string, AudioBuffer>();
const levels = new Map<string, { gain: number; silent: boolean }>();
const unavailable = new Set<string>();
let current: AudioBufferSourceNode | null = null;
let finishCurrent: (() => void) | null = null;
let speaking = 0;
const listeners = new Set<(on: boolean) => void>();
export function onSpeaking(f: (on: boolean) => void) { listeners.add(f); return () => listeners.delete(f); }
function setSpeaking(d: number) { speaking = Math.max(0, speaking + d); listeners.forEach(f => f(speaking > 0)); }

function koVoice(): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ko'));
  return vs.find(v => /google/i.test(v.name)) ?? vs[0];
}
try { speechSynthesis.onvoiceschanged = () => koVoice(); } catch { /* 없음 */ }

// ---------------- 녹음 음성 모음 ----------------
// 1) 앱과 함께 받은 음성팩(voice.json 또는 파일 안에 넣은 것)
// 2) 서버에서 새로 받아 이 기기에 저장한 문장(IndexedDB)
const extra = new Map<string, string>();
let packCount = -1;
export function hasPack() {
  if (packCount < 0) packCount = (window.__VOICE__ ? Object.keys(window.__VOICE__).length : 0);
  return packCount + extra.size > 0;
}

/** voice.json 불러오기 (앱 설치 방식). 진행률은 packLoad로 */
export const packLoad = { progress: 0, done: false };
const packSubs = new Set<() => void>();
export function onPackLoad(f: () => void) { packSubs.add(f); return () => { packSubs.delete(f); }; }
function packNote(p: Partial<typeof packLoad>) { Object.assign(packLoad, p); packSubs.forEach(f => f()); }

/** 음성이 파일 안에 들어 있는 경우(파일 하나 버전) */
export function markPackDone() { packNote({ progress: 1, done: true }); }

/** 음성팩 불러오기. 파일이 여러 조각이면 차례로 받아 합친다 (진행률은 전체 기준) */
export async function loadVoicePack(urls: string | string[], bytes = 0) {
  const list = Array.isArray(urls) ? urls : [urls];
  let gotAll = 0, lastNote = 0;
  let tm = 0 as any;
  for (const url of list) {
    try {
      const ctl = new AbortController();
      tm = setTimeout(() => ctl.abort(), 90000);     // 느린 인터넷에서 멈춰 버리면 포기하고 다음으로
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('http ' + r.status);
      let text = '';
      if (r.body && bytes > 0) {
        const reader = r.body.getReader();
        const parts: Uint8Array[] = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value); got += value.length; gotAll += value.length;
          if (gotAll - lastNote > 200000) { lastNote = gotAll; packNote({ progress: Math.min(0.99, gotAll / bytes) }); }
        }
        const all = new Uint8Array(got);
        let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
        text = new TextDecoder().decode(all);
      } else text = await r.text();
      const j = JSON.parse(text);
      clearTimeout(tm);
      window.__VOICE__ = { ...(j.voices || {}), ...(window.__VOICE__ || {}) };
      window.__VOICE_ALIAS__ = { ...(j.alias || {}), ...(window.__VOICE_ALIAS__ || {}) };
      // 같은 문장에 추가한 녹음도 결합한다. 기존 고정 목소리와 순서는 유지.
      const pools = { ...(window.__VOICE_POOL__ || {}) };
      for (const [line, value] of Object.entries(j.pool || {}) as [string, CharPool][]) {
        const old = pools[line];
        pools[line] = { ...value, ...old,
          d: [...new Set([...(old?.d || []), ...(value.d || [])])],
          c: [...new Set([...(old?.c || []), ...(value.c || [])])],
        };
      }
      window.__VOICE_POOL__ = pools;
      if (j.ex) window.__VOICE_EX__ = { d: { ...(j.ex.d || {}), ...(window.__VOICE_EX__?.d || {}) }, c: { ...(j.ex.c || {}), ...(window.__VOICE_EX__?.c || {}) } };
      packCount = -1;
    } catch { clearTimeout(tm); /* 없으면 기기 음성 */ }
  }
  packNote({ progress: 1, done: true });
}

/**
 * 캐릭터 목소리: 칭찬·다시 하기·인사·마무리처럼 친구가 하는 말은 아이가 고른 대표 친구(강아지 유라 / 고양이 명쾌한)의
 * 녹음 묶음에서 돌아가며 고른다. 그 친구의 녹음이 없으면 null → 기존 음성으로 말한다.
 */
const lastPick = new Map<string, string>();
/** 아이 이름이 들어간 말은 묶음에 '{이름}'으로 적혀 있다 */
function poolEntry(text: string): CharPool | undefined {
  const P = window.__VOICE_POOL__;
  if (!P) return undefined;
  if (P[text]) return P[text];
  const nm = load().name;
  if (nm && text.startsWith(nm)) return P['{이름}' + text.slice(nm.length).replace(/^[아야]/, '')];
  return undefined;
}
/** 대표 친구(강아지/고양이)가 말하는 글자 예시 낱말. 없으면 null → 기존 예시 낱말 */
export function petEx(ch: string): CharEx | null {
  const E = window.__VOICE_EX__?.[load().lead === 'cat' ? 'c' : 'd']?.[ch];
  return E && window.__VOICE__?.[E.k] ? E : null;
}
function poolKey(text: string): string | null {
  const e = poolEntry(text);
  if (!e) return null;
  const who = e.f || (load().lead === 'cat' ? 'c' : 'd');
  const v = window.__VOICE__ || {};
  const list = (who === 'c' ? e.c : e.d)?.filter(k => !!v[k] && !unavailable.has(k)) || [];
  if (!list.length) return null;
  const last = lastPick.get(text + who);
  const cand = list.length > 1 ? list.filter(k => k !== last) : list;
  const k = cand[Math.floor(Math.random() * cand.length)];
  lastPick.set(text + who, k);
  return k;
}

/** 녹음 찾기 (같은 뜻의 다른 문장으로 연결된 것 포함) → base64 */
function b64For(text: string): string | null {
  const t = text.trim();
  const p = window.__VOICE__ || {};
  if (p[t]) return p[t];
  if (extra.has(t)) return extra.get(t)!;
  const a = window.__VOICE_ALIAS__?.[t];
  if (a) return p[a] || extra.get(a) || null;
  return null;
}
export function hasClip(text: string) {
  const t = text.trim();
  const e = poolEntry(t);
  if (e) {
    const who = e.f || (load().lead === 'cat' ? 'c' : 'd');
    if ((who === 'c' ? e.c : e.d)?.some(k => !!window.__VOICE__?.[k] && !unavailable.has(k))) return true;
  }
  return !unavailable.has(t) && !!b64For(t);
}

/** 녹음 앞뒤의 빈 소리를 잘라 낸다 (말이 끝나고 한참 기다리는 느낌 없애기) */
function trimSilence(buf: AudioBuffer, gain: number): AudioBuffer {
  const sr = buf.sampleRate;
  const d = buf.getChannelData(0);
  const win = Math.max(1, Math.round(sr * 0.01));
  let first = -1, last = -1;
  for (let i = 0; i + win <= d.length; i += win) {
    let s = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const channel = buf.getChannelData(c);
      for (let j = i; j < i + win; j++) s += channel[j] * channel[j];
    }
    if (Math.sqrt(s / (win * buf.numberOfChannels)) * gain > 0.012) { if (first < 0) first = i; last = i + win; }
  }
  if (first < 0) return buf;
  const start = Math.max(0, first - Math.round(sr * 0.045));
  const end = Math.min(d.length, last + Math.round(sr * 0.1));
  if (start < sr * 0.03 && d.length - end < sr * 0.05) return buf;   // 이미 짧음
  const out = audioCtx().createBuffer(buf.numberOfChannels, end - start, sr);
  const fade = Math.round(sr * 0.012);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c).slice(start, end);
    for (let i = 0; i < fade && i < src.length; i++) { src[i] *= i / fade; src[src.length - 1 - i] *= i / fade; }
    out.copyToChannel(src, c);
  }
  return out;
}

/** 20ms마다 무음 구간을 제외한 말소리 평균을 재서 재생 배율을 기억한다. */
export function recordedLevel(buf: Pick<AudioBuffer, 'sampleRate' | 'length' | 'numberOfChannels' | 'getChannelData'>) {
  const win = Math.max(1, Math.round(buf.sampleRate * 0.02));
  const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  let energy = 0, active = 0, peakWindow = 0;
  for (let start = 0; start < buf.length; start += win) {
    const end = Math.min(start + win, buf.length);
    let sum = 0;
    for (const channel of channels) for (let j = start; j < end; j++) sum += channel[j] * channel[j];
    const count = (end - start) * channels.length;
    const rms = Math.sqrt(sum / count);
    peakWindow = Math.max(peakWindow, rms);
    if (rms > Math.pow(10, -45 / 20)) { energy += sum; active += count; }
  }
  const rms = active ? Math.sqrt(energy / active) : peakWindow;
  const silent = !Number.isFinite(rms) || rms < Math.pow(10, -50 / 20);
  return { gain: silent ? 1 : Math.max(0.5, Math.min(30, Math.pow(10, -17 / 20) / rms)), silent };
}

async function decodedClip(id: string, b64: string): Promise<AudioBuffer | null> {
  if (unavailable.has(id)) return null;
  if (decoded.has(id)) return decoded.get(id)!;
  try {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const raw = await audioCtx().decodeAudioData(bin.buffer);
    const level = recordedLevel(raw);
    levels.set(id, level);
    if (level.silent) { unavailable.add(id); return null; }
    const buf = trimSilence(raw, level.gain);
    decoded.set(id, buf);
    return buf;
  } catch { unavailable.add(id); return null; }
}

async function clip(text: string): Promise<{ buffer: AudioBuffer; gain: number } | null> {
  const t = text.trim();
  // 무음·깨진 녹음이면 같은 목소리 묶음에서 다시 고른 뒤 기존 음성팩으로 돌아간다.
  const tried = new Set<string>();
  for (;;) {
    const pk = poolKey(t);
    if (!pk || tried.has(pk)) break;
    tried.add(pk);
    const buf = await decodedClip(pk, window.__VOICE__![pk]);
    if (buf) return { buffer: buf, gain: levels.get(pk)!.gain };
  }
  const b64 = b64For(t);
  if (!b64) return null;
  const buf = await decodedClip(t, b64);
  return buf ? { buffer: buf, gain: levels.get(t)!.gain } : null;
}

// ---------- 서버에서 받은 음성 저장 (IndexedDB) ----------
function idb(): Promise<IDBDatabase | null> {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('hangul-voice', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('lines');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch { res(null); }
  });
}
export async function loadSavedVoices() {
  const db = await idb();
  if (!db) return;
  await new Promise<void>(res => {
    const tx = db.transaction('lines', 'readonly');
    const st = tx.objectStore('lines');
    const rq = st.openCursor();
    rq.onsuccess = () => {
      const c = rq.result;
      if (c) { extra.set(String(c.key), String(c.value)); c.continue(); } else res();
    };
    rq.onerror = () => res();
  });
  packCount = -1;
}
async function saveVoices(v: Record<string, string>) {
  Object.entries(v).forEach(([k, b]) => extra.set(k, b));
  packCount = -1;
  const db = await idb();
  if (!db) return;
  const tx = db.transaction('lines', 'readwrite');
  Object.entries(v).forEach(([k, b]) => tx.objectStore('lines').put(b, k));
}

/** 서버에 녹음 부탁하기. remote = (lines) => Promise<{voices, pending}> */
type Remote = (lines: string[]) => Promise<{ voices: Record<string, string>; pending: string[] }>;
let remote: Remote | null = null;
export function setRemoteVoice(r: Remote | null) { remote = r; if (r) pump(); }

// 빠진 녹음을 뒤에서 차례로 받아 두기 (지금 못 들은 문장은 기기 음성으로 먼저 말하고, 다음부터 녹음으로)
const queue: string[] = [];
let pumping = false;
export const voiceJob = { left: 0, made: 0, error: '' as string, running: false };
const jobSubs = new Set<() => void>();
export function onVoiceJob(f: () => void) { jobSubs.add(f); return () => { jobSubs.delete(f); }; }
function jobNote() { voiceJob.left = queue.length; voiceJob.running = pumping; jobSubs.forEach(f => f()); }

/** 필요한 문장들 알려 주기. front=true면 먼저 받기 */
export function wantVoices(lines: string[], front = false) {
  const add = [...new Set(lines.map(l => l.trim()))].filter(l => l && !hasClip(l));
  if (front) { for (const l of add.reverse()) { const i = queue.indexOf(l); if (i >= 0) queue.splice(i, 1); queue.unshift(l); } }
  else for (const l of add) if (!queue.includes(l)) queue.push(l);
  jobNote();
  pump();
}

async function pump() {
  if (pumping || !remote || !queue.length) return;
  pumping = true; voiceJob.error = ''; jobNote();
  let empty = 0;
  try {
    while (queue.length && remote) {
      if (!navigator.onLine) break;
      if (document.visibilityState !== 'visible') { await wait(4000); continue; }
      const batch = queue.slice(0, 8);
      let r;
      try { r = await remote(batch); }
      catch (e: any) {
        const m = String(e?.message || e);
        voiceJob.error = m; jobNote();
        if (/azure_key|bad_code|no_url/.test(m)) break;   // 설정 문제: 멈춤
        await wait(15000); continue;
      }
      const got = Object.keys(r.voices || {}).length;
      if (got) { await saveVoices(r.voices); voiceJob.made += got; }
      // 받은 것과 이미 있는 것은 줄에서 빼기
      for (let i = queue.length - 1; i >= 0; i--) if (hasClip(queue[i])) queue.splice(i, 1);
      jobNote();
      if (!got) { if (++empty >= 3) { voiceJob.error = 'no_tts'; break; } await wait(8000); }
      else { empty = 0; await wait(600); }
    }
  } finally { pumping = false; jobNote(); }
}

/** 녹음 개수 (부모 화면용) */
export function voiceCount() {
  return (window.__VOICE__ ? Object.keys(window.__VOICE__).length : 0) + extra.size;
}

// 폰에서 소리가 멈춰 있으면 화면을 누를 때 다시 켜기, 앱을 벗어나면 소리 멈추기
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => { }); }, true);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') { stopVoice(); ctx.suspend().catch(() => { }); }
    else ctx.resume().catch(() => { });
  });
}

let seq = 0;
/** 이어 말하기 번호: 새 말(say/sayAll)이나 멈춤이 오면 앞의 이어 말하기는 그 자리에서 끝난다 */
let talk = 0;
function halt() {
  seq++;
  const source = current;
  current = null;
  try { source?.stop(); } catch { /* 이미 멈춤 */ }
  finishCurrent?.();
  try { speechSynthesis.cancel(); } catch { /* 없음 */ }
  speaking = 0; listeners.forEach(f => f(false));
}
/** 하던 말 멈추기 (아이가 누르면 바로 반응하도록) */
export function stopVoice() { talk++; halt(); }

/** 말하기. 끝나면 resolve. 다른 말이 끼어들면 조용히 resolve */
export async function say(text: string, opt: { rate?: number; pitch?: number; interrupt?: boolean } = {}): Promise<void> {
  if (opt.interrupt !== false) talk++;
  return speak(text, opt);
}

async function speak(text: string, opt: { rate?: number; pitch?: number; interrupt?: boolean } = {}): Promise<void> {
  if (!text) return;
  if (!/[\p{L}\p{N}]/u.test(text)) return;     // 그림 카드(🍓 등)처럼 글자가 없는 것은 읽지 않는다
  if (opt.interrupt !== false) halt();
  (window as any).__SAID__?.push(text);
  if ((window as any).__FAST__) { await wait(40); return; }
  const my = ++seq;
  const rate = (opt.rate ?? 1) * (load().settings.voiceRate || 1);
  const recording = await clip(text).catch(() => null);
  const buf = recording?.buffer;
  if (!buf && remote) wantVoices([text], true);
  if (my !== seq) return;
  if (buf) {
    return new Promise(res => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ac = audioCtx();
      const src = ac.createBufferSource();
      src.buffer = buf;
      const levelGain = ac.createGain(); levelGain.gain.value = recording!.gain;
      src.connect(levelGain); levelGain.connect(voiceGain);
      const fin = () => {
        if (done) return;
        done = true; clearTimeout(timer);
        if (finishCurrent === fin) finishCurrent = null;
        if (current === src) current = null;
        src.onended = null;
        try { src.disconnect(); levelGain.disconnect(); } catch { /* 이미 정리됨 */ }
        setSpeaking(-1); res();
      };
      current = src;
      finishCurrent = fin;
      setSpeaking(1);
      src.onended = fin;
      try { src.start(); } catch { fin(); return; }
      // 앱을 다시 열었을 때 소리 장치가 멈춰 있으면 '끝남' 신호가 안 와서 다음으로 못 넘어감 → 길이만큼 기다린 뒤 넘어가기
      if (!done) timer = setTimeout(fin, buf.duration * 1000 + (ac.state === 'running' ? 1200 : 400));
    });
  }
  return new Promise(res => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fin = () => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (finishCurrent === fin) finishCurrent = null;
      setSpeaking(-1); res();
    };
    finishCurrent = fin;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      const v = koVoice(); if (v) u.voice = v;
      u.rate = 0.9 * rate;
      u.pitch = opt.pitch ?? 1.0;
      u.onend = fin; u.onerror = fin;
      setSpeaking(1);
      speechSynthesis.speak(u);
      // 일부 안드로이드에서 onend가 안 오는 문제 대비
      if (!done) timer = setTimeout(fin, 900 + text.length * 260 / rate);
    } catch { fin(); }
  });
}

/** 장면이 바뀌면 이어 말하기를 멈추기 위한 번호 */
let scene = 0;
export function newScene() { scene++; stopVoice(); }
export function sceneId() { return scene; }

/** 여러 문장을 차례로. 장면이 바뀌면 중단 */
export async function sayAll(lines: string[], gap = 160) {
  const sc = scene;
  const my = ++talk;
  // 녹음 음성이 없으면 조각내지 않고 한 문장으로 읽는다 (기기 음성은 조각마다 끊겨서 어색함)
  if (!hasPack() && lines.length > 1) {
    const joined = lines.filter(Boolean).map((l, i, a) => i < a.length - 1 && !/[.!?,]$/.test(l) ? l + ',' : l).join(' ');
    await speak(joined);
    return;
  }
  for (let i = 0; i < lines.length; i++) {
    if (sc !== scene || my !== talk) return;
    await speak(lines[i]);
    if (sc !== scene || my !== talk) return;
    if (i < lines.length - 1) await wait(gap);
  }
}

export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------------- 효과음 ----------------
type Tone = { f: number; t: number; d: number; type?: OscillatorType; v?: number; slide?: number };
function tones(list: Tone[]) {
  const c = audioCtx();
  const now = c.currentTime;
  for (const n of list) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type ?? 'sine';
    o.frequency.setValueAtTime(n.f, now + n.t);
    if (n.slide) o.frequency.exponentialRampToValueAtTime(n.slide, now + n.t + n.d);
    const v = n.v ?? 0.5;
    g.gain.setValueAtTime(0.0001, now + n.t);
    g.gain.exponentialRampToValueAtTime(v, now + n.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    o.connect(g); g.connect(sfxGain);
    o.start(now + n.t); o.stop(now + n.t + n.d + 0.05);
  }
}

function noise(d: number, f = 1800, v = 0.3) {
  const c = audioCtx();
  const buf = c.createBuffer(1, c.sampleRate * d, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.2;
  const g = c.createGain(); g.gain.value = v;
  src.connect(bp); bp.connect(g); g.connect(sfxGain); src.start();
}

export const sfx = {
  tap: () => tones([{ f: 660, t: 0, d: 0.08, type: 'triangle', v: 0.3 }]),
  pop: () => { tones([{ f: 380, t: 0, d: 0.12, slide: 900, v: 0.5 }]); noise(0.08, 2500, 0.2); },
  ding: () => tones([{ f: 1047, t: 0, d: 0.35, type: 'triangle', v: 0.35 }, { f: 1319, t: 0.09, d: 0.4, type: 'triangle', v: 0.35 }, { f: 1568, t: 0.18, d: 0.5, type: 'sine', v: 0.3 }]),
  boing: () => { tones([{ f: 300, t: 0, d: 0.25, slide: 160, type: 'sine', v: 0.4 }, { f: 220, t: 0.12, d: 0.25, slide: 260, type: 'sine', v: 0.3 }]); buddy({ t: 'oops' }); },
  /** 작은 강아지 '멍멍' */
  bark: (n = 2) => { for (let i = 0; i < n; i++) woof(i * 0.2); },
  /** 고양이 '야옹' */
  meow: () => mew(0),
  whoosh: () => noise(0.35, 900, 0.35),
  splash: () => { noise(0.5, 600, 0.5); tones([{ f: 500, t: 0, d: 0.2, slide: 200, v: 0.2 }]); },
  hop: () => tones([{ f: 420, t: 0, d: 0.18, slide: 840, type: 'sine', v: 0.4 }]),
  sparkle: () => tones([0, 1, 2, 3, 4].map(i => ({ f: 1568 + i * 220, t: i * 0.05, d: 0.18, type: 'sine' as OscillatorType, v: 0.18 }))),
  stroke: () => tones([{ f: 784, t: 0, d: 0.15, type: 'triangle', v: 0.3 }, { f: 1175, t: 0.07, d: 0.2, type: 'triangle', v: 0.3 }]),
  fanfare: () => tones([
    { f: 523, t: 0, d: 0.18, type: 'square', v: 0.12 }, { f: 659, t: 0.15, d: 0.18, type: 'square', v: 0.12 },
    { f: 784, t: 0.3, d: 0.18, type: 'square', v: 0.12 }, { f: 1047, t: 0.45, d: 0.6, type: 'square', v: 0.14 },
    { f: 1047, t: 0.45, d: 0.7, type: 'triangle', v: 0.3 }, { f: 1319, t: 0.45, d: 0.7, type: 'triangle', v: 0.2 },
  ]),
  drum: () => { for (let i = 0; i < 10; i++) setTimeout(() => noise(0.06, 300, 0.4), i * 70); },
  scribble: () => noise(0.05, 4000, 0.05),
};

// ---------------- 동물 소리 (합성) ----------------
function woof(t0: number) {
  const c = audioCtx();
  const t = c.currentTime + t0;
  const o = c.createOscillator(); const g = c.createGain(); const lp = c.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.1);
  lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 3;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(lp); lp.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.16);
  // 숨소리
  const len = Math.floor(c.sampleRate * 0.07);
  const buf = c.createBuffer(1, len, c.sampleRate); const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const nz = c.createBufferSource(); nz.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.5;
  const ng = c.createGain(); ng.gain.value = 0.12;
  nz.connect(bp); bp.connect(ng); ng.connect(sfxGain); nz.start(t);
}
function mew(t0: number) {
  const c = audioCtx();
  const t = c.currentTime + t0;
  const o = c.createOscillator(); const g = c.createGain(); const bp = c.createBiquadFilter();
  const vib = c.createOscillator(); const vg = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(900, t + 0.14); o.frequency.linearRampToValueAtTime(560, t + 0.46);
  vib.frequency.value = 7; vg.gain.value = 12; vib.connect(vg); vg.connect(o.frequency);
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(1100, t); bp.frequency.linearRampToValueAtTime(1500, t + 0.14); bp.frequency.linearRampToValueAtTime(900, t + 0.46); bp.Q.value = 4;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.05); g.gain.setValueAtTime(0.3, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(bp); bp.connect(g); g.connect(sfxGain);
  o.start(t); vib.start(t); o.stop(t + 0.52); vib.stop(t + 0.52);
}

// ---------------- 배경음 (오르골) ----------------
let musicTimer = 0;
let musicOn = false;
const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319];
const SONG = [0, 2, 4, 2, 5, 4, 2, -1, 1, 3, 5, 3, 6, 5, 3, -1, 0, 2, 4, 7, 5, 4, 2, 4, 3, 1, 2, 0, -1, -1, -1, -1];
const BASS = [0, 0, 3, 3, 4, 4, 0, 0];

export function music(on: boolean) {
  const c = audioCtx();
  musicOn = on;
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.linearRampToValueAtTime(on ? 0.16 : 0, c.currentTime + 0.8);
  if (on && !musicTimer) {
    let i = 0;
    const beat = 0.34;
    let next = c.currentTime + 0.1;
    musicTimer = window.setInterval(() => {
      while (next < c.currentTime + 0.5) {
        const n = SONG[i % SONG.length];
        if (n >= 0) note(SCALE[n], next, beat * 1.8, 0.5);
        if (i % 4 === 0) note(SCALE[BASS[(i / 4) % BASS.length]] / 4, next, beat * 3.5, 0.35, 'triangle');
        next += beat; i++;
      }
    }, 150);
  }
  if (!on && musicTimer) { setTimeout(() => { if (!musicOn) { clearInterval(musicTimer); musicTimer = 0; } }, 900); }
}

function note(f: number, t: number, d: number, v: number, type: OscillatorType = 'sine') {
  const c = audioCtx();
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + d + 0.05);
}

/** 말할 때 배경음 살짝 줄이기 */
onSpeaking(on => {
  if (!ctx || !musicOn) return;
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(on ? 0.05 : 0.16, ctx.currentTime + 0.25);
});
