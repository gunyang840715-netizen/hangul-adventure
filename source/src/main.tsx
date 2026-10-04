import { render } from 'preact';
import './font.css';
import './styles.css';
import { App } from './App';
import { boot } from './engine/boot';

if (/[?&]fast=1/.test(location.search)) { (window as any).__FAST__ = true; (window as any).__SAID__ = []; }

/**
 * 화면을 꽉 채우는 무대 만들기.
 * 놀이 내용은 가운데 1280x800 '안전 영역'에 두고, 배경은 화면 끝까지 늘린다.
 * (갤럭시 S 시리즈처럼 가로로 긴 폰: 무대 폭이 넓어짐 / 4:3 태블릿: 무대 높이가 커짐)
 */
function fit() {
  const st = document.getElementById('stage');
  if (!st) return;
  // 부모 화면에서 글자 입력 중(자판이 올라옴)에는 크기를 바꾸지 않기
  const ae = document.activeElement as HTMLElement | null;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && (window as any).__STAGE__) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  let W = 1280, H = 800;
  if (vw / vh >= 1.6) W = Math.min(2200, Math.round(800 * vw / vh));
  else H = Math.min(1150, Math.round(1280 * vh / vw));
  const scale = Math.min(vw / W, vh / H);
  const side = (W - 1280) / 2, top = (H - 800) / 2;
  st.style.width = W + 'px';
  st.style.height = H + 'px';
  st.style.left = Math.round((vw - W * scale) / 2) + 'px';
  st.style.top = Math.round((vh - H * scale) / 2) + 'px';
  st.style.transform = `scale(${scale})`;
  st.style.setProperty('--side', side + 'px');
  st.style.setProperty('--top', top + 'px');
  (window as any).__STAGE__ = { w: W, h: H, scale, side, top };
}
(window as any).__FIT__ = fit;
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 300));
document.addEventListener('fullscreenchange', () => setTimeout(fit, 100));
document.addEventListener('focusout', () => setTimeout(fit, 300));

boot();
render(<App />, document.getElementById('root')!);
fit();

// 앱 설치(홈 화면) 방식일 때: 인터넷이 없어도 열리도록
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/[?&](fast|gallery|icon)=/.test(location.search)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* 무시 */ }); });
}
// ---------- 태블릿·폰 홈 화면 아이콘으로 다시 열 때 멈춘 화면 막기 ----------
// 1) 앱 설치 버튼: 크롬이 '설치할 수 있음'을 알려 주면 저장해 두었다가 첫 화면 버튼으로 설치
(window as any).__INSTALL__ = null;
window.addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); (window as any).__INSTALL__ = e; window.dispatchEvent(new Event('installready')); });
window.addEventListener('appinstalled', () => { (window as any).__INSTALL__ = null; window.dispatchEvent(new Event('installready')); });
// 2) 오래(20분 넘게) 다른 앱에 있다가 돌아오면 처음부터 새로 불러오기 (멈춘 화면·옛 버전 방지, 하던 곳은 저장돼 있어 그 자리부터)
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > 20 * 60000 && !/[?&](fast|gallery|icon)=/.test(location.search)) { location.reload(); return; }
  navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => { /* 무시 */ });
  setTimeout(fit, 200);
});
window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) setTimeout(fit, 100); });
// 3) 새 버전이 설치되면 표시 → 지도·첫 화면으로 갈 때 새로 불러옴 (App에서 확인)
if ('serviceWorker' in navigator) {
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) (window as any).__UPDATE__ = true; had = true; });
}

// 길게 눌러 메뉴 뜨는 것 막기
document.addEventListener('contextmenu', e => e.preventDefault());
