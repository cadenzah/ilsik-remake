# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계 원작판/개선판 구조. V1 엔진 분리 완료 (editions.md "V1 엔진 분리 — 완료"). `?ed=original|remake` (기본 개선판)
다음 후보: (가) 타이틀 메뉴 = 판 선택·새로 시작·크레딧 (editions.md 작업 순서 4) / (나) 원작판 전투 공식 역분석 (0aa2:0e17 k 1~8, formats.md) / (다) S3 개선판 대본 형식 설계 (plan.md S3)
결정: 런타임 판 선택, 원작판 = 원작 그대로 (편의 기능은 개선판만), 개선판 데이터 content/remake/ 커밋, 각색 = 장면 재구성까지, 대사 = 현대어, 진엔딩 구조 긍정
결정: S2 제안 15개 전부 반영 (개선판만, plan.md S3a~c), "다른 길로" 이어받기 = 장비·도감만
실행: `pnpm dev` (5173) / `pnpm assets` / `python tools/story.py [script N|stats|routes]` / `?ed=original&stage=N&route=R`. 개발 모드 window.__game.{S,checkEnd,planFor,reachable,toScreen}
테스트: 브라우저 패널이 숨겨지면 rAF 정지 → 로드 직후 rAF 를 setTimeout 으로 바꿔 자동 진행 (editions.md)
