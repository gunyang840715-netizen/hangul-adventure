// 이 문서에서만 쓰는 가상 저장소. 앱/사용자 localStorage·서버를 건드리지 않는다.
import { render } from 'preact';
import '../../src/styles.css';
const memory: Record<string, string> = { 'hangul-adventure-v2': '{"v":3,', 'hangul-device': 'qa-parent' };
Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory[key] ?? null,
  setItem: (key: string, value: string) => { memory[key] = String(value); },
  removeItem: (key: string) => { delete memory[key]; },
} });
(window as any).__FAST__ = true;
import('../../src/screens/Extras').then(({ Parent }) => {
  render(<Parent onClose={() => {}} onDemo={() => {}} demo={false} />, document.getElementById('parent-root')!);
});
