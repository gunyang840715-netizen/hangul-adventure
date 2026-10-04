// 두 기기 진도 연동 + 새 음성 받기 (구글 Apps Script 서버)
import { BACKEND_URL } from '../config';
import { load, absorb, setName, dev } from './store';

const LS_CODE = 'hangul-sync-code';
const LS_URL = 'hangul-sync-url';

function ls(k: string) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
function lsSet(k: string, v: string) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* 없음 */ } }

/** 설정 링크(#setup=코드&api=주소)로 들어오면 저장하고 주소창에서 지움 */
export function readSetupLink() {
  const h = location.hash;
  if (!h.includes('setup=')) return false;
  const p = new URLSearchParams(h.slice(1));
  const code = p.get('setup');
  const api = p.get('api');
  const name = p.get('name');
  if (code) lsSet(LS_CODE, code.trim());
  if (api) lsSet(LS_URL, api.trim());
  // 이름은 아직 한 번도 정하지 않았을 때만 (다른 기기에서 바꾼 이름을 덮지 않도록)
  if (name && name.trim() && !load().nameT) setName(name.trim().slice(0, 10));
  history.replaceState(null, '', location.pathname + location.search);
  return !!code;
}

export function syncUrl() { return ls(LS_URL) || BACKEND_URL; }
export function syncCode() { return ls(LS_CODE); }
export function setSync(code: string, url?: string) { lsSet(LS_CODE, code.trim()); if (url !== undefined) lsSet(LS_URL, url.trim()); }
export function syncEnabled() { return !!syncUrl() && !!syncCode(); }

export interface SyncStatus { ok: boolean; at: number; error?: string; busy: boolean }
export const status: SyncStatus = { ok: false, at: 0, busy: false };
const subs = new Set<() => void>();
export function onStatus(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
function note(p: Partial<SyncStatus>) { Object.assign(status, p); subs.forEach(f => f()); }

/** 서버 호출 (text/plain으로 보내야 구글 서버가 교차 출처 요청을 받아 줌) */
export async function call(body: any, timeoutMs = 25000): Promise<any> {
  const url = syncUrl();
  if (!url) throw new Error('no_url');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify({ code: syncCode(), ...body }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctl.signal, redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'server');
    return j;
  } finally { clearTimeout(t); }
}

let inflight: Promise<boolean> | null = null;
export function syncNow(): Promise<boolean> {
  if (!syncEnabled() || !navigator.onLine) return Promise.resolve(false);
  if (inflight) return inflight;
  note({ busy: true });
  inflight = (async () => {
    try {
      const j = await call({ a: 'sync3', dev: dev(), state: load() });
      // 옛 서버 코드면 받은 진도를 쓰지 않는다
      if (!j.ver || j.ver < 3 || !Array.isArray(j.states)) throw new Error('old_server');
      absorb(...j.states);
      note({ ok: true, at: Date.now(), error: undefined, busy: false });
      return true;
    } catch (e: any) {
      note({ ok: false, error: String(e?.message || e), busy: false });
      return false;
    } finally { inflight = null; }
  })();
  return inflight;
}

let timer = 0;
/** 조금 뒤에 한 번 (여러 번 불러도 한 번만) */
export function syncSoon(ms = 2500) {
  clearTimeout(timer);
  timer = window.setTimeout(() => { syncNow(); }, ms);
}

export function startSync() {
  readSetupLink();
  syncNow();
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); else syncSoon(10); });
  window.addEventListener('online', () => syncNow());
}
