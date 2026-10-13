# 현재 상태 (덮어쓰기로 갱신)
단계: 5단계 S1~S3 완료 (2026-10-13). 개선판 대본 43장 + 숨은 장 44·45, 동료 한마디·에필로그·진엔딩, 장 지도·다른 길로·도감 (replay-design.md 구현 절)
다음: 6단계 — U1 원작 UI·진행 방식 분석 (plan.md) 또는 시스템 (경험치·레벨업 DS 표 추출 → 숨은 장 난이도도 그 뒤 재확인, 마법·상태 이상, 30장 '악마 두 배' 규칙)
실행: `pnpm dev` (5173) / `?ed=remake&stage=N&route=R&party=1,2,…&items=` 정비 화면부터 (계속 → 여행계속 '결정'). 숨은 장 = 장 지도 (progress.endings [0,1,2] 필요). window.__game.{S,camp,checkEnd,…}. 점검 `tools/ecs_check.py`, 초안 `tools/ecs_draft.py`, 맵 `tools/map_ascii.py 맵 [기록|x 배치.json]`
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로, `while(!window.__game)` 로 부팅 기다림. 대화 넘기기 = #dialogue click. 유닛 hp·위치를 바꾸고 __game.checkEnd(). 맵 스프라이트는 유닛 0~103 만. localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
