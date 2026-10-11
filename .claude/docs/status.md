# 현재 상태 (덮어쓰기로 갱신)
단계: 4단계 E1·E2 완료. 배치는 ECLIPSE.BAD (레코드=(장-1)*3+루트), 전투 순서표 EXE DS:0x204a (29전×3루트) → public/assets/data/battles.json, 1장이 원작 배치 사용
다음: E3 대화 순서·화자·트리거 (FNT 인덱스를 쓰는 코드 찾기: 2ff8:0068 캠페인 루프 주변, tools/exe.py fn) — 초기 일행·루트 결정 조건도 같이
그 다음: E4 승패 조건, 능력치 번호 5~12 → 5단계 스토리 분석 (plan.md S1·S2)
실행: `pnpm start` (준비+실행) / `pnpm dev` (포트 5173) / `pnpm run setup` 자원 준비. 데이터만 재생성 `pnpm assets`. 개발 모드 window.__game.S
