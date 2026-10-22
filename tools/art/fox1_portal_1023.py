# 2026-10-23 강콩: 여우굴 → 구미호의 방 입구가 "길이 아니고 벽을 넘어가야" 함.
# 굴 입구(아치)는 높은 턱 위에 있고, 격자가 턱 앞 절벽면(y≈280~300)을 걸을 수 있게 이어 놓았음.
# → 턱·아치 안·절벽면을 막고, 입구 사각형을 길이 끝나는 절벽 밑(아치 바로 아래)으로 내림.
import json
P='/home/claude/seolhwa-rpg/data/maps/dungeon_fox_1.json'
m=json.load(open(P)); cs=m['cellSize']; rows=[list(r) for r in m['blocked']]
X0,X1,YCUT=984,1100,300          # 이 가로 범위에서 y<300은 모두 막음(턱·아치·절벽면)
n=0
for r in range(len(rows)):
    for c in range(len(rows[0])):
        x=c*cs+cs/2; y=r*cs+cs/2
        if X0<=x<=X1 and y<YCUT and rows[r][c]!='#': rows[r][c]='#'; n+=1
txt=open(P).read(); pos=txt.index('"blocked"')
for old,new in zip(m['blocked'],[''.join(r) for r in rows]):
    i=txt.index('"'+old+'"',pos); txt=txt[:i]+'"'+new+'"'+txt[i+len(old)+2:]; pos=i+len(new)+2
# 입구 사각형·빛 자리
old_p=json.dumps([p for p in m['portals'] if p['id']=='to_fox_2'][0],ensure_ascii=False)
import re
txt=re.sub(r'("id": "to_fox_2".*?"x": )1012(, "y": )202(, "w": 56, "h": )40(, "fx": \{"shape": "ellipse", "x": )1012(, "y": )210',
           r'\g<1>1012\g<2>298\g<3>28\g<4>1012\g<5>300',txt,flags=re.S)
open(P,'w').write(txt)
print('막은 칸',n)
