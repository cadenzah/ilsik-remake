# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — **전직 반영** (2026-10-16): 애슬이 미지의책(174)을 들고 출전하면 전투 전 유닛 9 (SM여왕, PAD 기본값) + 변신 장면 (ECLIPSE1.FAT 11, `promote.ts`), 40장 뒤 레이몬 마수신(57) (원작판 마법 7개일 때만, 개선판 늘). post 단계 `promote` → `learn`. 조사는 es-hangul `josa` (rules.md "전직")
다음: 효과음 (원작 호출 3716:04ae, 전직 ecpani 12·40장 ecpani 7 포함) → 행동 순서 → 43장 검증. 남은 것: 컷신 재생 (ECLIPSE1.FAT 13묶음, 40장 = 8), 투사체 그림 (0x1e2e/0x1e30), 마법 직업 물리 공격 (원작 무기 f2 = 0), 원작 마법 창 모양(ECPMAG), MAG 박자 (DOSBox 대조)
막힌 점: iOS·안드로이드 실기기 길게 누르기·두 번 톡은 실기기로 확인 못 함
실행·테스트: `pnpm dev` (다른 세션이 쓰면 launch.json dev-u4 → 5203). `?ed=remake&stage=1&party=0,24,7,3` → 정비 화면 파란 출전 단추 (735,397) → 결정 (670,447). 장비를 준 채 시작: `(await import('/src/core/battle.ts')).boot(S.ed, S.def, {flags:[], party:[0,8], items:[], equip:{8:[92,131,174]}})` (S = state.ts). dev 전역 __game (S·planFor). 소스 편집하면 페이지가 새로 고쳐진다
