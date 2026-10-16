# 현재 상태 (덮어쓰기로 갱신)
단계: 6단계 — 컷신 재생 완료 (2026-10-17): ECLIPSE1.FAT 12묶음을 원작 단계표대로 (`src/core/cutscene.ts`, formats.md "컷신 재생", 분석 `tools/anim.py trace`). 두 판 × 12장 `tools/verify_cuts.js` 오류 0. 43장 통과 검증 (2026-10-16) 은 그대로
다음: 남은 것 중 고르기 — 배경음악 (ECLIPSE.FMT), 엔딩·타이틀 애니 (ECLIPSE2·3.FAT·ECPTIT.FAT, 0aa2:3887~), 보물 줍기 (21장 고대은화 → 수호자 강화·컷신 10), 투사체 그림 (0x1e2e/0x1e30), 마법 직업 물리 공격 (무기 f2 = 0), 원작 마법 창 (ECPMAG), MAG 박자 (DOSBox), 9장 원작판 선택지 UI. B1 은 사용자가 풀면
막힌 점: 손으로 끝까지 깨 보기·캠페인 연속 진행은 자동 검증 밖. 컷신 흰/검정 효과는 브라우저 창을 보이게 둬야 눈으로 확인됨 (숨기면 CSS 전이가 멈춤). 성장 없는 기본 일행이면 원작판 B 14·26장 선두가 첫 차례 전에 쓰러짐 (B1). iOS·안드로이드 실기기 효과음·터치 미확인
실행·테스트: `pnpm dev` (실제 포트는 preview_logs). `?ed=remake&stage=N&route=R&party=…&items=…&nocamp` (pnpm dev 에서만). 자동 검증: `python tools/verify.py --plan` 뒤 `await import('/tools/verify_browser.js')`, 컷신은 `/tools/verify_cuts.js` (사용법은 파일 머리). 다른 세션이 같은 폴더를 고치는 중이면 앱 페이지가 새로고침되니 위 창은 정적 파일 (예: /assets/data/labels.json) 로 두고 iframe 으로
