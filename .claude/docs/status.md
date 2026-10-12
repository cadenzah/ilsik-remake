# 현재 상태 (덮어쓰기로 갱신)
단계: 4단계 E4 + D2 마무리. 장비 능력치 번호 0~16 확정 (1 생명 2 정신 3 역량 4 방어 5 마법 6 이동 7 민첩 8 체력, 9~16 감소), PAD 필드 이름 정정 (+30 역량, +34 방어, +42 정신, +46 민첩), 마법 효과 0~15 이름 확정, MAD 'mp' = 피로 증가량(원작 MP 없음). 웹 능력치 = PAD + 장비 보정
다음: 부대 상태 0~3 의미(AI 분기) → 37장 숨은 부대 출현 조건 → 5단계 스토리 분석 (plan.md S1·S2, scenes.json + dialogue.json)
실행: `pnpm start` / `pnpm dev` (5173) / `pnpm run setup`. 데이터 `pnpm assets`. 조건 `python tools/cond.py [stage|check]`. 표 `python tools/tables.py [magic|items]`. 개발 모드 window.__game.{S,checkEnd}
