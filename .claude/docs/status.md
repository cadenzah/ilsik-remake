# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 U2 초안 (2026-10-14): `ux-proposal.md` — 핵심 = 전투 화면도 640×480 원작 창틀·원작 창 모듈로 통일 (가 1~8 공통), 원작판 재현 (나 9~11), 개선판 편의 (다 12~25), 질문 Q1~Q5
다음: 사용자 승인 받기 (항목별 승인·Q1~Q5 답) → U3 구현 (제안서 끝 "구현 순서" 1→5). 후보 별도: 장 제목 띠(SCR 44~86), FM 음악, 경험치·레벨업
실행: `pnpm dev` (5173, 다른 세션이 띄워 둔 경우 preview_start url 로 접속) / `?ed=remake&stage=N&route=R&party=…` 정비 화면부터. DOSBox: `tools/dosbox.py launch` → 로고 뒤 Esc·클릭 → 메뉴 (520,103) = 불러오기 → 세이브 3칸
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로, `while(!window.__game)` 로 부팅 기다림. 대화 넘기기 = #dialogue click. localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
