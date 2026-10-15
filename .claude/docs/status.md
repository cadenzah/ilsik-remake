# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — **효과음 반영** (2026-10-16): 원작 3716:04ae = 불러오기, 0f17(1) = 재생 (formats.md "효과음 호출부", `tools/sfx.py`). 웹 `src/core/sfx.ts` — 공격음 = ECLIPSE1[초상], 포수 폭발 105~, 마법 ECLIPSE2[id], 사망 111, 레벨업 108, 승급·습득 110, 전직 ecpani 12. 설정 '효과음' + 원작판 시스템 창 '음향'. 자원 `export_web.py sfx` (setup 에 포함)
다음: 행동 순서 (민첩 키) → 43장 검증. 남은 것: 컷신 재생 (ECLIPSE1.FAT 13묶음, 장별 ECPANI 소리 짝은 formats.md), 전투 보상·보물 알림 창 (소리 109), 배경음악 (0f17 종류 0), 투사체 그림 (0x1e2e/0x1e30), 마법 직업 물리 공격 (원작 무기 f2 = 0), 원작 마법 창 모양(ECPMAG), MAG 박자·효과음 정확한 프레임 (DOSBox 대조)
막힌 점: iOS·안드로이드 실기기 길게 누르기·두 번 톡은 실기기로 확인 못 함
실행·테스트: `pnpm dev` (다른 세션이 쓰면 launch.json dev-u4 → 5203). `?ed=remake&stage=1&party=0,24,7,3` → 정비 화면 파란 출전 단추 (735,397) → 결정 (670,447). 장비를 준 채 시작: `(await import('/src/core/battle.ts')).boot(S.ed, S.def, {flags:[], party:[0,8], items:[], equip:{8:[92,131,174]}})` (S = state.ts). dev 전역 __game (S·planFor). 소스 편집하면 페이지가 새로 고쳐진다
