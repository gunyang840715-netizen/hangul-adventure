# 낱말 그림 연결표 만들기 (원문 I · 묶음 9) → source/src/art/words.gen.ts
#  - WORD_ART: 낱말 → 그림 번호(그림 키 word.<번호>). 주문서의 '같은_그림'(자동차 = 차)도 넣는다.
#  - EMOJI_ART: 이모지 → 그림 번호. 친구 녹음의 예시 낱말(까치·외투·파도처럼 낱말 목록에 없는 것)은
#    지금 보이는 이모지와 같은 그림이 있으면 그 그림을 쓴다(한 이모지에 그림이 하나뿐일 때만).
# 쓰는 법: python3 source/scripts/words_map.py <art-src/주문서/9-words.json> <저장소 맨 위>
import sys, os, json

src, repo = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
words = {}
by_emoji = {}
for w in d['낱말']:
    words[w['낱말']] = w['번호']
    by_emoji.setdefault(w['이모지'].replace('️', ''), set()).add(w['번호'])
for a, b in (d.get('같은_그림') or {}).items():
    if b in words: words[a] = words[b]
emoji = {e: next(iter(ns)) for e, ns in sorted(by_emoji.items()) if len(ns) == 1}
out = os.path.join(repo, 'source/src/art/words.gen.ts')
s = ('// 자동으로 만든 파일 — source/scripts/words_map.py (손으로 고치지 않음)\n'
     '// 낱말 → 낱말 그림 번호(art/words/<번호>, 그림 키 word.<번호>). 같은 그림을 쓰는 낱말: 자동차 = 차\n'
     'export const WORD_ART: Record<string, string> = ' + json.dumps(words, ensure_ascii=False) + ';\n'
     '// 이모지(FE0F 뺌) → 그림 번호: 낱말 목록에 없는 친구 예시 낱말을 같은 이모지의 그림으로\n'
     'export const EMOJI_ART: Record<string, string> = ' + json.dumps(emoji, ensure_ascii=False) + ';\n')
open(out, 'w', encoding='utf-8').write(s)
print(f'낱말 {len(words)} · 이모지 {len(emoji)} → {out}')
