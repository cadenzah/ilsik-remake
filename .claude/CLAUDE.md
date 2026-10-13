# eclipse-web

1996 SKC소프트랜드 「일식(Eclipse)」(대만산 SRPG, DOS) 를 웹으로 리메이크. Claude가 전 과정을 단독 수행.

## 세션 시작 시
1. `.claude/docs/status.md` 만 먼저 읽는다 (현재 단계·다음 작업·막힌 점).
2. 필요한 문서만 골라 읽는다 — 전부 읽지 말 것:
   - `docs/plan.md` 전체 로드맵·작업 목록
   - `docs/formats.md` 원작 파일 포맷 (이미 밝혀진 것 재분석 금지)
   - `docs/assets.md` 어떤 원작 파일에 무엇이 들어 있는지
   - `docs/rules.md` 게임 규칙 (근사/확정 구분)
   - `docs/ux.md` 원작 UI·조작·진행 틀과 웹판 차이
3. 작업을 마치면 `status.md` 를 갱신한다 (짧게, 덮어쓰기). 새로 밝힌 사실은 해당 문서에 추가.

## 디렉토리
- `original/` 원작 파일 (ISO 추출, gitignore) — 출처 ISO 경로는 `.env` 의 `ECLIPSE_ISO`
- `tools/` 추출·분석 스크립트 (Python, `.venv/bin/python` 사용)
- `build/` 추출 산출물 (gitignore, `tools/extract_all.py` 로 재생성)
- `src/`, `public/` 웹 게임 (Vite + TypeScript + Canvas 2D), 패키지 매니저 pnpm
- 환경마다 다른 값(경로 등)은 하드코딩하지 말고 `.env` 에 둔다 (`.env.example` 에 키 추가, `.env` 는 gitignore)
- `scripts/setup.mjs` 로컬 준비 (ISO 추출 → .venv → build/ → public/assets/), `pnpm run setup`

## 토큰 절약 규칙
- 바이너리를 xxd 로 길게 덤프하지 않는다. `tools/` 에 요약 출력 스크립트를 만들고 결과만 본다.
- 이미지 확인은 축소 몽타주 1장으로 (`tools/montage.py`). 개별 PNG를 여러 장 열지 않는다.
- `build/` 산출물은 `build/catalog.json` 요약만 본다.
- 넓은 탐색은 Explore 서브에이전트에 맡기고 결론만 받는다.
- 명령 출력은 `| head`, `| tail` 로 제한한다.

## 규칙
- 원작 데이터·추출물은 커밋 금지 (.gitignore 참고). 코드와 문서만 커밋.
- 한국어 텍스트 원본 인코딩은 CP949.
