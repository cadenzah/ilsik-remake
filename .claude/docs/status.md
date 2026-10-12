# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계 원작판/개선판 구조. V1 엔진 분리·타이틀 메뉴 완료 (editions.md). 타이틀 → 판 선택·새로 시작·이어하기·장 선택·크레딧, 승리 후 다음 장·9장 진로 선택
다음 후보: (가) 원작판 전투 공식 역분석 (0aa2:0e17 k 1~8, formats.md) / (나) S3 개선판 대본 형식 설계 (plan.md S3) / (다) 장 사이 연결 (합류·이탈·소지품, scenes.json post) — 지금은 다음 장도 처음 일행
결정: 런타임 판 선택, 원작판 = 원작 그대로 (편의 기능은 개선판만), 개선판 데이터 content/remake/ 커밋, 각색 = 장면 재구성까지, 대사 = 현대어. S2 제안 15개 반영 (개선판만), "다른 길로" = 장비·도감만
실행: `pnpm dev` (5173) / `pnpm assets` / `export_web.py ui` (타이틀 그림) / `python tools/story.py [script N|stats|routes]` / `?ed=original&stage=N&route=R` 이면 타이틀 건너뜀. 개발 모드 window.__game.{S,checkEnd,planFor,reachable,toScreen}
테스트: 브라우저 패널이 숨겨지면 rAF 정지 → 로드 직후 rAF 를 setTimeout 으로 바꿔 자동 진행. 저장은 localStorage eclipse.* (테스트 뒤 지울 것)
