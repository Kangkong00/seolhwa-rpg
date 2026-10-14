# 새 그림체 전환 반영 (2026-10-14)

> 강콩이 Flow로 새 그림체 42장을 뽑았고(원본 `assets/source/v3/`), 기획 쪽이 게임 그림으로 가공해 올림. **파일 이름·캔버스 규격은 그대로**라 대부분 코드 수정 없이 바뀜. 아래 "Claude Code가 바꿀 값"만 고치면 됨. 가공 도구는 `tools/art/v3_*.py`, `hood_cut_v3.py`, `village_objects_v3.py`, `grid_draft_v3.py`.

## 바뀐 그림 (코드 수정 없음)

| 무엇 | 파일 | 비고 |
|---|---|---|
| 옷 6종 서 있기·걷기·주먹 | `assets/characters/<옷>/{front,side,back}{,_step,_punch}.png` | 규격 그대로(400×720 / 640×720, 발 700, 정면 키 640) |
| 홑옷 무기 자세 5종 + 손 덮개 | `outfit1_hotot/{dir}_{hold,hold_step,raise,swing,strike}{,_hand}.png` | 쥐는 점이 바뀜 → 아래 |
| 목검 3종 | `assets/weapons/wood_*.png` | 칼끝을 옛 그림과 같은 높이에 맞춤 → `tipFromGrip`·궤적 그대로 |
| 무명 두건·상투 지우개·머리 위치 | `assets/equipment/head/` (`head_anchor.json` 포함, 69개 자세) | 파일만 바뀜 |
| 들쥐·큰 들쥐 | `assets/monsters/{rat,bigrat}/` | 640×400, 발 380, 정면 키 240 |
| 마을 | `assets/maps/village.jpg`(2752×1536) + 물건 조각 `village_objects.*`(334개, 형식 같음) | 위치가 옛 마을과 같음(어긋남 0.2px 미만) → 격자·입구·NPC 자리 그대로 |
| 들쥐굴 1층 | `assets/maps/dungeon_rat_1.jpg` | 위치 같음 → 격자 그대로 |
| 아이콘 20개 | `assets/items/icons/*.png` | 이름 그대로 |

## 새 그림 (코드에 연결 필요)

| 무엇 | 파일 | 규격 |
|---|---|---|
| 곳간 쥐왕 | `assets/monsters/rat_king/` 6장 | 몬스터 규격 그대로. 표시 키 50 |
| 족제비 | `assets/monsters/weasel/` 6장 | 〃 표시 키 34 |
| 굴 들쥐 | (새 그림 없음) `rat` 그림을 어둡게 물들임 | 표시 키 30 |
| 마을 사람 5명 | `assets/npcs/{gungwan,jumo,yakbang,gatbachi,chief}/front.png` | **400×800, 발 y=780, 가로 가운데**. 5명 같은 배율(키 차이 유지), 가장 큰 사람(촌장, 갓 포함) 740px = 표시 70px → **모두 70/740배**로 그림. 발밑 그림자 필수 |
| 새 아이콘 8개 | `loot_weasel_meat`, `loot_weasel_hide`, `loot_hwangmo`, `loot_ratking_coins`, `item_return_charm`, `skill_power_slash`, `skill_breath`, `skill_whirl` (.png) | 256×256. 무예 3개는 지금 한자 글자(斬·息·旋) 대신 |
| 들쥐굴 2층 | `assets/maps/dungeon_rat_2.jpg` | 격자 초안 `docs/map_drafts/dungeon_rat_2_blocked.txt` |
| 들쥐굴 3층(쥐왕의 방) | `assets/maps/dungeon_rat_3.jpg` | 〃 `dungeon_rat_3_blocked.txt` |
| 족제비굴 1층 | `assets/maps/dungeon_weasel_1.jpg` | 〃 `dungeon_weasel_1_blocked.txt` |

