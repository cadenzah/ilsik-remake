# 현재 상태 (덮어쓰기로 갱신)
단계: 5단계 끝 + 피드백 반영 (2026-10-14): 원작 대륙 지도 찾음 (ECLIPSE.SCR 43, 이름표 0~42, 좌표 EXE) → 장 사이 지도 두 판 공통, 개선판 장 지도를 원작 지도 위에 진행형으로. 유닛 정보 창이 가리킨 칸·선택 유닛을 피해 구석 이동. 원작 장 제목·진로 문구·FAT 형식·FM 음악(ECLIPSE.FMT) 밝힘 (formats.md)
다음: 6단계 — U1 원작 UI·진행 방식 분석 (사용자: 화면 UI 디자인 통일을 6단계에서 기대). 후보: 원작 장 제목 띠(SCR 44~86)를 전투 화면에, FM 음악 재생, 경험치·레벨업
실행: `pnpm dev` (5173) / `?ed=remake&stage=N&route=R&party=1,2,…&items=` 정비 화면부터 (계속 (740,496) → 여행계속 '결정'). 진행 기록 eclipse.progress.remake 를 넣고 타이틀 → 장 지도·지난흔적. 점검 `tools/ecs_check.py`, 맵 `tools/map_ascii.py`, FAT `tools/fat.py`
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로, `while(!window.__game)` 로 부팅 기다림. 대화 넘기기 = #dialogue click. hover 시험은 canvas 에 PointerEvent('pointermove'). localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
