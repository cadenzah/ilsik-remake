# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계. 정비 화면 원작 재현 (src/core/camp.ts), 두 판 모두 전투마다. 화면 전환 페이드 (fade.ts, 400ms 검은 막 — 원작 팔레트 페이드 시간은 미측정): 타이틀→, 정비→전투, 장→장, 다시 하기, 타이틀로
다음: 후보 중 고르기. 정비 화면 남은 것 = 도구 버리기·넘기기(휴지통·사람↑↓), 장비 바꾸기, 원작 비트맵 글꼴(FULLSOFT.FNT?) — 지금 글자는 시스템 글꼴
그 뒤 후보: (가) 원작판 전투 공식 (0aa2:0e17) / (나) 명령 아이콘·명령창 그림 / (다) S3 개선판 대본 형식 / (라) 정비 화면 나머지 (도구 버리기·장비 바꾸기) · 보물 줍기
결정: 런타임 판 선택, 원작판 = 원작 그대로 (편의 기능은 개선판만), 개선판 데이터 content/remake/ 커밋, 각색 = 장면 재구성까지, 대사 = 현대어. S2 제안 15개 반영 (개선판만), "다른 길로" = 장비·도감만
실행: `pnpm dev` (5173) / `pnpm assets` / `export_web.py data|ui|icons` / `?ed=original&stage=N&route=R` = 타이틀 건너뜀 (캠페인 밖: 초기 일행 + npc19, 정비 화면 없음). `&party=0,18,27&items=..` 붙이면 그 일행으로 정비 화면부터 (dev 서버는 새 public 파일을 캐시해 안 보일 수 있음 → 강력 새로고침). window.__game.{S,camp,checkEnd,planFor,reachable,toScreen}
원작 대조: `tools/dosbox.py launch|shot|click X Y --shot N` (게임 좌표, .env DOSBOX_DIR, Claude 앱 손쉬운 사용·화면 기록 권한). 메뉴 '지난흔적'(535,75) = 세이브 → 정비 화면. 기록(저장) 누르지 말 것 (사용자 세이브)
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로. 대화 넘기기 = window keydown Escape. 저장 localStorage eclipse.* (테스트 전 기존 값 백업·뒤에 지울 것)
