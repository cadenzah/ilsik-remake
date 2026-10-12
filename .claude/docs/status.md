# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계 원작판/개선판 구조. 다음 = V1 엔진 분리 (설계 editions.md "V1 엔진 분리 설계")
결정: 런타임 판 선택, 원작판 = 원작 그대로 (편의 기능은 개선판만), 개선판 데이터 content/remake/ 커밋, 각색 = 장면 재구성까지, 대사 = 현대어, 진엔딩 구조 긍정
결정: S2 제안 15개 전부 반영 (개선판만, plan.md S3a~c), "다른 길로" 이어받기 = 장비·도감만
원작 순서 키 HP% = 정수 HP×100 div 최대HP 확인, 0aa2:0e17 = k 0~8 전투 수치 함수 (formats.md, 원작판 공식 역분석 출발점)
실행: `pnpm dev` (5173) / `pnpm assets` / `python tools/story.py [script N|stats|routes]` / `?stage=N&route=R`. 개발 모드 window.__game.{S,checkEnd,planFor}
