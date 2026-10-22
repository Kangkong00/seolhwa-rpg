# 몬스터 옆모습 그림 폭(docs/spec/feedback_1022.md 3) → data/monsters.json 몬스터마다 sideWidth(표시 px).
# 몬스터 막힘 상자 가로 = sideWidth × 50%(최소 10px). 그림(assets/monsters/<id>/side*.png)을 바꾸면 다시 돌림.
# 그림 캔버스(monsters.json canvas)에서 standHeight가 키(height)로 그려지므로 표시 폭 = 보이는 픽셀 폭 × height / standHeight.
# 쓰는 법: python3 tools/data/monster_side_width.py
import json, os, re
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..', '..')
path = os.path.join(root, 'data', 'monsters.json')
text = open(path, encoding='utf-8').read()
data = json.loads(text)
canvas = data['canvas']
for m in data['monsters']:
    folder = os.path.join(root, m['folder'])
    w = 0
    for f in ('side.png', 'side_step.png'):
        p = os.path.join(folder, f)
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        sx = canvas['width'] / im.width  # 그림이 캔버스와 다른 크기로 저장돼 있으면 맞춤
        bbox = im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
        if bbox:
            w = max(w, (bbox[2] - bbox[0]) * sx)
    if not w:
        continue
    side = round(w * m['height'] / canvas['standHeight'])
    # 그 몬스터 줄의 "height": N 바로 뒤에 "sideWidth"를 넣거나 바꿈(파일 모양은 그대로)
    line_re = re.compile(r'(\{"id": "%s",[^\n]*)' % re.escape(m['id']))
    mm = line_re.search(text)
    line = mm.group(1)
    if '"sideWidth"' in line:
        new = re.sub(r'"sideWidth": \d+', '"sideWidth": %d' % side, line)
    else:
        new = re.sub(r'("height": \d+(?:\.\d+)?,)', r'\1 "sideWidth": %d,' % side, line, count=1)
    text = text.replace(line, new)
    print(m['id'], 'height', m['height'], 'sideWidth', side)
json.loads(text)
open(path, 'w', encoding='utf-8').write(text)
