/**
 * 뭉치와 냥이의 글자 모험 — 진도 연동 + 음성 만들기 서버 (구글 Apps Script)
 *
 * 하는 일
 *  1) 두 기기(갤럭시·샤오미 패드)의 진도를 기기별로 구글 드라이브에 보관 (합치는 건 앱이 함)
 *  2) 앱에 없는 새 문장을 Azure 음성으로 만들어 드라이브에 저장해 두고 돌려줌
 *
 * Azure 키는 코드에 쓰지 않고 [프로젝트 설정 → 스크립트 속성]에 넣습니다.
 *   속성 이름: AZURE_KEY   값: Azure 음성 서비스 키
 *   (지역이 koreacentral이 아니면 AZURE_REGION 속성도 추가)
 * 속성은 넣는 즉시 적용되고, 다시 배포할 필요가 없습니다.
 */
const CONFIG = {
  SYNC_CODE: '__SYNC_CODE__',          // 앱과 맞춘 연동 코드 (바꾸지 마세요)
  AZURE_REGION: 'koreacentral',        // 기본 지역 (스크립트 속성 AZURE_REGION이 있으면 그 값)
  VOICE: 'ko-KR-YuJin:DragonHDOmniLatestNeural',   // 음성팩과 같은 목소리 (스크립트 속성 VOICE가 있으면 그 값)
  RATE: '-8%',
  PITCH: '+4%',
};

const SERVER_VER = 3;         // 앱이 서버 코드 버전을 확인함 (옛 코드면 연동을 멈추고 알려 줌)
const MAX_NEW_PER_CALL = 6;   // 한 번 요청에 새로 만드는 문장 수 (무료 계층: 1분에 20번)
const GAP_MS = 3200;          // Azure 호출 간격
const CLIP_VER = 's2';        // 녹음 방식이 바뀌면 올림 (예전 녹음 대신 새로 만듦)

// ---------------- 입구 ----------------
function doGet() {
  return out_({ ok: true, app: 'hangul', ver: SERVER_VER, time: Date.now() });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  if (!req || req.code !== CONFIG.SYNC_CODE) return out_({ ok: false, error: 'bad_code' });
  try {
    if (req.a === 'ping') return out_({ ok: true, ver: SERVER_VER, voice: voice_(), tts: ttsOn_(), cache: true });
    if (req.a === 'gen') return out_(gen_(req.lines || [], req.par, req.fmt, req.voice, { rate: req.rate, pitch: req.pitch, raw: req.raw === true }));
    if (req.a === 'sync3') return out_(sync3_(req.dev, req.state));
    if (req.a === 'tts') return out_(tts_(req.lines || []));
    return out_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- 저장 위치 ----------------
function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* 새로 만듦 */ } }
  const f = DriveApp.createFolder('한글앱 데이터 (지우지 마세요)');
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function file_(name, initial) {
  const props = PropertiesService.getScriptProperties();
  const key = 'FILE_' + name;
  const id = props.getProperty(key);
  if (id) { try { return DriveApp.getFileById(id); } catch (e) { /* 새로 만듦 */ } }
  const f = folder_().createFile(name, initial, 'application/json');
  props.setProperty(key, f.getId());
  return f;
}

function readJson_(name) {
  try { return JSON.parse(file_(name, '{}').getBlob().getDataAsString('UTF-8')); } catch (e) { return {}; }
}

function writeJson_(name, obj) {
  file_(name, '{}').setContent(JSON.stringify(obj));
}

// ---------------- 진도 연동 ----------------
// 기기마다 마지막 상태를 따로 보관하고, 모든 기기 상태를 돌려준다. 합치기는 앱이 한다.
// (그래서 앱에 새 기능이 생겨도 이 서버 코드는 바꿀 필요가 없음)
function sync3_(dev, state) {
  if (!dev || !state) return { ok: false, error: 'bad_state' };
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const store = readJson_('progress3.json');
    const devices = store.devices || {};
    devices[String(dev).slice(0, 40)] = { at: Date.now(), state: state };
    // 180일 넘게 안 쓴 기기는 정리
    const old = Date.now() - 180 * 86400000;
    Object.keys(devices).forEach(function (d) { if ((devices[d].at || 0) < old) delete devices[d]; });
    writeJson_('progress3.json', { devices: devices });
    const states = Object.keys(devices).map(function (d) { return devices[d].state; });
    return { ok: true, ver: SERVER_VER, states: states, t: Date.now() };
  } finally {
    lock.releaseLock();
  }
}

