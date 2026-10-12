# 현재 상태 (덮어쓰기로 갱신)
단계: 4단계 E4 분석 완료. 승리 = 남은 적 수(+0x1d56) 0, 패배 = U[0.0] 아리크스 HP 0. 장별 호위 패배·보스 처치·목표 칸 도달(36·37장)·소피아 합류(38장)·엔딩(43장) → formats.md "전투 승패 조건"
다음: 승패 조건을 battles.json(export_web.py)에 `cond` 로 내보내고 src/main.ts checkEnd 를 데이터 기반으로 (Unit 에 부대·대원 번호 필요: 부대 순서 = 일행, NPC, 적 무리). 그 뒤 능력치 번호 5~12
그 다음: 5단계 스토리 분석 (plan.md S1·S2) — scenes.json + dialogue.json 으로 장별 흐름 정리 가능
실행: `pnpm start` / `pnpm dev` (포트 5173) / `pnpm run setup`. 데이터 재생성 `pnpm assets`. 장별 조건 `python tools/cond.py [stage]`. 개발 모드 window.__game.S
