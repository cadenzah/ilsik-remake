# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — **경험치·레벨업 끝** (2026-10-16): EXE 성장표 → `data/growth.json` (`tools/units.py growth`, setup·`export_web.py data` 에 포함), `rules.ts` expGain·levelUp (두 판 공통), 성장은 `Camp.grown` (+승급 장비 `Camp.equip`, 중단 저장 포함). 연출 OTH 3 「Level Up」 + 알림 창 (원작판 승급·습득만, 개선판 능력치까지)
다음: **공격 유형 15~18** (rules.md 공격 유형) → 전직 (40장 promote) → 행동 순서 → 43장 적용·통과 검증. 남은 것: 레벨업 효과음 (전투 효과음 체계 없음), 원작 마법 창 모양(ECPMAG)·시전자 동작 (ECPnn.MAG)·MAG 박자 (DOSBox 대조), 장 사이 피로·HP 이어받기
막힌 점: iOS 실기기 두 번 톡 확대는 실기기로 확인 못 함
실행: `pnpm dev` (5173 이 다른 세션이면 launch.json dev-u3 → 5193) / 레벨업 시험: `?ed=remake&stage=1` 대화 넘긴 뒤 __game.S 에서 적을 옆 칸에 옮기고 hp 1, 일행 type.exp 95 → 공격. 규칙만은 `await import('/src/editions/original/rules.ts')` 로 levelUp 직접
테스트: 창은 #hud 안 DOM (.owin·.obtn), 칸 클릭은 toScreen + hud 배율로 pointerdown/up (pointerType 'mouse', pointerId 1). 현대식 정비 화면은 CSS zoom 이라 ref 클릭이 빗나감 → JS click. dev 전역 __game (S·camp·toScreen·reachable·planFor). localStorage eclipse.* 테스트 전 백업·비교
