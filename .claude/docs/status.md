# 현재 상태 (덮어쓰기로 갱신)
단계: 3단계 데이터 표 분석. D1~D3 완료 (마법·장비·유닛 장비/마법 목록, formats.md)
다음: D4 `tools/export_web.py` 에서 magic.json·items.json 출력, units.json 에 equip·magic·can_magic 추가 → 게임 쪽에서 사용
그 다음: 4단계 EXE 역분석 (Ghidra, 배치·대화 트리거·능력치 번호 5~12 확정) → 5단계 스토리 분석 (plan.md S1·S2)
실행: `npm run dev` (포트 5173). 개발 모드 window.__game 으로 상태 접근. git 기본 브랜치 main
