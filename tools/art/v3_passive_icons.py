# 패시브 아이콘 9개(Flow 134~135, 2026-10-22) → assets/items/icons/skill_<id>.png
# 135번 시트는 Flow가 5개를 그림(4번째는 요청에 없던 글자 모양 → 버림)
import sys, os; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from v3_tier3_icons import items, OUT
from PIL import Image
R=items('skill_passive1_sheet.webp',['skill_p_body','skill_p_blade','skill_p_vital','skill_p_breath','skill_p_feet'],1,3)
R.update(items('skill_passive2_sheet.webp',['skill_p_iron','skill_p_momentum','skill_p_master','_drop','skill_p_tiger'],1,3))
os.remove(OUT+'_drop.png'); R.pop('_drop')
P=Image.new('RGBA',(9*130,130),(70,70,70,255))
for k,nm in enumerate(R): P.alpha_composite(R[nm].resize((128,128)),(k*130,1))
P.convert('RGB').save('/home/claude/seolhwa-rpg/docs/passive_icons.png'); print(list(R))
