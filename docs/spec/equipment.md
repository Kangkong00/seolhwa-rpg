# 장비창·가방(최소판)과 아이템 아이콘

## 결정 (2026-10-11 강콩)

- 보상 설계보다 **장비를 먼저**. 초반 장비는 칸마다 1종씩: 무명 두건, 무명 토시, 짚신 + 이미 있는 목검 3종·옷 6종.
- 토시·신발은 화면에 안 보이고 아이콘과 능력치만(확정 사항). 그래서 볼 곳이 필요하므로 **최소한의 장비창·가방**을 같이 만듦.
- 능력치·값·드랍은 아직 미정 → `data/`에 0 또는 빈 값으로만 둠.

## 장비 칸

| 칸 | id 예 | 화면에 보임 |
|---|---|---|
| 무기 `weapon` | `wood_pine`, `wood_oak`, `wood_bakdal` | 보임(`docs/spec/weapons.md`) |
| 옷 `outfit` | `outfit1_hotot` … `outfit6_sinseon` | 보임(옷 그림 교체) |
| 머리 `head` | `hood_mumyeong` | 보임(`docs/spec/headgear.md`) |
| 토시 `arms` | `toshi_mumyeong` | 안 보임 |
| 신발 `feet` | `shoes_jipsin` | 안 보임 |

팔찌 칸은 나중에.

## 아이템 (이름)

| id | 이름 | 칸 |
|---|---|---|
| `hood_mumyeong` | 무명 두건 | head |
| `toshi_mumyeong` | 무명 토시 | arms |
| `shoes_jipsin` | 짚신 | feet |
| `wood_pine` / `wood_oak` / `wood_bakdal` | 소나무 / 참나무 / 박달나무 목검 | weapon |
| `outfit1_hotot` … | `data/outfits.json`의 이름 | outfit |

## 아이콘 그림

- `assets/items/icons/<id>.png` — 256×256 투명 배경, 물건이 가운데(여백 18px). 위 표의 12개 모두 있음.
- 시안: `docs/item_icons.png`(칸 테두리 위 128px·44px 크기 미리보기).
- 만든 방법(기획 쪽, `tools/art/icons.py`): 토시·짚신은 Flow 시트(`assets/source/items_toshi_jipsin_sheet.jpg`) 오림, 두건은 두건 뒷면 그림, 목검은 무기 그림을 45도 눕힘, 옷은 서 있기 정면의 목 아래 부분.

## 최소 장비창·가방 (코드에 맡김, 모양은 임시)

- 오른쪽 위 등에 가방 버튼 하나. 누르면 장비 칸 5개 + 가방 칸 목록이 뜸. 가로 화면·아이폰 터치 크기 고려.
- 가방 아이템을 누르면 해당 칸에 낌(원래 끼던 것은 가방으로). 장비 칸을 누르면 벗음(무기는 벗으면 맨손, 옷은 벗을 수 없음).
- 시험 시작 상태: 홑옷 착용, 두건·토시·짚신·목검 3종은 가방에(시작 설정은 `data/`).
- 끼고 벗은 상태는 자동 저장에 포함.
- 아이템 정의(이름·칸·아이콘·능력치 0)는 `data/`의 아이템 파일로. 나중에 능력치·드랍을 여기에 붙임.
