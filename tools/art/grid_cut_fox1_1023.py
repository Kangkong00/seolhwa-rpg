# 2026-10-23 강콩: 여우굴에서 여우가 바닥이 아닌 곳을 걸음 → 왼쪽 위 방·오른쪽 석관 방의 "뒷벽"이 걸을 수 있게 잡혀 있었음
# (10-22 석관 방 add 다각형이 벽까지 넓었음). 지금 격자에서 뒷벽만 막음(다른 칸은 그대로).
import json
from matplotlib.path import Path
P='/home/claude/seolhwa-rpg/data/maps/dungeon_fox_1.json'
m=json.load(open(P)); cs=m['cellSize']; rows=[list(r) for r in m['blocked']]
CUTS=[[(130,200),(430,200),(430,296),(400,300),(372,312),(330,318),(300,326),(250,328),(200,328),(160,330),(130,334)],   # 왼쪽 위 방 뒷벽·석판 더미
      [(1185,236),(1365,236),(1365,300),(1300,298),(1240,296),(1200,300),(1185,304)]]                                    # 오른쪽 석관 방 뒷벽(뿌리)
n=0
for poly in CUTS:
    pa=Path(poly)
    for r in range(len(rows)):
        for c in range(len(rows[0])):
            if rows[r][c]!='#' and pa.contains_point((c*cs+cs/2, r*cs+cs/2)): rows[r][c]='#'; n+=1
txt=open(P).read(); pos=txt.index('"blocked"')
for old,new in zip(m['blocked'],[''.join(r) for r in rows]):
    i=txt.index('"'+old+'"',pos); txt=txt[:i]+'"'+new+'"'+txt[i+len(old)+2:]; pos=i+len(new)+2
open(P,'w').write(txt)
print('막은 칸',n)
