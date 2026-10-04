// 캐릭터 목소리 연결 동작 검사: 대표 친구(lead)에 따라 유라/명쾌한 녹음이 나오고, 묶음에 없는 말은 기존 음성팩으로 가는지
import fs from 'node:fs';
const VD = process.env.VOICE_DIR || '..';
const mem: Record<string, string> = {};
const g: any = globalThis;
g.window = globalThis;
g.localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: () => {} };
const man = JSON.parse(fs.readFileSync(VD + '/voice-manifest.json', 'utf8'));
const V: Record<string, string> = {}; const P: Record<string, any> = {};
for (const f of man.files) { const j = JSON.parse(fs.readFileSync(VD + '/' + f.u, 'utf8')); Object.assign(V, j.voices || {}); Object.assign(P, j.pool || {}); }
g.__VOICE__ = V; g.__VOICE_POOL__ = P;
const byBytes = new Map<string, string>();
for (const [k, b] of Object.entries(V)) byBytes.set(Buffer.from(b, 'base64').toString('latin1'), k);
let played: string[] = [];
const buf = () => ({ duration: 0.5, sampleRate: 24000, numberOfChannels: 1, length: 12000, getChannelData: () => new Float32Array(12000).fill(0.1), copyToChannel() {} });
class AC {
  state = 'running'; currentTime = 0; destination = {};
  createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
  createBufferSource() { const s: any = { connect() {}, stop() {}, start() { setTimeout(() => s.onended?.(), 0); } }; return s; }
  createBuffer() { return buf(); }
  async decodeAudioData(ab: ArrayBuffer) { played.push(byBytes.get(Buffer.from(ab).toString('latin1')) || '(알 수 없음)'); return buf(); }
  resume() { return Promise.resolve(); }
}
g.AudioContext = AC;
const { say } = await import('../src/engine/audio');
const { setLead } = await import('../src/engine/store');
let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) { bad++; console.log('실패:', m); } };

for (const lead of ['dog', 'cat'] as const) {
  setLead(lead);
  played = [];
  for (let i = 0; i < 40; i++) await say('맞았어!');
  const pre = lead === 'dog' ? 'dog::' : 'cat::';
  ok(played.every(k => k.startsWith(pre)), `${lead}: 칭찬이 ${pre} 녹음이어야 함 (${played.filter(k => !k.startsWith(pre)).length}개 어긋남)`);
  ok(new Set(played).size >= 5, `${lead}: 칭찬이 돌아가며 나와야 함`);
  ok(played.every((k, i) => i === 0 || k !== played[i - 1]), `${lead}: 같은 녹음이 연달아 나오면 안 됨`);
  played = [];
  await say('괜찮아~ 다시 찾아 보자!');
  ok(played.length === 1 && played[0].startsWith(pre), `${lead}: 다시 하기도 ${pre}`);
}
// 성장 말은 이름의 동물 목소리로 고정
const dogGrow = Object.entries<any>(P).find(([, e]) => e.f === 'd')![0];
const catGrow = Object.entries<any>(P).find(([, e]) => e.f === 'c')![0];
setLead('cat'); played = []; await say(dogGrow);
ok(played[0]?.startsWith('dog::'), `고양이가 대표여도 강아지 성장 말은 강아지 목소리 (${played[0]})`);
setLead('dog'); played = []; await say(catGrow);
ok(played[0]?.startsWith('cat::'), `강아지가 대표여도 고양이 성장 말은 고양이 목소리 (${played[0]})`);
// 묶음에 없는 말은 기존 음성팩
setLead('cat'); played = []; await say('하나!');
ok(played.length === 1 && played[0] === '하나!', `묶음에 없는 말은 기존 음성 (${played[0]})`);
// 고양이 녹음이 없는 말(두더지 안내)은 고양이가 대표여도 기존 음성으로
const timeup = '이 글자를 든 두더지를 콕 잡아 봐!';
setLead('cat'); played = []; await say(timeup);
ok(played.length === 1 && played[0] === timeup, `고양이 녹음이 없으면 기존 음성으로 (${played[0]})`);
console.log('캐릭터 목소리 연결 동작 | 문제:', bad);
if (bad) process.exit(1);
process.exit(0);
