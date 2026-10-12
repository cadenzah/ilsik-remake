# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계. 장 사이 연결 완료 (campaign.ts PARTY/ITEMS/FLAGS → 진행 저장, formats.md "장 사이 연결 검증"). 인트로 소리 스위치 커밋
다음 후보: (가) 원작판 전투 공식 역분석 (0aa2:0e17 k 1~8) / (나) 명령 아이콘·원작 명령창 그림 (ECPCOM/BUT) / (다) S3 개선판 대본 형식 / (라) 출전 선택 (일행 > 8, 원작 화면 분석) · 보물 줍기
결정: 런타임 판 선택, 원작판 = 원작 그대로 (편의 기능은 개선판만), 개선판 데이터 content/remake/ 커밋, 각색 = 장면 재구성까지, 대사 = 현대어. S2 제안 15개 반영 (개선판만), "다른 길로" = 장비·도감만
실행: `pnpm dev` (5173) / `pnpm assets` / `export_web.py data|ui` / `?ed=original&stage=N&route=R` = 타이틀 건너뜀 (캠페인 밖: 초기 일행 + npc19). window.__game.{S,camp,checkEnd,planFor,reachable,toScreen}
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로. 대화 넘기기 = window keydown Escape. 저장 localStorage eclipse.* (테스트 전 기존 값 백업·뒤에 지울 것)
