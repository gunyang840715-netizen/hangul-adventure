// 작은 녹음·무음·음성팩 조각·중단 시 다음 안내 대기를 검사한다.
import assert from 'node:assert/strict';
const g: any = globalThis;
const mem: Record<string, string> = {};
g.window = g;
g.localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v); } };
class BufferMock {
  duration: number;
  channels: Float32Array[];
  constructor(public numberOfChannels: number, public length: number, public sampleRate = 1000) {
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(c: number) { return this.channels[c]; }
  copyToChannel(v: Float32Array, c: number) { this.channels[c].set(v); }
}
const make = (amplitude: number, stereo = false) => {
  const b = new BufferMock(stereo ? 2 : 1, 1000);
  b.channels[stereo ? 1 : 0].fill(amplitude, 200, 600);
  return b;
};
const buffers = new Map<string, BufferMock>([['quiet', make(.01)], ['stereo', make(.01, true)], ['silent', make(.00001)], ['base', make(.1)]]);
const decoded: string[] = [];
const sources: any[] = [];
const compressors: any[] = [];
let autoEnd = true;
class NodeMock {
  gain = { value: 0 };
  next: any;
  disconnected = false;
  connect(n: any) { this.next = n; }
  disconnect() { this.disconnected = true; }
}
class AC {
  state = 'running'; currentTime = 0; destination = {};
  createGain() { return new NodeMock(); }
  createDynamicsCompressor() {
    const n = Object.assign(new NodeMock(), { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} });
    compressors.push(n); return n;
  }
  createBuffer(c: number, len: number, sr: number) { return new BufferMock(c, len, sr); }
  createBufferSource() {
    const s: any = new NodeMock();
    s.stop = () => {}; // 모바일에서 onended가 오지 않아도 중단 Promise는 끝나야 함
    s.start = () => { if (autoEnd) queueMicrotask(() => s.onended?.()); };
    sources.push(s); return s;
  }
  async decodeAudioData(ab: ArrayBuffer) {
    const k = new TextDecoder().decode(ab); decoded.push(k);
    if (!buffers.has(k)) throw new Error('깨진 녹음');
    return buffers.get(k)!;
  }
  resume() { return Promise.resolve(); }
}
g.AudioContext = AC;
const audio = await import('../src/engine/audio');
const { setLead } = await import('../src/engine/store');
assert.equal(audio.recordedLevel(make(0)).silent, true);
assert.equal(audio.recordedLevel(make(.00001)).silent, true);
assert.equal(audio.recordedLevel(make(.004)).gain, 30);
assert.equal(audio.recordedLevel(make(1)).gain, .5);
assert.ok(Math.abs(audio.recordedLevel(make(.01)).gain - Math.pow(10, -17 / 20) / .01) < .001);
const noPadding = new BufferMock(1, 400); noPadding.channels[0].fill(.01);
assert.equal(audio.recordedLevel(make(.01)).gain, audio.recordedLevel(noPadding).gain);

const b64 = (s: string) => Buffer.from(s).toString('base64');
const packs: Record<string, any> = {
  one: { voices: { d0: b64('quiet'), c0: b64('stereo') }, pool: { '검사 안내': { d: ['d0'], c: ['c0'], f: 'd' } } },
  two: { voices: { d1: b64('base') }, pool: { '검사 안내': { d: ['d0', 'd1'], c: ['c0'], f: 'c' } } },
};
g.fetch = async (url: string) => new Response(JSON.stringify(packs[url]));
await audio.loadVoicePack(['one', 'two']);
assert.deepEqual(g.__VOICE_POOL__['검사 안내'], { d: ['d0', 'd1'], c: ['c0'], f: 'd' });
setLead('dog');
g.__VOICE__['조용한 검사'] = b64('quiet');
await audio.say('조용한 검사');
const quiet = sources.at(-1);
assert.ok(Math.abs(quiet.next.gain.value - audio.recordedLevel(make(.01)).gain) < .001);
assert.equal(quiet.buffer.length, 545);
assert.ok(quiet.disconnected && quiet.next.disconnected);
assert.equal(compressors[0].threshold.value, -3);
assert.equal(compressors[0].ratio.value, 20);
assert.equal(quiet.next.next.next, compressors[0]);
g.__VOICE__['스테레오 검사'] = b64('stereo');
await audio.say('스테레오 검사');
assert.equal(sources.at(-1).buffer.length, 545);
assert.equal(sources.at(-1).buffer.numberOfChannels, 2);
assert.ok(sources.at(-1).buffer.getChannelData(1).some((x: number) => x > 0));

