# 무기 쥐는 점 시험(docs/spec/feedback_1023.md 5) — 브라우저 없이. 새 무기 그림이 오면 돌림.
# data/weapons.json 모든 무기 그림(240×960, 칼끝 위, 쥐는 점 canvas.gripX·gripY)에서
#  ① 손잡이 가운데: 750~800줄마다 가장 긴 불투명 구간(술처럼 가는 장식은 빼고 손잡이)의 가운데 → 가운뎃값이 gripX ± 4
#  ② 칼날이 그림 왼쪽·오른쪽 끝 열에 닿지 않음: 칼끝(gripY − tipFromGrip)부터 750줄 위까지 맨 왼쪽·오른쪽 열이 투명
#     (손잡이 아래 술 끝은 캔버스 밖으로 밀려 잘릴 수 있어 보지 않음)
# 쓰는 법: python3 tools/test/weapongrip.py
import json, os, statistics, sys
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..', '..')
data = json.load(open(os.path.join(root, 'data', 'weapons.json'), encoding='utf-8'))
cv = data['canvas']
GX, GY, TOL, ALPHA = cv['gripX'], cv['gripY'], 4, 40
rows, bad = [], 0
for w in data['weapons']:
    path = os.path.join(root, w['image'])
    if not os.path.exists(path):
        rows.append(f"| {w['id']} {w['name']} | 그림 없음 | - | 문제 |"); bad += 1; continue
    im = Image.open(path).convert('RGBA')
    sx = im.width / cv['width']  # 캔버스와 다른 크기로 저장돼 있으면 맞춤
    a = im.getchannel('A')
    W, H = im.size
    centers = []
    for y in range(750, 801):
        yy = int(y * im.height / cv['height'])
        best, run = None, None
        for x in range(W + 1):
            on = x < W and a.getpixel((x, yy)) > ALPHA
            if on and run is None: run = x
            if not on and run is not None:
                if best is None or x - run > best[1] - best[0]: best = (run, x)
                run = None
        if best: centers.append(((best[0] + best[1] - 1) / 2) / sx)
    c = statistics.median(centers) if centers else None
    top = max(0, int((GY - w.get('tipFromGrip', 600)) * im.height / cv['height']))
    edge = []
    for y in range(top, int(750 * im.height / cv['height'])):
        if a.getpixel((0, y)) > ALPHA: edge.append(f'왼쪽 {y}')
        if a.getpixel((W - 1, y)) > ALPHA: edge.append(f'오른쪽 {y}')
    okc = c is not None and abs(c - GX) <= TOL
    ok = okc and not edge
    bad += 0 if ok else 1
    rows.append(f"| {w['id']} {w['name']} | {'-' if c is None else f'{c:.1f}'} | {'닿지 않음' if not edge else f'닿음 {len(edge)}줄 ({edge[0]}…)'} | {'좋음' if ok else '문제'} |")
print(f'| 무기 | 손잡이 가운데(750~800줄, 기준 {GX}±{TOL}) | 칼날이 끝 열에 | 결과 |')
print('|---|---|---|---|')
print('\n'.join(rows))
print(f'문제 {bad}개' if bad else '문제 없음')
sys.exit(1 if bad else 0)
