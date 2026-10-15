# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — **B1 2차 제안 작성** (2026-10-16): `balance-proposal.md` 밸런스·SRPG 완성도·스토리 1~23 + Q1~Q6, 사용자 항목별 승인 대기. 근거 `tools/balance.py` (joiners --f orig|floor|ratio, curve). 직전: 전직 반영 (rules.md "전직")
다음: B1 승인 결과를 balance-proposal.md "결정" 에 적고 순서대로 (추천 8 시뮬레이터 → 1 피해식). 그 밖 (승인과 무관): 행동 순서 (민첩 키) → 43장 검증. 효과음은 반영 끝 (42952a1). 남은 것: 컷신 재생 (ECLIPSE1.FAT 13묶음, 40장 = 8), 투사체 그림 (0x1e2e/0x1e30), 마법 직업 물리 공격 (원작 무기 f2 = 0), 원작 마법 창 모양(ECPMAG), MAG 박자 (DOSBox 대조)
막힌 점: iOS·안드로이드 실기기 길게 누르기·두 번 톡은 실기기로 확인 못 함
실행·테스트: `pnpm dev` (다른 세션이 쓰면 launch.json dev-u4 → 5203). `?ed=remake&stage=1&party=0,24,7,3` → 정비 화면 파란 출전 단추 (735,397) → 결정 (670,447). 장비를 준 채 시작: `(await import('/src/core/battle.ts')).boot(S.ed, S.def, {flags:[], party:[0,8], items:[], equip:{8:[92,131,174]}})` (S = state.ts). dev 전역 __game (S·planFor). 소스 편집하면 페이지가 새로 고쳐진다
