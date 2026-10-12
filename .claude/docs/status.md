# 현재 상태 (덮어쓰기로 갱신)
단계: 4단계 마무리. 부대 상태 0~3 확정 (0 행동, 1 경계: 이동력+1 안 일행·피격 시 기상, 2 대기, 3 이동력 0) → 웹 AI 가 부대 상태 기반. 턴 시작 이벤트 124e:e0a5 (11·15·19·23·36·37·38장) → battles.json `turn`, 37장 숨은 부대 = 일행이 지정 칸 진입 시 출현
다음: 5단계 스토리 분석 (plan.md S1·S2, scenes.json + dialogue.json 으로 장별 흐름 → docs/story.md)
남은 소소한 것: 27·36장 메시지 상자 내용(0aa2:0118), NPC 아군 AI, 마법 피로 회복 규칙, 원작 피해 공식(6단계 재설계 대상이라 보류)
실행: `pnpm start` / `pnpm dev` (5173) / `pnpm run setup`. 데이터 `pnpm assets`. 조건 `python tools/cond.py [stage|check]`. `?stage=N&route=R`. 개발 모드 window.__game.{S,checkEnd,planFor}
