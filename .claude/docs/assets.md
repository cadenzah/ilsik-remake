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
- `ECLIPSE.MAG` 11 × 640×480 — 마법 이펙트 스프라이트 시트 (확인)
- `ECLIPSE.SHA` 104 × 56×48 — 유닛 정지 아이콘 (확인)
- `ECLIPSE.EQU` 182 × 48×56 — 장비 아이콘 추정
- `ECLIPSE.INS` 57 × 48×48 — 도구 아이콘 추정
- `ECPMAG.MRK` 92 × 32×40 — 마법 아이콘 추정
- `ECLIPSE.SCR` 87 × 가변×22 — UI 글자/버튼 이미지 추정
- `ECLIPSE.STA` 17, `ECLIPSE.OTH` 9, `ECLIPSE.MAR` 11 — UI 부품 추정
- `ECLIPSE.WIN` 3, `ECLIPSE.BS` 3, `ECLIPSE.780` 14 × 640×480 — 화면 배경 추정
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
- `data/dialogue.json` 대사 440줄 배열, `data/units.json` 유닛 111종 능력치 + equip[무기,방어구,도구 EAD id]·canMagic·magic[MAD id] (PAD1 기준)
- `data/items.json` 장비·도구 182종 {id,cat,sub,name,f1~f3,stat,stat2}, `data/magic.json` 마법 74종 (필드는 formats.md)
- 데이터만 다시 만들기: `.venv/bin/python tools/export_web.py data`
- 효과음: build/snd/ (아직 웹으로 안 옮김)
