# 자원 지도 (원작 파일 → 내용)

형식: `파일` 장수 × 크기 — 내용 (확인 여부)

- `ECPnn.ECP` (01~43) 2~3 × 640×480 — 스테이지 타일셋 + 마지막은 미니맵 (확인)
- `ECLIPSE.LML` — 43개 스테이지 맵 배치 (확인)
- `ECLIPSE.BAD` — 스테이지별 출전 칸·적·NPC 배치, 보물·보상 (확인, formats.md)
- `ECLIPSE.FNT` — 대사 440줄 (확인)
- `ECLIPSE1/2.PAD` — 유닛 종류 111종 표, `ECLIPSE.MAD` 마법 74종, `ECLIPSE.EAD` 장비 182종 (확인)
- `ECPPLANE.ECP` — 0 제작진 크레딧, 1 발행 정보 화면 (원작 게임종료 때 1번) (확인)
- `MAIN.ECP` 메인 메뉴 버튼·돌 창틀, `ECPCOM/BUT/BAS/MAI/LEV/MAG/SPE.ECP` 창틀·명령 아이콘 (FRTWND/FRTBTN, formats.md) (확인)
- `ECLIPSE.UND` / `ECLIPSE1.UND` / `ECLIPSE2.UND` 1240 / 808 / 505 × 640×480 — 첫 항목들이 ECP01.ECP와 동일. 용도 미확인
- `ECLIPSE.POR` 111 × 96×111 — 인물 초상화 (확인)
- `ECLIPSE.MAG` 11 × 640×480 — 마법 이펙트 시트 (확정, formats.md "마법 이펙트 ECLIPSE.MAG"): 444프레임 56×96, 마법 id 마다 6프레임
- `ECLIPSE.SHA` 104 × 56×48 — 유닛 정지 아이콘 (확인)
- `ECLIPSE.EQU` 182 × 48×56 — 장비 아이콘 추정
- `ECLIPSE.INS` 57 × 48×48 — 도구 아이콘 추정
- `ECPMAG.MRK` 92 × 32×40 — 마법 아이콘 추정
- `ECLIPSE.SCR` 87 — 0~42 장소 이름표, **43 대륙 지도 640×480**, 44~86 장 제목 띠 (확인, formats.md "대륙 지도")
- `ECLIPSE.STA` 17 — 전투 UI 부품 (확인, ux.md): 0 커서 날개 지팡이, 1 차례 유닛 모서리 괄호, 2 공격 대상 틀, 3 십자 범위 틀, 5 범위 밖 디더, 6·7 상태 아이콘, 8 ⟺ 커서, 11 빨간 X, 12 Level Up, 13·14·15 진영 표시 (일행·NPC·적)
- `ECLIPSE.OTH` 9 — 0·1 상태 아이콘, 3 Level Up, 4 「GO!! GO!!」 전투 시작 그림, 5 양피지 지도 아이콘, 7·8 전투 장면 스크린샷 (설명 화면 추정)
- `ECLIPSE.MAR` 11 — 7·8 도구 아이콘, 9 마법 아이콘 (formats.md)
- `ECLIPSE.WIN` 3, `ECLIPSE.BS` 3, `ECLIPSE.780` 14 × 640×480 — WIN·BS 는 정비 화면 (formats.md), 780 = 「SKC 구락부」 제작진 캐리커처 소개 (여는 곳 미확인)
- `ECPnn.MOV/FIG/MAG` (00~10) — 유닛 종류별 이동/공격/마법 애니메이션 (확인, formats.md)
- `ECLIPSE1/2.SLI` 5 × 568×99 — 슬라이드/컷인 추정
- `ECPFINAL.ECP` 28 × 62×64
- `ECPMARK.MAR` 2 × 640×480 — 0 = 타이틀 돌판 로고 「日蝕 Eclipse」+ 발행 문구, 1 = 두루마리 읽는 노인 (확인)
- `ECPTIT.FAT` 12MB — 원작 타이틀 애니메이션 추정 (FAT 형식 미분석)

