# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — 경험치·레벨업 + **9차 요청 반영** (2026-10-16): 원작 공격·시전 동작 FIG (units/fig + data/fig.json, `export_web.py figs`, setup 전체에도 포함), 걷기·공격 느리게, 레벨업 창에 승급 장비 EQU·마법 아이콘, 끌기·글자 선택·터치 길게 누르기 contextmenu 막기 (main.ts lockPage). 장 사이 HP·피로는 원작도 최대·0 으로 시작 확인 (rules.md)
다음: **공격 유형 15~18** → 전직 (40장 promote) → 효과음 (plan.md, 원작 호출 3716:04ae 찾기) → 행동 순서 → 43장 검증. 남은 것: 원작 마법 창 모양(ECPMAG), MAG 박자 (DOSBox 대조)
막힌 점: iOS·안드로이드 실기기 길게 누르기·두 번 톡은 실기기로 확인 못 함 (데스크톱에서 이벤트 흉내로만 확인)
실행: `pnpm dev` (5173 이 다른 세션이면 launch.json dev-u3 → 5193). 새 자원은 `.venv/bin/python tools/export_web.py figs` 와 `data`. 동작 확인: `?ed=remake&stage=1` 적을 옆 칸으로 옮겨 공격, 시전은 `?ed=remake&stage=8&route=0&party=0,14,2,16,13` 정비 화면 '행동' → 결정 → 크란 마법. u.pose 에 프레임을 넣으면 멈춰 볼 수 있음
테스트: 창은 #hud 안 DOM (.owin·.obtn), 칸 클릭은 toScreen + hud 배율로 pointerdown/up (pointerType 'mouse', pointerId 1). 현대식 정비 화면은 CSS zoom 이라 ref 클릭이 빗나감 → JS click. dev 전역 __game (S·camp·toScreen·reachable·planFor). localStorage eclipse.* 테스트 전 백업·비교
