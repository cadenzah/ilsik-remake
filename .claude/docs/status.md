# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — **마법·상태 이상 끝** (2026-10-15): 두 판 마법 명령 (원작판 명령창 [마법], 개선판 행동 메뉴·설명·범위 미리보기·예측), 원작 식 (피해·회복·강화·약화·중독·혼수·피로증가·해독), 차례 시작 처리, AI 마법 (직업 8~14) [근사]. 개선판은 혼수 판정 버그만 고침. 코드 `src/core/magic.ts`, 식 `editions/original/rules.ts`, 문서 rules.md "마법"
다음: **경험치·레벨업** (rules.md 식 확정, EXE 표 DS:0x51f·0x3c8·0x4b0·0x4cd·0x502 추출 필요, 마법 경험치·레벨업 마법 습득 포함) → 공격 유형 15~18·전직·행동 순서 → 43장 적용·통과 검증. 마법 남은 것: 원작 마법 창 모양(ECPMAG)·MAG 이펙트
실행: `pnpm dev` (다른 세션이 쓰면 launch.json dev-u3 → 5194 등 빈 포트) / `?ed=remake&stage=8&route=0&party=0,14,2,16,13` 정비 화면 '행동'(aria-label)→결정 = 마법 시험 (8장 = 적 명계사자). DOSBox: `tools/dosbox.py launch`
테스트: 창은 #hud 안 DOM (.owin·.obtn), 칸 클릭은 toScreen + hud 배율로 pointerdown/up (pointerType 'mouse', pointerId 1). dev 전역 __game (S·toScreen·reachable·planFor). 1레벨 아리크스는 8장 적 마법 한 방에 죽음 → 시험 땐 S 에서 hp 올리기. localStorage eclipse.* 테스트 전 백업·비교