// ---------------- 음성 ----------------
function prop_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  return v ? String(v).trim() : '';
}
function azureKey_() { return prop_('AZURE_KEY'); }
function azureRegion_() { return prop_('AZURE_REGION') || CONFIG.AZURE_REGION; }
function hasKey_() { return !!azureKey_(); }
/**
 * Azure 음성 만들기 켜짐 여부. 기본은 꺼짐(과금 0원) — 음성팩을 새로 만들 때만 스크립트 속성 TTS = on
 * 켜도 3시간 뒤 저절로 꺼짐(TTS_UNTIL). 꺼져 있어도 드라이브에 이미 만들어 둔 문장(아이 이름 인사 등)은 그대로 돌려줌
 */
function ttsOn_() { return hasKey_() && prop_('TTS') === 'on' && Date.now() < Number(prop_('TTS_UNTIL') || 0); }
function voice_() { return prop_('VOICE') || CONFIG.VOICE; }
/** HD 음성은 prosody·무음 조절 태그를 쓰지 못함 (앱이 앞뒤 무음을 잘라서 씀) */
function isHd_(v) { return /DragonHD/i.test(v); }

function keyOf_(text) {
  const v = voice_();
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, v + '|' + (isHd_(v) ? '' : CONFIG.RATE + '|' + CONFIG.PITCH) + '|' + CLIP_VER + '|' + text, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function esc_(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PCT_ = /^[+-]?\d{1,2}%$/;
/** 발음 교정용: 허용한 태그(발음기호·쉼)만 그대로 쓰고, 그 밖의 것은 글자로 읽음 */
function rawOk_(t) {
  t = String(t);
  const rest = t.replace(/<phoneme alphabet="(ipa|sapi)" ph="[^"<>&]{1,60}">[^<>&]{1,30}<\/phoneme>/g, '')
    .replace(/<break time="\d{1,4}ms"\/>/g, '');
  return /[<>&]/.test(rest) ? esc_(t) : t;
}
function ssml_(text, v, o) {
  v = v || voice_();
  o = o || {};
  const open = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR"><voice name="' + v + '">';
  const body = o.raw ? rawOk_(text) : esc_(text);
  if (isHd_(v)) return open + body + '</voice></speak>';
  const rate = PCT_.test(o.rate || '') ? o.rate : CONFIG.RATE;
  const pitch = PCT_.test(o.pitch || '') ? o.pitch : CONFIG.PITCH;
  // 앞뒤 무음을 음성팩과 비슷하게 짧게 (기본값이면 끝에 1초 넘게 빈 소리가 붙어 게임이 굼떠짐)
  return open + '<mstts:silence type="Leading-exact" value="60ms"/><mstts:silence type="Tailing-exact" value="100ms"/>' +
    '<prosody rate="' + rate + '" pitch="' + pitch + '">' + body + '</prosody></voice></speak>';
}

const FORMATS = { mp3: 'audio-24khz-48kbitrate-mono-mp3', ogg: 'ogg-24khz-16bit-mono-opus', webm: 'webm-24khz-16bit-24kbps-mono-opus' };

function req_(text, v, fmt, o) {
  return {
    url: 'https://' + azureRegion_() + '.tts.speech.microsoft.com/cognitiveservices/v1',
    method: 'post',
    contentType: 'application/ssml+xml',
    payload: Utilities.newBlob(ssml_(text, v, o), 'application/ssml+xml').getBytes(),
    headers: {
      'Ocp-Apim-Subscription-Key': azureKey_(),
      'X-Microsoft-OutputFormat': FORMATS[fmt] || FORMATS[prop_('FORMAT')] || FORMATS.mp3,
      'User-Agent': 'hangul-app',
    },
    muteHttpExceptions: true,
  };
}

function azure_(text, v) {
  const res = UrlFetchApp.fetch(req_(text, v).url, req_(text, v));
  const code = res.getResponseCode();
  if (code === 200) return { b64: Utilities.base64Encode(res.getBlob().getBytes()) };
  return { error: code, body: String(res.getContentText()).slice(0, 200) };
}

/**
 * 음성팩 새로 만들기용: 드라이브에 저장하지 않고 바로 돌려줌 (앱 쪽에서 모아서 음성팩으로 묶음)
 * lines: 최대 24문장, par: 동시에 부를 수 (무료 계층이면 1)
 */
function gen_(lines, par, fmt, voice, o) {
  const v = voice && /^ko-KR-[A-Za-z]+(:[A-Za-z]+)?$/.test(voice) ? voice : voice_();
  if (!ttsOn_()) return { ok: false, error: 'tts_off' };
  lines = lines.slice(0, 24);
  par = Math.max(1, Math.min(12, Number(par) || Number(prop_('PARALLEL')) || 1));
  const voices = {};
  const failed = [];
  const t0 = Date.now();
  let i = 0;
  while (i < lines.length && Date.now() - t0 < 25000) {
    const batch = lines.slice(i, i + par);
    i += batch.length;
    const res = UrlFetchApp.fetchAll(batch.map(function (t) { return req_(t, v, fmt, o); }));
    let slow = false;
    res.forEach(function (r, j) {
      const code = r.getResponseCode();
      if (code === 200) voices[batch[j]] = Utilities.base64Encode(r.getBlob().getBytes());
      else { failed.push({ t: batch[j], code: code }); if (code === 429) slow = true; }
    });
    if (failed.some(function (f) { return f.code === 401 || f.code === 403; })) return { ok: false, error: 'azure_key', voices: voices, failed: failed };
    if (slow) break;
    if (par === 1) Utilities.sleep(GAP_MS);
  }
  lines.slice(i).forEach(function (t) { failed.push({ t: t, code: 0 }); });
  return { ok: true, voice: v, fmt: fmt || prop_('FORMAT') || 'mp3', voices: voices, failed: failed };
}

/** lines: 문장 목록 → { ok, voices: {문장: base64 mp3}, pending: [아직 못 만든 문장] } (드라이브에 모아 둠) */
function tts_(lines) {
  lines = lines.slice(0, 40);
  const shards = {};
  const voices = {};
  const need = [];
  lines.forEach(function (t) {
    const k = keyOf_(t);
    const s = k.slice(0, 2);
    if (!shards[s]) shards[s] = readJson_('voice2-' + s + '.json');
    if (shards[s][k]) voices[t] = shards[s][k];
    else need.push({ t: t, k: k, s: s });
  });
  const pending = [];
  if (need.length && ttsOn_()) {
    const lock = LockService.getScriptLock();
    lock.waitLock(28000);
    try {
      const cache = CacheService.getScriptCache();
      const dirty = {};
      let made = 0;
      for (let i = 0; i < need.length; i++) {
        const n = need[i];
        if (made >= MAX_NEW_PER_CALL) { pending.push(n.t); continue; }
        const last = Number(cache.get('lastAzure') || 0);
        const wait = last + GAP_MS - Date.now();
        if (wait > 0) Utilities.sleep(wait);
        const r = azure_(n.t);
        cache.put('lastAzure', String(Date.now()), 600);
        made++;
        if (r.b64) { shards[n.s][n.k] = r.b64; dirty[n.s] = true; voices[n.t] = r.b64; }
        else {
          pending.push(n.t);
          if (r.error === 429) Utilities.sleep(GAP_MS);
          if (r.error === 401 || r.error === 403) return { ok: false, error: 'azure_key', voices: voices, pending: need.map(function (x) { return x.t; }) };
        }
      }
      Object.keys(dirty).forEach(function (s) {
        const fresh = readJson_('voice2-' + s + '.json');
        Object.keys(shards[s]).forEach(function (k) { fresh[k] = shards[s][k]; });
        writeJson_('voice2-' + s + '.json', fresh);
      });
    } finally {
      lock.releaseLock();
    }
  } else {
    need.forEach(function (n) { pending.push(n.t); });
  }
  return { ok: true, voices: voices, pending: pending };
}

// 편집기에서 한 번 실행해 보는 점검용 (실행 ▶ 버튼): 드라이브 권한 허용 + Azure 키 확인
function 점검하기() {
  folder_();
  const r = hasKey_() ? azure_('안녕! 나는 뭉치야.') : { error: 'no_key' };
  Logger.log(r.b64 ? 'Azure 음성 OK (' + r.b64.length + '자)' : 'Azure 오류: ' + r.error);
  Logger.log('드라이브 폴더 OK: ' + folder_().getName());
}

// 목소리 시험: 고품질(HD) 목소리가 이 키·지역에서 되는지, 동시에 여러 개 부를 수 있는지(유료 계층) 확인
function 음성시험() {
  const list = ['ko-KR-YuJin:DragonHDOmniLatestNeural', 'ko-KR-SunHi:DragonHDOmniLatestNeural', 'ko-KR-JiMin:DragonHDOmniLatestNeural', 'ko-KR-SunHiNeural'];
  list.forEach(function (v) {
    const t = Date.now();
    const r = azure_('안녕! 나는 뭉치야. 기역, 그! 기역이 들어간 글자를 찾아 줘!', v);
    Logger.log(v + ' → ' + (r.b64 ? 'OK ' + r.b64.length + '자 ' + (Date.now() - t) + 'ms' : '오류 ' + r.error + ' ' + (r.body || '')));
  });
  const reqs = [];
  for (let i = 0; i < 6; i++) reqs.push(req_('하나, 둘, 셋! ' + i));
  const codes = UrlFetchApp.fetchAll(reqs).map(function (x) { return x.getResponseCode(); });
  Logger.log('동시 6개: ' + codes.join(',') + ' (429가 섞이면 무료 계층)');
}

// Azure 키가 어느 지역 것인지 찾아서 AZURE_REGION 속성에 저장 (편집기에서 ▶ 실행, 키 값은 기록하지 않음)
function 지역찾기() {
  const key = azureKey_();
  if (!key) { Logger.log('AZURE_KEY 속성이 비어 있음'); return; }
  Logger.log('키 길이: ' + key.length + '자, 지금 지역: ' + azureRegion_());
  const now = azure_('안녕!');
  Logger.log('지금 설정으로 음성 만들기: ' + (now.b64 ? 'OK' : '오류 ' + now.error));
  if (now.b64) return;
  const regions = ['koreacentral', 'japaneast', 'japanwest', 'eastasia', 'southeastasia', 'centralindia', 'australiaeast',
    'eastus', 'eastus2', 'westus', 'westus2', 'westus3', 'centralus', 'northcentralus', 'southcentralus', 'westcentralus',
    'canadacentral', 'brazilsouth', 'northeurope', 'westeurope', 'uksouth', 'francecentral', 'germanywestcentral',
    'switzerlandnorth', 'swedencentral', 'norwayeast', 'uaenorth', 'southafricanorth', 'qatarcentral', 'italynorth'];
  const codes = [];
  let found = '';
  for (let i = 0; i < regions.length && !found; i++) {
    let c = 0;
    try {
      c = UrlFetchApp.fetch('https://' + regions[i] + '.api.cognitive.microsoft.com/sts/v1.0/issueToken',
        { method: 'post', headers: { 'Ocp-Apim-Subscription-Key': key }, payload: '', muteHttpExceptions: true }).getResponseCode();
    } catch (e) { c = -1; }
    codes.push(regions[i] + ':' + c);
    if (c === 200) found = regions[i];
  }
  if (!found) { Logger.log('어느 지역에서도 키가 맞지 않음 → 키를 다시 복사해 넣어 주세요 (' + codes.join(' ') + ')'); return; }
  PropertiesService.getScriptProperties().setProperty('AZURE_REGION', found);
  const t = azure_('안녕! 나는 뭉치야.');
  Logger.log('키 지역: ' + found + ' → AZURE_REGION 속성에 저장. 음성 만들기: ' + (t.b64 ? 'OK' : '오류 ' + t.error));
}

// 음성 새로 만들기 켜기/끄기 (편집기에서 ▶ 실행). 평소에는 꺼 둠 → Azure 요금이 나가지 않음
function 음성만들기켜기() {
  // 3시간 뒤에는 저절로 꺼짐 (깜빡 잊어도 요금이 계속 나가지 않게)
  PropertiesService.getScriptProperties().setProperties({ TTS: 'on', TTS_UNTIL: String(Date.now() + 3 * 3600000) });
  Logger.log('TTS = on (3시간 동안 음성 새로 만들기 켜짐)');
}
function 음성만들기끄기() { PropertiesService.getScriptProperties().setProperty('TTS', 'off'); Logger.log('TTS = off (과금 없음)'); }
