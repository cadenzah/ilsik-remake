# 현재 상태 (덮어쓰기로 갱신)
단계: 3단계 완료. D4 로 units/items/magic.json 출력, 게임은 loadTables() 로 읽어 유닛 카드에 장비·마법 표시 (전투 수치엔 미반영 — 6단계)
다음: 4단계 E1 Ghidra 설치·ECP.EXE 로드 → E2 배치(TroopsData)·능력치 번호 5~12 확정
그 다음: E3~E4 대화 트리거·승패 조건 → 5단계 스토리 분석 (plan.md S1·S2)
실행: `npm run dev` (포트 5173). 개발 모드 window.__game.S (S.tables 포함). git 기본 브랜치 main
