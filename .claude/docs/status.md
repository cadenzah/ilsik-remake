# 현재 상태 (덮어쓰기로 갱신)
단계: 5.5단계. 정비 화면 도구 장착·해제·버리기 (원작 규칙, 무기·방어구 교체는 원작에 없음), 설정 메뉴 (원작 글꼴 = 모든 화면 웹 글꼴 eclipse-font.woff · 로고 효과음), 원작 전투 공식 두 판 반영 (난수 없음, 지형·피로, rules.md)
다음: K = S3 개선판 대본 형식 — 설계안 `.claude/docs/script-format.md` 사용자 확인 대기 (5절 4가지). 확인 뒤 script.ts 파서 + content/remake/ 시작 (S3a)
그 뒤 후보: 경험치·레벨업 (DS 표 0x51f·0x3c8·0x4b0·0x4cd·0x502 추출) / 마법·상태 이상 / 공격 유형 15~18 / 명령 아이콘 그림 / 보물 줍기 / 원작 전투 수치 DOSBox 대조
실행: `pnpm dev` (5173) / `?ed=original&stage=N&route=R` 타이틀 건너뜀, `&party=..&items=..` 정비 화면부터. window.__game.{S,camp,checkEnd,planFor,reachable,toScreen}. 원작 대조 `tools/dosbox.py` (기록 누르지 말 것)
테스트: 숨은 패널은 rAF 정지 → requestAnimationFrame 을 setTimeout 으로. 대화 넘기기 = keydown Escape. localStorage eclipse.* (테스트 전 백업·뒤에 지울 것)
