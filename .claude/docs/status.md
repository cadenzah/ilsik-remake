# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계 원작판/개선판 구조. 타이틀 = 원작 메인 메뉴 재현 (124e:e404). 휴식 회복·원작판 명령창 흐름 확정·반영 (formats.md "전투 명령 흐름")
다음 후보: (가) 원작판 전투 공식 역분석 (0aa2:0e17 k 1~8) / (나) 명령 아이콘 5개 뜻 대응·원작 명령창 그림 (ECPCOM/BUT) / (다) S3 개선판 대본 형식 설계 / (라) 장 사이 연결 (합류·소지품)
결정: 런타임 판 선택, 원작판 = 원작 그대로 (편의 기능은 개선판만), 개선판 데이터 content/remake/ 커밋, 각색 = 장면 재구성까지, 대사 = 현대어. S2 제안 15개 반영 (개선판만), "다른 길로" = 장비·도감만
실행: `pnpm dev` (5173) / `pnpm assets` / `export_web.py ui` / `tools/frtwnd.py list|png` (UI 조각) / `?ed=original&stage=N&route=R` 이면 타이틀 건너뜀. window.__game.{S,checkEnd,planFor,reachable,toScreen}
테스트: 패널 숨김 시 rAF 정지 → requestAnimationFrame 을 setTimeout 으로 바꿔 진행. 저장 localStorage eclipse.* (테스트 뒤 지울 것). 숨은 패널에선 img.decode() 가 안 끝남 → load 이벤트 사용
