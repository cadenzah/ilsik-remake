# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 U2 (2026-10-14): `ux-proposal.md` 1~29. 결정: Q1 끌기·방향키 허용 + 개선판 확대 (28), Q3 저장 둘 다, Q4 알림 동작 없음, Q5 개선판 넓은 화면 + 창틀 (27, 높이 480 고정·위아래 띠만 늘림), Q6 미니맵 (29)
다음: Q2 (꽉 맞춤 / 정수배) 답 + 나머지 항목 일괄 승인 받기 → U3 구현 (제안서 끝 "구현 순서" 1→5). 후보 별도: FM 음악, 경험치·레벨업
실행: `pnpm dev` (5173, 다른 세션이 띄워 둔 경우 preview_start url 로 접속) / `?ed=remake&stage=N&route=R&party=…` 정비 화면부터. DOSBox: `tools/dosbox.py launch` → 로고 뒤 Esc·클릭 → 메뉴 (520,103) = 불러오기 → 세이브 3칸
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로, `while(!window.__game)` 로 부팅 기다림. 대화 넘기기 = #dialogue click. localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
