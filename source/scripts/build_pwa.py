# 앱 설치(PWA)용 파일 만들기
#  source/dist/index.html(빌드 결과) → 저장소 맨 위(GitHub Pages가 보여 주는 곳)에
#  index.html · manifest.webmanifest · sw.js 를 씀
#  보통은 GitHub Actions가 자동으로 실행함 (.github/workflows/build.yml)
#  직접 할 때: cd source && npm ci && npm run build && python3 scripts/build_pwa.py
import json, hashlib, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get('HANGUL_SRC') or os.path.dirname(HERE)       # source 폴더
OUT = os.environ.get('HANGUL_OUT') or os.path.dirname(SRC)         # 저장소 맨 위
p = lambda *a: os.path.join(*a)

app = open(p(SRC, 'dist', 'index.html'), encoding='utf-8').read()
# 음성팩은 따로 (voice-manifest.json + voice.<해시>.<n>.json, 저장소 맨 위). 앱은 목록을 읽어 조각을 받는다
head = ('<link rel="manifest" href="manifest.webmanifest">'
        '<link rel="icon" type="image/png" href="icon-192.png">'
        '<link rel="apple-touch-icon" href="apple-touch-icon.png">'
        "<script>window.__VOICE_MANIFEST__='voice-manifest.json';</script>")
assert '<head>' in app
html = app.replace('<head>', '<head>' + head, 1)
open(p(OUT, 'index.html'), 'w', encoding='utf-8').write(html)

manifest = {
  'id': './', 'name': '뭉치와 냥이의 글자 모험', 'short_name': '글자 모험', 'lang': 'ko',
  'start_url': './', 'scope': './', 'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'], 'orientation': 'landscape',
  'launch_handler': {'client_mode': ['navigate-existing', 'auto']},
  'background_color': '#ffe3f1', 'theme_color': '#ffc6e1',
  'icons': [
    {'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
    {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
    {'src': 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
  ],
}
open(p(OUT, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=1))

# 서비스 워커 버전 = 앱 + 음성팩 목록의 해시 (바뀌면 태블릿이 새 버전을 받음)
vm = open(p(OUT, 'voice-manifest.json'), 'rb').read() if os.path.exists(p(OUT, 'voice-manifest.json')) else b''
ver = hashlib.sha1(html.encode() + vm).hexdigest()[:10]
sw = open(p(HERE, 'sw.template.js'), encoding='utf-8').read().replace('__VERSION__', ver)
open(p(OUT, 'sw.js'), 'w', encoding='utf-8').write(sw)
print('index', round(len(html) / 1e6, 2), 'MB  sw', ver, '→', os.path.abspath(OUT))
