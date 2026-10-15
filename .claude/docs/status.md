# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 U3 + 사용자 요청 7차 끝 (2026-10-15): 오른쪽 클릭·페이지 확대 막기, 원작판 메뉴 정리 (설정·장 선택 뺌, 원작 글꼴 고정), 설정 '개선된 UI' 이름·순서 + 기록 옮기기 이동, 개선판 행동 메뉴 '상태'·바깥 누르기 = 뒤로·'메뉴' 닫기·띠 '뒤로' 없앰, 아군 차례 시작 대원 골라 두기, **통행 규칙 원작대로** (이동방식 vs 레이어2, 비용 1 — 2장 물 건너기 버그). 내용 = ux-proposal.md 38, rules.md 이동
다음: 사용자 확인 대기. **마법 미구현** (카론 등 마법을 못 씀 — 웹에 마법 행동 자체가 없음, 원작 식은 rules.md 에 확정) 이 가장 큰 빈 곳. 그 밖 후보: 경험치·레벨업, 현대식 타이틀, 배치 미리보기, 장 제목 띠 그림, FM 음악
실행: `pnpm dev` (다른 세션이 5173 을 쓰면 launch.json dev-u3 5193) / `?ed=remake&stage=N&route=R&party=…` 정비 화면부터. DOSBox: `tools/dosbox.py launch` → 로고 Esc·클릭 → 메뉴 (520,76) 지난흔적… 로딩 수십 초, 클릭은 move 뒤 click. 여러 단계 = scratchpad seq.py 식으로
테스트: 창은 #hud 안 DOM (.owin·.obtn), 칸 클릭은 toScreen + hud 배율로 pointerdown/up (pointerType 'mouse', pointerId 1 — touch 는 setPointerCapture 가 실패). dev 전역 __game (S·toScreen·reachable·chooseRoute). localStorage eclipse.* (progress·slots·suspend·minimap·modernUi·backup, 테스트 전 백업·뒤에 되돌릴 것). 현대식 = localStorage eclipse.modernUi=1
