# Claude Code 인수인계서 (2026-10-15)

새 Claude Code 대화를 시작하면 `CLAUDE.md` → 이 파일 → 작업할 주제의 `docs/spec/*.md` 순서로 읽습니다. 기획 쪽 인수인계는 `docs/handover_planning.md`.

## 1. 일하는 방식 (강콩과 약속한 것)

- **존댓말·결론부터**, 확인 못 한 것은 "확인 필요", 추측은 추측이라고. 쉬운 말로, 답변 끝에 이어서 물어볼 질문 **하나만**.
- 요청 형식: 강콩이 "`docs/spec/xxx.md`를 읽고 1~N번 반영"처럼 보냄. 그 문서가 규격이고, **값은 문서대로**, 문서에 없는 값은 임시로 정하고 답변에 "제가 정한 것(확인 필요)"로 따로 알림.
- 문서 제안이 실제로 안 맞으면(예: 입구가 문 통로라 지나가면 빨려 들어감) 고치고 이유를 알림. 기각된 안은 다시 제안하지 않음(계획서).
- **끝나면**: 해당 `docs/spec/*.md`에 "반영됨" 절을 덧붙이고, `CLAUDE.md` "지금 단계"의 해당 줄에 체크. CLAUDE.md는 **필요한 줄만 고침**(통째로 다시 쓰다 뒷부분이 잘린 사고가 있었음 — Python으로 고칠 땐 `s[:i] + 새것 + s[j:]` 꼴로 뒤를 꼭 붙임).
- 그림·`tools/art/`·`assets/`는 기획 쪽 몫. 코드는 그림을 고치지 않음(물들이기 같은 임시 처리는 코드에서).

## 2. 저장소·배포·커밋

- 저장소 `Kangkong00/seolhwa-rpg`, 브랜치 **main에 바로 올림**(PR 안 씀), GitHub Pages가 자동 배포 → https://kangkong00.github.io/seolhwa-rpg/ (1~2분).
- 기획 쪽도 main에 올리므로 **작업 시작 전 `git pull origin main`, 올리기 전 `git pull --rebase origin main`**.
- 커밋은 작은 단위, 한국어 메시지. 끝에 세션이 알려 주는 attribution 줄(Co-Authored-By / Claude-Session)을 붙임. 커밋 메시지·코드에 모델 이름을 쓰지 않음.

## 3. 코드 지도

- `index.html`(DOM 단추·창 자리) + `lib/phaser.min.js`(Phaser 4.2.1, 저장소에 포함) + `src/main.js`(데이터 파일을 모두 읽고 `MapScene` 시작, 맵 JSON + 물건 조각 목록 받기, webp 투명 검사).
- `src/core/` — **화면과 무관한 규칙**(나중에 서버로): `grid`·`movement`(격자·이동), `mapData`, `monsters`(돌아다니기·반격·쥐왕 돌진·생김), `combat`(맞히기·맞히기 도움 `aimAssist`), `progress`(경험치·레벨·최대 체력·레벨 데미지), `stats`(공격력·방어력·걸음·레벨 제한), `equipment`(장비·가방 겹침·엽전·한 번 주는 선물), `loot`(드랍·바닥 물건, 시험 배율 `killRewards`), `shop`, `skills`(배우기·재사용 시간), `quests`, `money`(푼·전·냥 표시).
- `src/scenes/MapScene.js` — 한 장면이 모든 맵을 맡음(맵을 옮기면 `scene.restart`, 이어지는 상태는 `this.d`에). 큼(약 1300줄): 겉모습(옷+두건 합성·무기), 공격·무예·휘두르기, 쓰러뜨림·경험치·드랍, NPC·가게·정보창 연결, 귀환, 맵 이동(`travel`, 잠긴 출구 `unlockOnKill`), 저장, 매 프레임 `update`.
- 그리기: `PlayerView`(몸·무기·손 덮개·빛남), `characterFrames`(그림 불러와 줄이기·외곽선·다리 반전·두건 합성), `weaponPose`(3D 칼 방향), `weaponFx`(궤적·먹 튐), `MonsterView`(물들임·돌진 예고·밀려나 보이기), `NpcView`, `dropView`(바닥 전리품), `mapObjects`(앞뒤 가림 조각·가려짐 윤곽 — 지금 꺼 둠), `levelUpFx`, `skillFx`(무예 연출), `progressFx`(빛 고리·빛기둥·반짝이 그림), `damageText`, `pickupFeed`, `portalFx`, `npcMenu`(사람 창 내용), `itemInfoView`(정보창 내용).
- 타격·무예(10-18): 모든 맞힘은 `MapScene.impactHit`(회심·섬광·베인 자국·쓰러뜨림), 무예 동작은 `src/scenes/skillKinds.js`(kind별, 오래 걸리는 것은 `scene.setAct`), 연출 그림은 `skillFx.js`·`impactFx.js`, 무예 칸·무예창은 `src/ui/skillButtons.js`·`skillPanel.js`.
- 시험 함정: 느리게 돌려 찍으려면 `s.sys.sceneUpdate`를 감싸야 함(`s.update`를 바꾸면 안 먹음) + `s.tweens.timeScale`·`s.time.timeScale`.
- `src/ui/adminPanel.js` — 관리자 창(나·물건·맵·설정, `docs/spec/admin_mode.md`). 안 죽기·한 방은 `this.d.admin`(저장 안 함), 저장 지우기 중엔 `this.d.noSave`.
- `src/ui/` — DOM 화면: 조이스틱(왼쪽에 선 NPC를 누르면 `tapHandler`), 공격·무예 단추, `hud`(소리·귀환·가방·격자), 장비창·가방, 사람 창, 정보창, 왼쪽 위 상태, 알림, `josa`(조사 고르기).
- `src/save/localSave.js` — 자동 저장(localStorage `seolhwa-rpg:save:v1`). 저장 내용: 맵·위치·장비/가방/엽전/선물·레벨·배운 무예·의뢰. 체력·재사용 시간은 저장 안 함.
- `src/audio/sound.js` — 효과음은 파일 없이 Web Audio로 만든 소리(`data/sounds.json`에 파일 경로를 넣으면 파일 사용). 아이폰 무음 모드 대응 포함.
- `data/` — **모든 수치**(코드 수정 없이 조정): `game.json`(카메라·주인공·공격·맞히기 도움·숫자·귀환·외곽선…), `items.json`, `weapons.json`(무기·쥐는 점·휘두르기·궤적), `monsters.json`, `skills.json`, `npcs.json`, `quests.json`, `economy.json`(레벨 표·바닥 물건·글자·레벨업 연출), `outfits.json`, `sounds.json`, `maps/*.json`(격자·입구·몬스터 구역).

