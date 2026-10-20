# 현재 상태 (덮어쓰기로 갱신)
브랜치: `main-remaining` (main 에서, 작업 트리 `.claude/worktrees/main-remaining` — 원래 폴더는 다른 세션의 story-rework). 커밋 전
최근 (2026-10-17~20): main 남은 일 순서대로 — ① 배경음악 (formats.md "배경음악": FMT 50곡, 원작 드라이버 33da 이식 fmDriver.ts + OPL2 흉내 opl2.ts, AudioWorklet) ② 창세 프롤로그·엔딩 영상 (movie.ts, "프롤로그·엔딩") ③ 숨은 보물 줍기 ("숨은 보물 줍기"). 검증: verify_browser 43장 두 판, verify_cuts 8·17·21·37·40장 오류 0
다음: 투사체 그림 (0x1e2e/0x1e30) → 마법 직업 물리 공격 (무기 f2 = 0) → 원작 마법 창 (ECPMAG)·시전자 MAG 동작 → 효과음 잔여 (레벨업·전직·전투 보상 알림) → 9장 원작판 선택지 UI·정비 화면 나머지. B1 은 사용자가 풀면
막힌 점: 음악은 귀로 원작과 대조 못 함 (DOSBox 녹음 필요). 손으로 끝까지 깨 보기·캠페인 연속 진행은 자동 검증 밖. 컷신 흰/검정 효과는 브라우저 창을 보이게 둬야 확인됨. iOS·안드로이드 실기기 효과음·음악·터치 미확인
실행·테스트: 작업 트리에서는 pnpm 이 node_modules (원래 폴더로 링크) 를 다시 깔려다 실패 → `node node_modules/vite/bin/vite.js --port 5213`, 검사 `./node_modules/.bin/tsc --noEmit`. `?ed=remake&stage=N&route=R&party=…&items=…&nocamp` (dev 에서만).
  자동 검증: `python tools/verify.py --plan` 뒤 `await import('/tools/verify_browser.js')`, 컷신 `/tools/verify_cuts.js`. 음악 굽기 `node tools/music_render.mjs N [초]` → build/music/NN.wav. 창은 정적 파일 (/assets/data/labels.json) 로 두고 iframe 으로
