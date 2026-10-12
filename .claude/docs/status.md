# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계. S3a·S3b 완료, S3c 중 8 동료 한마디(banter.ecs)·14 고대 병기 회수·15 에필로그(epilogue.ecs) 완료 (script-format.md 4·10절)
다음: S3c 6 다시 하기·진엔딩 — 설계안 `replay-design.md` 사용자 확인 대기 (숨은 장 구성 / 루트 정보 나누기 / 도감 / 장 지도 공개 범위). 확인 뒤 그 문서의 구현 순서대로
그 뒤 후보: 6단계 U1 원작 UI 분석 / 경험치·레벨업 (DS 표 추출) / 마법·상태 이상 / 30장 '악마 두 배' 규칙
실행: `pnpm dev` (5173) / `?ed=remake&stage=N&route=R&party=1,2,…&items=` 정비 화면부터 (계속 → 여행계속 '결정' 클릭). window.__game.{S,camp,checkEnd,…}. 점검 `tools/ecs_check.py`, 초안 `tools/ecs_draft.py`
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로, `while(!window.__game)` 로 부팅 기다림. 대화 넘기기 = #dialogue click. 유닛 hp 를 바꾸고 __game.checkEnd() 로 troop·hp·dead·한마디 시험. localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
