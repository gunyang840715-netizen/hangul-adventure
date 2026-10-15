// 불러오기 전에만 검증한다. 저장 형식·기기 연동·옛 백업의 기본값 보완은 바꾸지 않는다.
type Obj = Record<string, any>;
const obj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const index = (v: unknown) => num(v) && Number.isInteger(v);
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
const values = (v: unknown, test: (x: any) => boolean) => obj(v) && Object.values(v).every(test);
const numbers = (v: unknown) => values(v, num);
const days = (v: unknown) => values(v, numbers);

export function isBackupPayload(o: unknown): boolean {
  if (!obj(o) || ![1, 2, 3].includes(o.v)) return false;
  // 실제 백업의 기본 식별 필드. 버전 번호만 있는 JSON을 초기 상태로 보완해 덮어쓰지 않기.
  if (typeof o.name !== 'string' || !index(o.lessonIdx) || !obj(o.items)) return false;
  if (!values(o.items, s => obj(s) && ['box', 'due', 'seen', 'right', 'wrong'].every(k => s[k] === undefined || num(s[k])) &&
    (s.last === undefined || s.last === -1 || num(s.last)))) return false;
  if (o.owned !== undefined && !strings(o.owned)) return false;
  if (o.settings !== undefined && (!obj(o.settings) ||
    !['dailyMin', 'newPerDay', 'voiceRate', 'traceReps', 'testPass'].every(k => o.settings[k] === undefined || num(o.settings[k])) ||
    (o.settings.music !== undefined && typeof o.settings.music !== 'boolean'))) return false;
  if (o.v === 1) {
    if (!['stars', 'adventures'].every(k => o[k] === undefined || num(o[k]))) return false;
    if (o.history !== undefined && (!Array.isArray(o.history) || !o.history.every((h: any) => obj(h) && index(h.day) && ['ms', 'lessons'].every(k => h[k] === undefined || num(h[k]))))) return false;
    if (o.daily !== undefined && (!obj(o.daily) || !index(o.daily.day) || !['ms', 'lessons'].every(k => o.daily[k] === undefined || num(o.daily[k])))) return false;
  } else {
    if (!['stars', 'adventures', 'games', 'mats', 'lostMats', 'wearT', 'itemGot', 'itemLost', 'bought', 'decoT'].every(k => o[k] === undefined || numbers(o[k]))) return false;
    if (!['usage', 'lessonsByDay', 'extraMin', 'extraLessons', 'growth', 'snacks', 'eaten', 'built', 'lostSnacks'].every(k => o[k] === undefined || days(o[k]))) return false;
    if (o.wear !== undefined && !values(o.wear, w => values(w, x => typeof x === 'string'))) return false;
    if (o.deco !== undefined && !values(o.deco, w => values(w, x => typeof x === 'string'))) return false;
  }
  if (o.outfit != null && (!obj(o.outfit) || !Object.values(o.outfit).every(x => typeof x === 'string'))) return false;
  if (o.resume != null && (!obj(o.resume) || !index(o.resume.lessonIdx) || !index(o.resume.stepIdx) || !num(o.resume.at) ||
    typeof o.resume.replay !== 'boolean' || (o.resume.play !== undefined && typeof o.resume.play !== 'boolean') ||
    !Array.isArray(o.resume.steps) || !o.resume.steps.every((s: any) => obj(s) && typeof s.t === 'string'))) return false;
  if (o.lastPass != null && (!obj(o.lastPass) || !index(o.lastPass.lesson) || !index(o.lastPass.day) || !strings(o.lastPass.items))) return false;
  if (o.hold != null && (!obj(o.hold) || !index(o.hold.lesson))) return false;
  if (o.reviewDay !== undefined && o.reviewDay !== -1 && !index(o.reviewDay)) return false;
  if (!['epoch', 'nameT', 'settingsT', 'petsT', 'lastItemT', 'resumeT', 'lastPassT', 'reviewDayT', 'holdT'].every(k => o[k] === undefined || num(o[k]))) return false;
  return true;
}