Object.assign(g.__VOICE__, { dead: b64('silent'), broken: b64('broken'), good: b64('quiet'), '재선택 검사': b64('base'), '기존 녹음 검사': b64('base') });
g.__VOICE_POOL__['재선택 검사'] = { d: ['dead', 'broken', 'good'] };
const originalRandom = Math.random; Math.random = () => 0;
const before = decoded.length;
await audio.say('재선택 검사');
assert.deepEqual(decoded.slice(before), ['silent', 'broken', 'quiet']);
assert.ok(sources.at(-1).next.gain.value > 10);
g.__VOICE_POOL__['기존 녹음 검사'] = { d: ['dead', 'broken'] };
await audio.say('기존 녹음 검사');
assert.ok(Math.abs(sources.at(-1).next.gain.value - audio.recordedLevel(make(.1)).gain) < .001);
g.__VOICE_POOL__['대표 친구 검사'] = { d: ['good'] };
setLead('cat'); assert.equal(audio.hasClip('대표 친구 검사'), false);
setLead('dog'); assert.equal(audio.hasClip('대표 친구 검사'), true);
Math.random = originalRandom;

autoEnd = false;
let settled = false;
const pending = audio.say('조용한 검사').then(() => { settled = true; });
await new Promise(r => setTimeout(r, 0));
audio.stopVoice(); await pending;
assert.ok(settled);
assert.ok(sources.at(-1).disconnected);
// 아주 작은 녹음: 말소리 대부분이 −45dBFS 아래여도 크기를 제대로 잰다 (가장 큰 구간 기준 30dB 안쪽 평균)
const faint = new BufferMock(1, 1000); faint.channels[0].fill(.002, 200, 600); faint.channels[0].fill(.005, 600, 620);
assert.equal(audio.recordedLevel(faint).silent, true, '말소리 평균 −53dBFS는 쓰지 않음');
const faintOk = new BufferMock(1, 1000); faintOk.channels[0].fill(.004, 200, 600); faintOk.channels[0].fill(.006, 600, 620);
assert.equal(audio.recordedLevel(faintOk).silent, false);
assert.equal(audio.recordedLevel(faintOk).gain, 30);
// 가장 큰 순간이 −1dBFS를 넘지 않게 배율 상한
const spiky = make(.01); spiky.channels[0][300] = .5;
assert.ok(Math.abs(audio.recordedLevel(spiky).gain - Math.pow(10, -1 / 20) / .5) < .001, '피크 상한');
// 녹음 키 미리 확인 + 쓸 수 없는 녹음 키는 기기 음성으로 읽지 않음
const spoken: string[] = [];
g.SpeechSynthesisUtterance = class { lang = ''; voice: any; rate = 1; pitch = 1; onend: any; onerror: any; constructor(public text: string) {} };
g.speechSynthesis = { speak(u: any) { spoken.push(u.text); setTimeout(() => u.onend?.(), 0); }, cancel() {}, getVoices: () => [] };
Object.assign(g.__VOICE__, { 'dog::faint-ex': b64('silent'), 'dog::ok-ex': b64('quiet') });
assert.equal(await audio.clipUsable('dog::faint-ex'), false);
assert.equal(await audio.clipUsable('dog::ok-ex'), true);
assert.equal(await audio.clipUsable('dog::없는-키'), false);
autoEnd = true;
await audio.say('dog::faint-ex');
assert.deepEqual(spoken, [], '녹음 키를 글자로 읽으면 안 됨');
await audio.say('녹음 없는 새 문장');
assert.deepEqual(spoken, ['녹음 없는 새 문장'], '녹음 없는 보통 문장은 지금처럼 기기 음성');
console.log('녹음 음량·조각 병합·무음 재선택·중단 검사 통과');
