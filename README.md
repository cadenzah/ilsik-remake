# 일식 (Eclipse) Web

1996년 국내 발매된 DOS용 SRPG 「일식(Eclipse)」(대만 개발, SKC소프트랜드 유통)을 웹 브라우저에서 즐길 수 있도록 다시 만든 **비상업 팬 게임**입니다.

> **팬 게임 고지**
> - 이 프로젝트는 원작 개발사·유통사와 아무 관계가 없는 비공식 팬 리메이크이며, 어떤 형태로도 판매하거나 수익을 얻지 않습니다.
> - 원작의 그래픽·사운드·텍스트 등 모든 콘텐츠의 권리는 원 권리자에게 있습니다.
> - 권리자께서 문제를 제기하시면 즉시 배포를 중단하겠습니다.

## 저장소에 포함된 것

이 저장소에는 **코드와 문서만** 있습니다. 원작 파일과 그로부터 추출한 자원(`original/`, `build/`, `public/assets/`)은 포함되어 있지 않으며, 원작 ISO 가 있어야 로컬에서 생성할 수 있습니다.

- `tools/` 원작 파일 포맷 분석·추출 스크립트 (Python)
- `src/` 웹 게임 (Vite + TypeScript + Canvas 2D)
- `scripts/` 로컬 준비·배포 스크립트

## 실행

Node.js 22+, pnpm, Python 3 이 필요합니다.

```bash
cp .env.example .env    # ECLIPSE_ISO 에 원작 ISO 경로 지정
pnpm install
pnpm start              # ISO 추출 → 자원 생성 → 개발 서버
```

같은 네트워크의 다른 기기(휴대폰 등)에서 접속하려면 `--host` 를 붙입니다. 터미널에 찍히는 `Network:` 주소로 접속합니다. 그 밖의 인자(`--port` 등)도 Vite 에 그대로 넘어갑니다.

```bash
pnpm start --host
```

## 배포 (Cloudflare Pages)

원작 자원이 저장소에 없으므로 Git 연동 자동 빌드로는 게임이 뜨지 않습니다. 로컬에서 빌드해 직접 올립니다.

```bash
pnpm dlx wrangler@4 login   # 처음 한 번
pnpm run deploy             # .env 의 CF_PAGES_PROJECT 로 업로드
```
