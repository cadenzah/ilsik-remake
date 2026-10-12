# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계. S3a 완료 — 개선판 대본 43장 전부 (`content/remake/chapters/NN.ecs`): 장 카드, 현대어·표기 통일, 화자 대체(`이름|출전`·`이름?`), 9장 금괴 선택지·세 갈래 길 대사, 광왕 언급. 전투 중 트리거 장면을 대본 `dead 이름`·`win` 에 연결 (script-format.md 6~8절)
다음: S3b (대사 집필) — 3 루트 구멍 (B 32장 채스 합류 사연, A 20·22장 크란 전언, C 35장), 2 보조 목표 + goal 표시 연결, 5 빈 장 도입 (21·23·24·28·30·31·34), 7 소피아, 9 아티스 복선, 12 전투 중 대사 (troop·hp 시점 연결 필요)
그 뒤 후보: 경험치·레벨업 (DS 표 추출) / 마법·상태 이상 / 공격 유형 15~18 / 원작 전투 수치 DOSBox 대조
실행: `pnpm dev` (5173) / `?ed=remake&stage=N&route=R` 타이틀 건너뜀 (일행은 기본 3명이라 화자 대체 시험은 실제 진행으로), `&party=..&items=..` 정비 화면부터. window.__game.{S,camp,checkEnd,planFor,reachable,toScreen}. 점검 `tools/ecs_check.py`. 원작 대조 `tools/dosbox.py` (기록 누르지 말 것)
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로, `while(!window.__game)` 로 부팅 기다림. 대화 넘기기 = #dialogue click (Escape 는 전체 건너뛰기). localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
