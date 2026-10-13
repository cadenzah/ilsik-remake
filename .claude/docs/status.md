# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 U1 끝 (2026-10-14): 원작 전투 UI·조작·진행 틀을 DOSBox 로 직접 보고 `ux.md` 에 정리 (창틀 클릭 스크롤, 범위 밖 어둡게, 명령/이동 뒤/시스템 창, 공격 확인창, 맵 위 두 칸 대화창, 조건 창 등) + 웹판 차이표 (5절)
다음: U2 — ux.md 5절 차이표를 원작 감성 유지 / 편의 개선으로 나눠 제안 문서 (`ux-proposal.md`) → 사용자 승인. 사용자 기대: 화면 UI 디자인 통일. 후보 별도: 장 제목 띠(SCR 44~86), FM 음악, 경험치·레벨업
실행: `pnpm dev` (5173) / `?ed=remake&stage=N&route=R&party=…` 정비 화면부터. DOSBox: `tools/dosbox.py launch` → 로고 뒤 Esc·클릭 → 메뉴 (520,103) 클릭 = 불러오기 창 → 세이브 3칸. 로딩 느림 (검은 화면 수 초~20초), 클릭은 move 뒤 click 이 확실
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로, `while(!window.__game)` 로 부팅 기다림. 대화 넘기기 = #dialogue click. localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