## 웹 자원 (`tools/export_web.py` → public/assets/, gitignore)
- `stages/NN.png` 타일 아틀라스 (11열, 56×48), `stages/NN.json` {w,h,tiles,layer2,layer3,atlasCols}
- `units/III.png` 이동 13프레임 가로띠 (56×48, 투명 처리) — 유닛 0~103
- `portraits/NNN.png` 초상화 96×111
- `ui/` 메인 메뉴: mark0·mark1 (ECPMARK.MAR 0·1), staff·publish (ECPPLANE.ECP 0·1), menu-frame (MAIN.ECP face 9조각 합본), thunder.wav (ECPMARK.FVT 1). `export_web.py ui` 로 따로 생성
- `ui/battle-ui.png` + `.json` 전투 화면 UI 조각 묶음 (skin.ts, `export_web.py battle-ui`): FRTWND 9조각 `mw.*` (ECPMAI mapwin 전투 창틀), `comma.*`, `speak.*`, `basic.*`, `level.*`, `magic.*`,
  `btn.0~5` (ECPBUT 0005 글자 버튼, 3~5 눌림), `icon.N.S` (ECPBUT 000N 아이콘), `sta.N` (STA 0·1·2·3·5·12·13·14·15), `oth.N` (OTH 3·4·5). 팔레트 = WIN 2
- `ui/` 정비 화면 (camp.ts): camp-bg (ECPMAI tactics 창틀 + WIN 2), camp-status (WIN 1), camp-face·camp-mini (BS 1·2, 칸 = 유닛 0~28), equip (EQU 182, 칸 = 품목 id−1), camp-por (POR 투명 배경, 12열), magic-icons (MAR 9, 칸 = MAD id), status-icons (OTH 0·1). `export_web.py ui` 에 포함 (magic/status 아이콘은 `icons`)
- `ui/camp-setting.png`·`camp-quit.png` 개선판 원작 모양 정비 화면 「설정」 버튼 46×25 (웹 보탬, 원래 종료 칸에) 과 한 칸 아래로 옮긴 종료 (원작 그림 그대로). 설정 = 원작 「음악」 버튼 글자를 지운 바탕 + 원작 글꼴 '설정' (흰 획 + 오른쪽 그림자, 원작 버튼 글자 여백에 맞춤). `export_web.py ui` (export_camp)
- `ui/promote.png` 애슬 전직 장면 (ECLIPSE1.FAT 11, 112×85 × 38프레임, 10열). `export_web.py promote`
- `ui/magic-fx.png` 마법 이펙트 아틀라스 (ECLIPSE.MAG 444프레임, 56×96 칸 24열, 칸 = 프레임 번호 = 마법 id×6+단계). `export_web.py magic-fx`
- `ui/worldmap.png` 대륙 지도 (SCR 43), `ui/places.png` 장소 이름표 시트, `data/worldmap.json` 장마다 {name, x, y, w, h, sy} — 장 사이 지도(worldmap.ts)·개선판 장 지도
- `data/dialogue.json` 대사 440줄 배열, `data/units.json` 유닛 111종 능력치 + equip[무기,방어구,도구 EAD id]·canMagic·magic[MAD id] (PAD1 기준)
- `data/items.json` 장비·도구 182종 {id,cat,sub,name,f1~f3,stat,stat2}, `data/magic.json` 마법 74종 (필드는 formats.md)
- 데이터만 다시 만들기: `.venv/bin/python tools/export_web.py data`
- 효과음: `sfx/e1` (ECLIPSE1.FVT 112) · `sfx/e2` (ECLIPSE2.FVT 74, 마법 id) · `sfx/ani` (ECPANI.FVT 15) — `export_web.py sfx`. 번호 뜻은 formats.md "효과음 호출부"
- `FULLSOFT.FNT` — 한글 16×15 · 영문 8×15 비트맵 글꼴, KS 완성형 (formats.md). 웹 글꼴 `ui/eclipse-font.woff`, 설정 '원작 글꼴'
