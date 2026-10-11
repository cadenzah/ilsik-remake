# 현재 상태 (덮어쓰기로 갱신)
단계: 4단계 E3 완료. 대화 = EXE 0aa2:4138 장면 함수 → tools/script.py → scenes.json (88장면, 전/중/후, 합류, 초기 일행 아리크스·레스다·소피아). 루트 = 9장 후 진로선택 메뉴. 1장이 원작 대화·일행 사용
다음: E4 승패 조건 (124e:d4a7 전투 중 트리거 함수 = 유닛 HP 0 검사, 그 주변에서 승리/패배 판정 찾기) + 능력치 번호 5~12
그 다음: 5단계 스토리 분석 (plan.md S1·S2) — scenes.json + dialogue.json 으로 장별 흐름 정리 가능
실행: `pnpm start` / `pnpm dev` (포트 5173) / `pnpm run setup`. 데이터 재생성 `pnpm assets`. 대화 확인 `python tools/script.py list|flow|gaps`. 개발 모드 window.__game.S