## 4. 꼭 지킬 것 (코드)

- 카메라 1.0배, 발밑 그림자(서는 모든 것), `src/core`는 화면 코드 참조 금지, 수치는 `data/`.
- 깊이(앞뒤): 서는 것은 깊이 = 발 y, 물건 조각은 깊이 = `baseY`, 그림자는 -0.9(땅 위), 글자 연출 1e6.
- 옷 6종 모두 무기 자세가 있음(10-18). 그림이 빠진 옷이 생기면 `canSwing` false로 주먹(안전장치).

## 5. 시험하는 법 (Playwright, 저장소의 `tools/test/`)

- 서버: `python3 -m http.server 8123`(백그라운드). 크롬은 `/opt/node22/lib/node_modules/playwright` + swiftshader.
- `node tools/test/smoke.mjs <출력폴더> [맵] [레벨]` — 저장을 심어 열고, 오류가 없는지·화면을 찍음. 다른 시험은 이걸 고쳐 씀.
- 함정(실제로 겪음):
  - **저장 심기는 `addInitScript`로**(첫 로드 때 한 번만). 페이지에서 `localStorage`를 바꾸고 새로고침하면 게임이 닫힐 때 자동 저장해서 덮어씀.
  - 헤드리스는 느리고 게임은 한 프레임 시간을 50ms로 자르므로 **게임 시간이 실제 시간보다 느림** → 기다리는 시간을 넉넉히, 또는 `scene.updateSpin(50)`처럼 직접 돌려 숫자를 확인.
  - 몬스터가 돌아다녀 맞히기 시험이 흔들림 → `s.spawner.update = () => ({ born: [], bites: [] })`로 멈춤.
  - 카메라가 맵 끝에서 멈추므로 주인공은 화면 가운데가 아닐 수 있음 → `cameras.main.worldView`로 화면 좌표를 계산해 찍음.
  - 개발용 전역 `window.seolhwa.game` → `seolhwa.game.scene.getScene('map')`.
- 아이폰 확인은 강콩이 함. 그래서 "확인 필요"를 분명히 남김.

## 6. 남은 일·알려진 문제

- 새 무기 3종·대장장이: 10-16 반영됨(`feedback_1015.md` "반영됨 (2026-10-16)"). 가게 `sells`에 `price`가 없으면 `items.json` `shopPrice`(엽전 + 재료)로 팖. 쥐왕이 새 무기를 떨어뜨릴지는 강콩 답 기다림.
- 옷 2~6 무기 자세: 미룸.
- 우물 바로 뒤(690,368)에서 아랫몸이 베이지색 네모에 가려짐 — 우물 조각이 흙바닥까지 품고 있음(그림 문제, 기획 쪽에 알림, `docs/spec/maps.md` v2).
- 가려짐 윤곽(`occlusionGhost`)은 꺼 둠. 켜면 동작은 함(시험 완료).
- 새 굴 3개 격자는 초안 — 어긋난 곳은 게임 안 격자 편집(G)으로 고친 파일을 받아 교체.
- 족제비굴 입구를 문서 제안(나무 문 통로)에서 닭장 마당 안쪽으로 옮김 — 강콩 확인 필요.
- 예전 데미지 숫자가 아이폰에서 안 보였던 까닭은 못 찾음(크기를 키움, 확인 필요).
- 레벨 15·몬스터·경험치·가격 등 수치는 모두 임시값.

## 7. 최근 흐름 (무엇을 언제 했나 — 자세한 건 각 spec의 "반영됨")

- 10-10~11: 시제품(걷기·격자·지붕 가림)·들쥐굴 1층·싸움·목검 휘두르기·궤적·소리.
- 10-11~12: 장비창·두건·초보 구간(경험치·드랍·가게·무예·의뢰)·맞히기 도움·레벨업 연출·앞뒤 가림 v1/v2·2차 다듬기·레벨 15.
- 10-14~15: 새 그림체 값, 굴 들쥐·쥐왕·족제비·새 맵 3·마을 사람 그림·성황당, 10-15 피드백(무예 연출·숫자·귀환·정보창·능력치·새 무기 데이터).
