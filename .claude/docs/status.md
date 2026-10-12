# 현재 상태 (덮어쓰기로 갱신)
단계: 4단계 E4 완료. 승패 조건이 battles.json `cond`(tools/cond.py COND)로 나가고 src/main.ts checkEnd 가 데이터 기반 (부대·대원 번호, 숨은 부대 reserve, 상태 변경·장면·합류·엔딩). `?stage=N&route=R` 로 다른 장 배치 시험
다음: 능력치 번호 5~12 (EAD 장비 필드, formats.md D2) → 부대 상태 0~3 의미(AI 분기) → 37장 숨은 부대 출현 조건
그 다음: 5단계 스토리 분석 (plan.md S1·S2) — scenes.json + dialogue.json 으로 장별 흐름 정리 가능
실행: `pnpm start` / `pnpm dev` (5173) / `pnpm run setup`. 데이터 `pnpm assets`. 조건 `python tools/cond.py [stage|check]`. 개발 모드 window.__game.{S,checkEnd}
