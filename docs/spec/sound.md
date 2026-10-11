# 소리

> 효과음 방식과 목록. CLAUDE.md의 목차에서 연결됨. 내용을 고칠 때는 이 파일에서 해당 부분만 고치고, 파일 전체를 다시 쓰지 않음.

## 소리 (2026-10-11 시작)

- **파일 없이 Web Audio로 코드에서 만든 소리**로 시작(`src/audio/sound.js`). 나중에 소리 파일이 생기면 `data/sounds.json`의 그 소리 `file`에 경로만 넣으면 파일을 씀(못 읽으면 코드 소리).
- 소리: `swing`(휘두르기 바람 소리, 맞든 안 맞든), `woodHit`(목검 맞음 "딱", 히트스톱 순간), `punchHit`(주먹 맞음 "퍽"), `ratHit`(쥐 맞음 "찍"), `ratDie`(쥐 쓰러짐 "찌익" + 털썩), `playerHurt`(주인공 물림). 몬스터별 소리 이름은 `data/monsters.json` `sounds: { hit, die }`.
- 매번 높낮이를 ±`pitchJitter`(8%) 무작위로. 소리마다 `volume`, 전체 `master`는 `data/sounds.json`(모두 임시값).
- 오른쪽 위 `소리 켬/끔` 버튼, 상태는 그 기기에 저장. 아이폰 사파리는 첫 터치 전에 소리가 안 나서, 첫 터치(조이스틱·버튼 포함)·키 입력 때 소리를 켬.
- **아이폰 무음 모드(옆 스위치)에서도 소리 나게 (2026-10-11 강콩, 반영됨 — 아이폰 동작 확인 필요)**: 소리를 켤 때(첫 터치) `navigator.audioSession`이 있으면 `type`을 `'playback'`으로, 없으면 소리 없는 0.5초 WAV를 `<audio>`로 반복 재생해 재생 모드로 바꿈(실패하면 다음 터치에서 다시 시도). 다른 앱으로 나가면 멈추고 돌아오면 다시 재생. 코드는 `src/audio/sound.js` `enablePlaybackMode`.
