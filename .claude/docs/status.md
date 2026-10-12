# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계. 장 사이 연결 + 출전 선택 완료 (formats.md "정비 화면·출전 선택", 124e:8994). 인트로 소리: 토글은 저장만, 자동 재생 막히면 입력 안내 뒤 연출
다음 (진행 중): 출전 선택 화면을 원작 정비 화면처럼 다시 만들기 — 사용자: "너무 간소화, 원작 느낌 최대한". 지금 ui.ts pickDeploy 는 임시 HTML. 그리기 목록은 분석 완료 (formats.md "정비 화면" 그리기 목록) → ECLIPSE.WIN 2·1, BS 0~2, STA 11, MAR 7·8, EQU, ECPMAI tactics 를 export_web.py ui 로 뽑아 640×480 확대 화면으로 재현 (title.ts 방식). WIN/BS/STA/MAR/EQU 포맷은 frt.py 로 읽히는지 먼저 확인
그 뒤 후보: (가) 원작판 전투 공식 (0aa2:0e17) / (나) 명령 아이콘·명령창 그림 / (다) S3 개선판 대본 형식 / (라) 정비 화면 나머지 (소지품·장비·저장) · 보물 줍기
결정: 런타임 판 선택, 원작판 = 원작 그대로 (편의 기능은 개선판만), 개선판 데이터 content/remake/ 커밋, 각색 = 장면 재구성까지, 대사 = 현대어. S2 제안 15개 반영 (개선판만), "다른 길로" = 장비·도감만
실행: `pnpm dev` (5173) / `pnpm assets` / `export_web.py data|ui` / `?ed=original&stage=N&route=R` = 타이틀 건너뜀 (캠페인 밖: 초기 일행 + npc19). window.__game.{S,camp,checkEnd,planFor,reachable,toScreen}
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로. 대화 넘기기 = window keydown Escape. 저장 localStorage eclipse.* (테스트 전 기존 값 백업·뒤에 지울 것)
