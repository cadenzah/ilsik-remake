# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 U3 + 사용자 요청 4차 끝 (2026-10-15): 개선판 화면 틀 고르기 (원작 창틀 / 현대식, 정비 화면 포함), 미니맵 비키기, 기록 옮기기 (코드·파일), 조건 창을 장 앞 대화 뒤로, 지난흔적 두 줄, 도구설명 3줄 맞춤, 제작진 4쪽 제보 안내. 내용 = ux-proposal.md 끝 (32~35)
다음: 사용자 확인 대기. 후보: 현대식 타이틀, 시스템 (경험치·레벨업·마법), 장 제목 띠 그림 (SCR 44~86), 원작 조건 창 장별 문구, FM 음악
실행: `pnpm dev` (다른 세션이 5173·5183 을 쓰면 launch.json dev-u3 5193) / `?ed=remake&stage=N&route=R&party=…` 정비 화면부터. DOSBox: `tools/dosbox.py launch` → 로고 Esc·클릭 → 메뉴 (520,76) 지난흔적… 로딩 수십 초, 클릭은 move 뒤 click. 여러 단계 = scratchpad seq.py 식으로
테스트: 창은 #hud 안 DOM (.owin·.obtn), 칸 클릭은 toScreen + hud 배율로 pointerdown/up. dev 전역 __game (S·toScreen·chooseRoute). localStorage eclipse.* (progress·slots·suspend·minimap·modernUi·backup, 테스트 전 백업·뒤에 되돌릴 것). 현대식 = localStorage eclipse.modernUi=1
