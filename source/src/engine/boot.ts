// 앱 시작 준비: 음성팩 → 이 기기에 저장된 음성 → 두 기기 연동 → 빠진 음성 받기
import { load, onChange } from './store';
import { loadVoicePack, loadSavedVoices, markPackDone, setRemoteVoice, wantVoices } from './audio';
import { startSync, syncNow, syncEnabled, call } from './sync';
import { allLines, nameLines, FIXED } from '../data/voice';

/** 서버 상태 (부모 화면에서 보여 줌) */
export const server = { checked: false, reachable: false, tts: false, error: '' };
const subs = new Set<() => void>();
export function onServer(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
function note(p: Partial<typeof server>) { Object.assign(server, p); subs.forEach(f => f()); }

/** 음성팩 목록(voice-manifest.json)을 읽고 조각들을 받기. 목록을 못 받으면 저장해 둔 것으로 */
async function loadManifest(url: string) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    const m = await r.json();
    const files: { u: string; b: number }[] = m.files || [];
    return loadVoicePack(files.map(f => f.u), files.reduce((a, f) => a + (f.b || 0), 0));
  } catch {
    markPackDone();
  }
}

export async function boot() {
  const w = window as any;
  const embedded = !!w.__VOICE__ && Object.keys(w.__VOICE__).length > 0;
  const pack = embedded ? Promise.resolve(markPackDone())
    : w.__VOICE_MANIFEST__ ? loadManifest(w.__VOICE_MANIFEST__)
    : w.__VOICE_URL__ ? loadVoicePack(w.__VOICE_URL__, w.__VOICE_BYTES__ || 0) : Promise.resolve(markPackDone());
  try { await (navigator as any).storage?.persist?.(); } catch { /* 무시 */ }
  await loadSavedVoices();
  startSync();
  await Promise.all([pack, syncNow()]);
  let lastName = load().name;
  onChange(() => {
    const n = load().name;
    if (n !== lastName) { lastName = n; wantVoices(nameLines(n), true); }
  });
  await connectVoice();
}

/** 서버 확인 → 새 음성을 만들 수 있으면 빠진 문장 받기 시작 */
export async function connectVoice() {
  if (!syncEnabled()) { setRemoteVoice(null); note({ checked: true, reachable: false, tts: false, error: '' }); return; }
  try {
    const j = await call({ a: 'ping' }, 20000);
    if (!j.ver || j.ver < 3) throw new Error('old_server');
    note({ checked: true, reachable: true, tts: !!j.tts, error: '' });
  } catch (e: any) {
    note({ checked: true, reachable: false, tts: false, error: String(e?.message || e) });
  }
  if (!server.reachable) { setRemoteVoice(null); return; }
  // 서버에 모아 둔 녹음(아이 이름 인사 등)은 과금 없이 받을 수 있음. 새로 만들기는 서버에서 켰을 때만
  setRemoteVoice(lines => call({ a: 'tts', lines }, 60000));
  const n = load().name;
  if (server.tts) wantVoices([...nameLines(n), ...FIXED, ...allLines(n)]);
  else wantVoices(nameLines(n), true);
}
