# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 시스템 — 마법·상태 이상 끝 + **8차 요청 반영** (2026-10-15): 원작 MAG 마법 이펙트 재생 (마법 id×6 프레임, formats.md "마법 이펙트"), 개선판 마법 목록 (아이콘·상시 설명), 두 모양 정비 화면 '설정' (원작 모양은 음악 다음 원작풍 버튼 camp-setting.png, 종료는 한 칸 아래 camp-quit.png)·짧은 출전 확인, 두 번 톡 확대 막기 (ux-proposal.md 39)
다음: **경험치·레벨업** (rules.md 식 확정, EXE 표 DS:0x51f·0x3c8·0x4b0·0x4cd·0x502 추출 필요, 마법 경험치·레벨업 마법 습득 포함) → 공격 유형 15~18·전직·행동 순서 → 43장 적용·통과 검증. 마법 남은 것: 원작 마법 창 모양(ECPMAG)·시전자 동작 (ECPnn.MAG)·MAG 박자 길이 (DOSBox 대조)
막힌 점: iOS 실기기 두 번 톡 확대는 실기기로 확인 못 함
실행: `pnpm dev` (다른 세션이 쓰면 launch.json dev-u3·dev-u4 → 5193·5203 등 빈 포트) / `?ed=remake&stage=8&route=0&party=0,14,2,16,13` 정비 화면 → 출전 → 크란 (마법 7개) 선택 → 자기 칸 → 마법. 새 자원 magic-fx.png 는 `tools/export_web.py magic-fx` (setup 전체에도 포함)
테스트: 창은 #hud 안 DOM (.owin·.obtn, 개선판 마법 목록 .mgrow), 칸 클릭은 toScreen + hud 배율로 pointerdown/up (pointerType 'mouse', pointerId 1). 현대식 정비 화면은 CSS zoom 이라 ref 클릭이 빗나감 → JS click. dev 전역 __game (S·toScreen·reachable·planFor). 이펙트 확인은 S.fx 에 step 을 크게 넣어 멈춰 보기. localStorage eclipse.* 테스트 전 백업·비교
