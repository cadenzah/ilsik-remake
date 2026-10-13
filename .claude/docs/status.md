# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 U3 끝 (2026-10-14): 전투 화면을 원작 창틀·원작 창으로 통일, 개선판 반응형 넓은 화면·위 띠·미니맵·확대·대화창, 기록 3칸·중단 저장, 원작 알림 = 공격 확인창 (DOSBox·역어셈블 확인). 구현 상태·남은 것 = ux-proposal.md 끝
다음: 사용자 확인 대기. 후보: 시스템 (경험치·레벨업·마법), 장 제목 띠 그림 (SCR 44~86), 원작 조건 창 장별 문구, 원작 창 위치 (명령창은 맵 창 밖으로도 나감), FM 음악
실행: `pnpm dev` (다른 세션이 5173·5183 을 쓰면 launch.json dev-u3 5193) / `?ed=remake&stage=N&route=R&party=…` 정비 화면부터. DOSBox: `tools/dosbox.py launch` → 로고 Esc·클릭 → 메뉴 (520,76) 지난흔적… 로딩 수십 초, 클릭은 move 뒤 click. 여러 단계 = scratchpad seq.py 식으로
테스트: 창은 #hud 안 DOM (.owin·.obtn), 칸 클릭은 toScreen + hud 배율로 pointerdown/up. dev 전역 __game (S·toScreen·chooseRoute). localStorage eclipse.* (progress·slots·suspend·minimap, 테스트 전 백업·뒤에 되돌릴 것)
