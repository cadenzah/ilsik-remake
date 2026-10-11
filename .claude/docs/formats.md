# 원작 파일 포맷 (확정된 것만 기록)

## FRT 이미지 컨테이너 — 확정
파일 확장자 무관. 시그니처 `FRT`(일부 `FGT`, 예: ECP03.ECP). 모든 정수 little-endian.
```
파일 헤더 (45B): "FRT" + 이름[40] ('9'로 채움) + u16 count
항목 × count:
  "FRT" + 이름[40]           43B
  u16 a (항상 1)  u8 hasPal (항상 1)  u16 w  u16 h  u32 size   11B
  팔레트 768B (hasPal==1): VGA 6비트 RGB ×256 → ×4 해서 8비트로
  픽셀 데이터 size B: PCX식 RLE — b>=0xC0 이면 (b&0x3F)회 다음 바이트 반복, 아니면 리터럴. w*h 바이트 인덱스.
```
- 항목마다 자체 팔레트가 있다. 투명색 인덱스는 미확인 (스프라이트 배경색으로 추정 필요).
- 같은 포맷이 아닌 것: `FRTWND`/`FRTBTN` 시그니처 (`ECPBAS/BUT/COM/LEV/MAG/MAI/SPE.ECP`, `MAIN.ECP`) = UI 창/버튼 정의, 구조 미분석.

## ECLIPSE.LML 스테이지 맵 — 확정 (`tools/stage.py`)
레코드 2000B × 43 (스테이지 n = 레코드 n-1).
```
+0  u16 0, u16 614, u16 타일수, u16 타일W(56), u16 타일H(48), u16 1, u16 맵W, u16 맵H
+24 원본 타일셋 파일명 ("DDT01.FGT")    +36~99 공통 상수(의미 미상)
+100           레이어1 W*H u8 : 타일 번호
+100+W*H       레이어2 W*H u8 : 0 평지 / 2 숲·바위 / 4 절벽 (추정: 장애물 등급)
+100+2*W*H     레이어3 W*H u8 : 3~6 지형 종류 (추정, 6 = 절벽·밀림)
```
타일 이미지 = `ECPnn.ECP` 의 마지막을 제외한 시트들. 시트당 11열, 타일 (1+57c, 1+49r) 위치에서 56×48 잘라냄, 시트 순서대로 번호 매김. 마지막 시트는 미니맵.

## ECLIPSE.FNT 대사 — 확정
[u16 길이][CP949 문자열] × 440. 순수 텍스트만 있음. 화자·순서·트리거는 파일에 없음 → EXE 하드코딩 추정.

## ECLIPSE1/2.PAD 유닛 종류 표 — 부분 확정
u16 개수(111) + 레코드 118B × 111. 이름 CP949 10B 는 파일 오프셋 8+i*118 (레코드 경계 정렬 미확정). 이름 뒤 u16 들은 id, 초상화 번호, 레벨·HP·MP 등 능력치 추정.
0~28 주인공 계열(일부 전직 전/후 중복), 29~91 일반 적·몬스터, 92~110 보스·NPC.

## ECLIPSE.MAD 마법 표 / ECLIPSE.EAD 장비 표 — 부분 확정
MAD: u32 개수(74) + 레코드(이름 CP949 포함). EAD: u32 개수(182) + 레코드(이름 포함). 필드 미분석.

## 미확인: 스테이지별 적·아군 초기 배치, 이벤트 스크립트
데이터 파일에서 못 찾음. EXE의 `TroopsData` 관련 코드/테이블로 추정 → 역분석 단계 과제.

## 기타 시그니처 (미분석)
- `FAT   ` : `ECPTIT.FAT`(12MB), `ECLIPSE1~3.FAT` — 애니메이션 추정 (EXE에 `fxFATImageDC`)
- `FVT` + 이름 + "Creative Voice File" : `ECLIPSE1/2.FVT`, `ECPANI.FVT`, `ECPMARK.FVT` — VOC 묶음
- `FMT2` : `ECLIPSE.FMT`
- `FULLSOFT.FNT` : 한글 비트맵 폰트 추정 (리메이크에 불필요)
- `*.SAV` : 세이브 (3791B, 사용자 실제 세이브 2개 보유)
- `ECLIPSE.BAD` 300B × 129 레코드 (52종 고유) — 전투 애니메이션 정의 추정, 미분석

## ECP.EXE
MZ 16비트, Borland C++ 1994. 사운드 Info-Sound TCSND/VOICE 드라이버. 클래스명 단서: `TroopsData`, `LxAiDecide`, `LxAiSearch`, `LxMapData`, `fxChineseDC`.
EXE가 여는 파일명 목록은 오프셋 0x5cd0c~ 근처 문자열.
