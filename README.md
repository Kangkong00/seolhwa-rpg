# 설화 RPG (가칭)

바람의나라풍 2.5D 성장형 RPG. 전통 설화풍 세계관, 아이폰 가로 화면 중심의 웹 게임입니다.

- 작업 지침과 에셋 규격: [CLAUDE.md](CLAUDE.md)
- 개발 계획서: https://claude.ai/code/artifact/52bf2d20-6d0b-444f-8bc0-987254c5963d
- 그림 프롬프트 모음: https://claude.ai/code/artifact/85967246-5bab-4ad7-8766-d0af60309e2f

현재 단계: 단계 2 — 마을을 걸어 다니는 시제품

## 실행

- 배포 주소: https://kangkong00.github.io/seolhwa-rpg/ (아이폰 사파리 → 공유 → 홈 화면에 추가)
- 내 컴퓨터에서: 저장소 폴더에서 `python3 -m http.server 8000` 실행 후 http://localhost:8000 접속 (파일을 더블클릭해서 열면 동작하지 않음)

## 조작

- 이동: 화면 왼쪽을 누르고 끌기(가상 조이스틱), PC는 방향키·WASD
- `옷` 버튼 / 숫자 1~6: 옷 바꾸기 (시험용)
- `격자` 버튼 / G: 못 가는 칸·지붕 조각 보기와 격자 편집

## 폴더

```
index.html          시작 페이지
src/core/           게임 규칙 (격자, 이동·충돌, 몬스터 돌아다니기) — 화면 코드와 무관
src/scenes/         화면 (맵·던전 공통 MapScene, 캐릭터·몬스터 그림, 지붕 가림, 그림자)
src/ui/             조이스틱, 버튼, 격자 편집 도구
src/save/           기기 안 자동 저장
data/               조정 가능한 값 (game.json, outfits.json, monsters.json, maps/)
assets/             그림
lib/                Phaser 4.2.1 (MIT)
docs/plan.md        개발 계획서 사본
```