- 족제비 고기·쥐왕 꿰미 아이콘은 Flow가 쥐고기·엽전과 똑같이 그려서 **색만 바꿔 임시로 구별**함(족제비 고기 = 짙은 살코기, 꿰미 = 금빛). 다시 그리면 같은 이름으로 교체.
- 격자 초안: 172×96칸(8px), `#`=못 감. 밝기 + 눈으로 잰 다각형이라 **몇 칸씩 어긋남** — 게임 격자 편집으로 고침. 미리보기 `docs/map_drafts/*_grid.jpg`(빨간 곳 = 못 감).
- 던전에는 앞뒤 가림 조각을 만들지 않음: 벽이 모두 못 가는 칸이고 캐릭터 뒤로 솟은 물건이 거의 없어(시험해 보니 반딧불·짚 조각뿐) 필요 없음. 그래서 **빈 바닥판(프롬프트 41~43)은 안 뽑아도 됨**.

## Claude Code가 바꿀 값

1. `data/outfits.json` `legSplitY`(새 그림의 가랑이 위치): 홑옷 552, 무명옷 596, 도포 601, 철릭 633, 두정갑 593, 신선복 599. 홑옷 `holdLegSplitY` 560 → **545**. 걷기에서 다리 반전 경계가 옷자락에 걸리면 몇 px 조정.
2. `data/weapons.json` `attach.outfit1_hotot` 쥐는 점(theta·lat는 그대로):
   - hold: front [200,417], side [218,418], back [400,405]
   - hold_step: front [226,406], side [226,417], back [450,390]
   - raise: front [151,172], side [214,147], back [482,173]
   - swing: front [182,216], side [131,232], back [462,212]
   - strike: front [335,468], side [227,459], back [386,375]
   - 궤적(`trail`)은 내려치기 주먹을 기준으로 그려 둔 모양이라, **모양 전체를 strike 주먹이 움직인 만큼 옮김**(center·from·to·scaleAbout에 같은 값을 더함): front (−25, +4), side (+17, −21), back (−44, −15). 그러면 scaleAbout = 새 strike 주먹과 같아짐.
   - 손 덮개 피부 덩어리의 가운데를 잰 값. 뒷면 내려치기는 손목까지 잡혀 몇 px 어긋날 수 있음 — 아이폰에서 보고 조정.
3. 몬스터 `data/monsters.json`에 `rat_deep`(rat 그림 + 어둡게, `tint` 예: 0x8a7a70), `rat_king`, `weasel` 추가 — 수치는 `docs/spec/beginner_area.md` 표(임시). 쥐왕 돌진·족제비 빠름도 그 문서대로.
4. `data/npcs.json`: `outfit` 대신 `image`(위 경로)로. 표시 배율 70/740.
5. 아이템: 새 전리품 4개 + 귀환 부적(`docs/spec/beginner_area.md` "새 전리품"), 아이콘 경로 연결. 무예 단추·무예 배우기 창은 `skill_*` 아이콘으로.
6. 새 맵 3개 `data/maps/{dungeon_rat_2,dungeon_rat_3,dungeon_weasel_1}.json`(격자 = 초안 파일, 좌표 1376×768) + 입구(제안, 좌표 1376 기준·확인 필요):
   - 들쥐굴 1층 맨 위 가운데 어두운 굴(약 x660~720, y70~110 — 지금 막아 둔 칸 열기) ↔ 2층 아래 방(도착 약 690,690).
   - 2층 오른쪽 위 굴(약 x1100~1170, y230~290) ↔ 3층 왼쪽 아래 굴(도착 약 250,560).
   - 3층: 쥐왕을 쓰러뜨리면 가운데(약 690,420)에 "마을로" 출구가 빛남 → 마을 곳간 쥐구멍 앞(340,184).
   - 마을 닭장 마당 나무 문 안쪽(약 x1225~1260, y585~605) ↔ 족제비굴 사다리 아래(약 x588~644, y628~664, 도착 약 690,690).
   - 몬스터 구역: 2층 굴 들쥐(큰 방·곡식 방·뼈 방·젖은 방) + 큰 들쥐 1, 3층 쥐왕 1(돌아다니지 않음, 가운데 위) + 굴 들쥐 3, 족제비굴 족제비(둥지 방·알껍데기 방·뿌리 방·위쪽 길).
7. 레벨 표 15까지는 이미 반영됨(`beginner_area.md`).

## 아직 남은 것

- 옷 2~6 무기 자세(미룸, 그대로 주먹).
- 맞히기 상자·발 상자(`footBox`)는 그림 크기가 같아 그대로 둠 — 쥐왕·족제비만 새로 잡음.
