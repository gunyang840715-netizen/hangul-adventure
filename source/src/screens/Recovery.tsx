import { Component, type ComponentChildren } from 'preact';
import { flushSave } from '../engine/store';
import { stopVoice } from '../engine/audio';

/** 화면 오류가 나도 저장소를 지우지 않고 다시 열 수 있는 출구를 남김. */
export class AppBoundary extends Component<{ children: ComponentChildren }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { flushSave(); stopVoice(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div class="app-recovery" role="alert">
      <div style={{ fontSize: 72 }}>🌈</div>
      <h1>잠깐 쉬었다 다시 만나자!</h1>
      <p>저장된 모험을 다시 불러올게요.</p>
      <button class="btn" onClick={() => { flushSave(); location.reload(); }}>다시 열기 ▶</button>
    </div>;
  }
}
