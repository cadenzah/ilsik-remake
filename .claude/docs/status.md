# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — **혜유 질풍화 두 번 행동** 두 판 반영 (2026-10-16, rules.md "특례 2ff8:1109"). 행동 순서 (민첩 키) 항목은 이미 끝나 있던 것 확인·정리. B1 밸런스 제안은 사용자 보류 (balance-proposal.md "결정": Q1 ③ 비율·Q3 가벼운 대가·Q5 50% 만 미리 정함)
다음: 43장 검증 (전 장 통과). 남은 것: 컷신 재생 (ECLIPSE1.FAT 13묶음, 40장 = 8), 배경음악 (ECLIPSE.FMT), 투사체 그림 (0x1e2e/0x1e30), 마법 직업 물리 공격 (원작 무기 f2 = 0), 원작 마법 창 모양(ECPMAG), MAG 박자 (DOSBox 대조). B1 은 사용자가 풀면 8 시뮬레이터부터
막힌 점: iOS·안드로이드 실기기 길게 누르기·두 번 톡은 실기기로 확인 못 함. 원작판 두 번 행동은 브라우저로 직접 눌러 보지 않음 (같은 코드 경로, 개선판·AI 만 확인)
실행·테스트: `pnpm dev` (5173 이 쓰이면 launch.json dev-u4, 실제 포트는 preview_logs 로). `?ed=remake&stage=1&party=0,17` → 출전 (735,395) → 결정 (664,444). 전투 중 수정은 `const {S} = await import('/src/core/state.ts')` 로 유닛을 바꾸고, 턴 종료는 `(await import('/src/core/battle.ts')).endPlayerStep()`. 소스 편집하면 페이지가 새로 고쳐진다
