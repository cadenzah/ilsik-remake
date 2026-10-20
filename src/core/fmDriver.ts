// 원작 음악 드라이버 (ECP.EXE 세그먼트 33da, FM 쪽 처리기 표 cs:0x8c0) 를 옮긴 CMF 순서기 — formats.md "배경음악".
// 다른 모듈을 가져오지 않는다 (AudioWorklet 과 node 시험 도구에서 그대로 쓰려고). OPL 레지스터 쓰기는 생성자에 넘긴 함수로.
// 원작 그대로인 것: 타이머 291.3 Hz (PIT 0x1000) 에 틱마다 3434 µs 를 깎는 박자 · 빈 OPL 채널 0~5 (리듬이 꺼지면 0~8) 에 차례로 배정 (빈 칸이 없으면 버린다) ·
// 노트마다 악기 전체를 다시 쓰고 캐리어 음량을 셈여림 표로 · 리듬 모드 채널 11~15 = BD·SD·TT·CY·HH · 피치 벤드·음량 컨트롤러·애프터터치는 무시 · 끝나면 처음부터 반복

/** 노트 → B0·A0 값 (cs:0xf59, 상위 = 블록·fnum 위 2비트, 하위 = fnum 아래 8비트) */
const FNUM = [343, 363, 385, 408, 432, 458, 485, 514, 544, 577, 611, 647]
const FREQ = Array.from({ length: 128 }, (_, n) => n >= 120 ? 0x1e87 : (Math.min(7, Math.max(0, Math.floor(n / 12) - 1)) << 10) | FNUM[n % 12])
/** 채널 → 모듈레이터·캐리어 레지스터 칸 (cs:0xf43) */
const OPS = [[0x00, 0x03], [0x01, 0x04], [0x02, 0x05], [0x08, 0x0b], [0x09, 0x0c], [0x0a, 0x0d], [0x10, 0x13], [0x11, 0x14], [0x12, 0x15]]
/** 셈여림 곱 (0..31) → 캐리어 TL. 0x10fa = CMF, 0x113a = MIDI 파일, 0x111a = 타악기 */
const TL_CMF = [63, 23, 22, 22, 21, 21, 20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
const TL_MID = [63, 17, 17, 16, 16, 16, 15, 15, 15, 14, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 6, 5, 4, 3, 2, 1, 0]
const TL_DRUM = [63, 11, 11, 10, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0]
/** 악기 음량 (0x3f − TL) → 곱하기 전 값 (cs:0x115a) */
const LEVEL = [0, 35, 35, 35, 36, 36, 36, 37, 37, 37, 38, 38, 38, 39, 39, 39, 40, 40, 40, 41, 41, 41, 42, 42, 42, 43, 43, 43, 44, 44, 44, 45,
  45, 45, 46, 46, 46, 47, 47, 47, 48, 48, 49, 49, 50, 50, 51, 51, 52, 52, 53, 53, 54, 54, 55, 55, 56, 57, 58, 59, 60, 61, 62, 63]
/** GM 타악기 노트 35~54 → 리듬 비트 (cs:0x1059) */
const DRUM_BIT = [16, 16, 0, 8, 0, 8, 4, 0, 4, 1, 4, 1, 4, 4, 2, 4, 2, 0, 0, 0]
/** 리듬 채널 11~15 → GM 노트 (cs:0x119b) */
const DRUM_NOTE = [36, 38, 41, 49, 44]
/** 타악기 악기 바꾸기 때 쓰는 레지스터 11칸 (cs:0x10af, 0 = 건너뜀). 순서 BD SD TT CY HH */
const DRUM_REGS = [
  [0x30, 0x33, 0x50, 0x53, 0x70, 0x73, 0x90, 0x93, 0xf0, 0xf3, 0xc6],
  [0x34, 0, 0x54, 0, 0x74, 0, 0x94, 0, 0xf4, 0, 0xc7],
  [0x32, 0, 0x52, 0, 0x72, 0, 0x92, 0, 0xf2, 0, 0xc8],
  [0x35, 0, 0x55, 0, 0x75, 0, 0x95, 0, 0xf5, 0, 0xc8],
  [0x31, 0, 0x51, 0, 0x71, 0, 0x91, 0, 0xf1, 0, 0xc7],
]
/** 리듬 비트 → (TL 레지스터, 채널, 타악기 칸) (14e5) */
const DRUM_OUT: Record<number, [number, number, number]> = { 0x10: [0x53, 6, 0], 0x08: [0x54, 7, 1], 0x02: [0x55, 8, 3], 0x04: [0x52, 8, 2], 0x01: [0x51, 7, 4] }

export const IRQ_HZ = 1193182 / 4096
const IRQ_US = 0xd6a

export class FmDriver {
  private c: Uint8Array = new Uint8Array(0)
  private bank = new Uint8Array(16 * 11)
  private patch = new Array<number>(16).fill(0)      // MIDI 채널 → 악기 (0x8f3)
  private drumPatch = new Array<number>(5).fill(0)   // 0x106e
  private voice = new Array<number>(9).fill(0)       // OPL 채널 → (노트 << 8 | MIDI 채널), 0 = 빔 (0x10e8)
  private f119a = 0; private f55 = 0xe0; private f56 = 0; private f57 = 0
  private us = 0           // MIDI 틱 하나의 µs (0x292)
  private tpq = 1          // 0x28e
  private p = 0; private run = 0; private counter = 0; private done = true
  playing = false

  private w: (reg: number, v: number) => void

  constructor(write: (reg: number, v: number) => void) {
    const w = this.w = write
    // 12d0 → 15d3: 칩 초기화
    w(0x01, 0x20); w(0xbd, 0); w(0x08, 0)
    for (let i = 0; i < 9; i++) w(0xa0 + i, 0)
    for (let i = 0; i < 9; i++) w(0xb0 + i, 0)
  }

  /** CMF 바이트로 재생 시작 (0x432 → 0x4c7) */
  play(cmf: Uint8Array) {
    if (this.playing) this.stop()
    this.c = cmf
    this.start()
  }

  private start() {
    const c = this.c, u16 = (o: number) => c[o] | (c[o + 1] << 8)
    if (u16(0) !== 0x5443 || u16(2) !== 0x464d) { this.playing = false; return }
    this.tpq = u16(0x0a)
    this.us = Math.floor(Math.floor(Math.floor(1000000 / this.tpq) * 60) / u16(0x26)) & 0xffff
    const ins = u16(6), n = u16(0x24)
    for (let k = 0; k < n && k < 16; k++) this.bank.set(c.subarray(ins + 16 * k, ins + 16 * k + 11), 11 * k)
    this.controller(0, 0x67, 0)   // cs:0x384 「B0 67 00」
    this.p = u16(8); this.run = 0; this.done = false
    this.counter = this.delta()
    this.playing = true
  }

  /** 멈춤 (0x56d): 16채널 모두 「B0 7B 00」 */
  stop() {
    for (let ch = 0; ch < 16; ch++) this.controller(ch, 0x7b, 0)
    this.playing = false; this.done = true
  }

  /** 타이머 한 번 (0x38a → 0x654) */
  irq() {
    if (!this.playing) return
    if (this.done) { this.start(); if (!this.playing) return }   // 끝난 다음 틱에 처음부터 (0x3a0, 반복 수 0/-1 = 사실상 무한)
    for (;;) {
      this.counter -= IRQ_US
      if (this.counter >= 0) return
      if (!this.event()) { this.done = true; return }
      this.counter = this.delta()
    }
  }

  private vlq() {
    let v = 0
    for (;;) { const x = this.c[this.p++]; v = (v << 7) | (x & 0x7f); if (x < 0x80) return v }
  }

  private delta() { return Math.min(this.vlq(), 0xffff) * this.us }

  /** 사건 하나. false = 곡 끝 */
  private event(): boolean {
    const c = this.c
    let st = c[this.p]
    if (st >= 0xf0) {
      this.p++
      if (st === 0xff) {
        const ty = c[this.p++], ln = c[this.p++]
        if (ty === 0x2f) return false
        if (ty === 0x51) this.us = Math.floor(((c[this.p] << 16) | (c[this.p + 1] << 8) | c[this.p + 2]) / this.tpq) & 0xffff
        this.p += ln
      } else if (st === 0xf0 || st === 0xf7) this.p += Math.min(this.vlq(), 0xffff)
      else if (st === 0xf1 || st === 0xf3) this.p++
      else if (st === 0xf2) this.p += 2
      return true
    }
    if (st & 0x80) { this.run = st; this.p++ } else st = this.run
    const ch = st & 15
    switch (st & 0xf0) {
      case 0x80: this.note(ch, c[this.p], 0); this.p += 2; break
      case 0x90: this.note(ch, c[this.p], c[this.p + 1]); this.p += 2; break
      case 0xa0: case 0xe0: this.p += 2; break
      case 0xb0: this.controller(ch, c[this.p], c[this.p + 1]); this.p += 2; break
      case 0xc0: this.program(ch, c[this.p]); this.p += 1; break
      case 0xd0: this.p += 1; break
    }
    return true
  }

  private controller(ch: number, n: number, v: number) {
    if (n >= 0x7b && n <= 0x7f) {
      this.notesOff(ch)
      if (ch === 15) { this.f55 = 0xe0; this.w(0xbd, 0); this.f119a = 0 }   // 121f (기본 악기 묶음 복사는 곧 CMF 악기로 덮이므로 생략)
    } else if (n === 0x40) {
      if (!v) this.notesOff(ch)
    } else if (n === 0x67) {
      if (v !== 0x7f) this.f119a = v | 0x80
      this.f55 = 0xc0 | (v & 1 ? 0x20 : 0)
      // 1600: 리듬 레지스터를 비운다. 깊은 떨림 (0xc0) 은 첫 타악기 노트 때 BD 에 같이 써진다
      this.f56 = this.f55; this.w(0xbd, 0); this.w(0x08, 0)
    }
  }

  private notesOff(ch: number) {
    for (let i = 0; i < 6; i++) {
      if ((this.voice[i] & 0xff) !== ch) continue
      const k = this.voice[i]; this.voice[i] = 0
      this.keyOff(i, k >> 8)
    }
  }

  private program(ch: number, n: number) {
    if ((this.f119a & 1) && ch >= 11) {
      // 1470: 타악기는 바로 레지스터에. 모듈레이터 쪽 바이트만, CNT 는 BD 말고는 1
      const slot = ch - 11, r = DRUM_REGS[slot], p = 11 * (n & 15)
      this.drumPatch[slot] = p
      for (let i = 0; i < 10; i++) if (r[i]) this.w(r[i], this.bank[p + i])
      this.w(r[10], this.bank[p + 10] | (slot ? 1 : 0))
    } else this.patch[ch] = 11 * (n & 15)
  }

  private find(key: number) {
    const n = this.f55 & 0x20 ? 6 : 9
    for (let i = 0; i < n; i++) if (this.voice[i] === key) return i
    return -1
  }

  private keyOff(i: number, note: number) { this.w(0xb0 + i, (FREQ[note] >> 8) & 0x1f) }

  private note(ch: number, note: number, vel: number) {
    const v = ((128 * vel) << 1) >> 8 & 0xff   // (음량 0x7f + 1) × 셈여림 × 2 의 윗바이트
    if (!(this.f119a & 0x80)) {
      if (ch === 9) this.drum(note, v)
      if (ch >= 9) return
    } else if ((this.f119a & 1) && ch >= 11) {
      this.f57 = FREQ[note]
      this.drum(DRUM_NOTE[ch - 11], v)
      return
    }
    const key = (note << 8) | ch
    let i = this.find(key)
    if (!v) { if (i >= 0) { this.voice[i] = 0; this.keyOff(i, note) } return }
    if (i >= 0) { this.voice[i] = 0; this.keyOff(i, note) }
    i = this.find(0)
    if (i < 0) return
    this.voice[i] = key
    this.f57 = FREQ[note]
    this.instrument(i, this.patch[ch], v)
    this.w(0xa0 + i, this.f57 & 0xff)
    this.w(0xb0 + i, (this.f57 >> 8) | 0x20)
  }

  /** 13ea: 악기 11바이트를 채널에, 캐리어 TL 은 셈여림으로 */
  private instrument(i: number, p: number, v: number) {
    const b = this.bank, [m, c] = OPS[i]
    this.w(0x20 + m, b[p]); this.w(0x20 + c, b[p + 1]); this.w(0x40 + m, b[p + 2])
    const tl = (this.f119a & 0x80 ? TL_CMF : TL_MID)[(LEVEL[(b[p + 3] & 0x3f) ^ 0x3f] * v) >> 8]
    this.w(0x40 + c, tl | (b[p + 3] & 0xc0))
    this.w(0x60 + m, b[p + 4]); this.w(0x60 + c, b[p + 5]); this.w(0x80 + m, b[p + 6]); this.w(0x80 + c, b[p + 7])
    this.w(0xe0 + m, b[p + 8]); this.w(0xe0 + c, b[p + 9]); this.w(0xc0 + i, b[p + 10])
  }

  /** 14a5: 리듬 비트 켜기·끄기 */
  private drum(gm: number, v: number) {
    if (gm < 0x23 || gm >= 0x37) return
    const bit = DRUM_BIT[gm - 0x23]
    if (!bit) return
    if (v) {
      if (this.f56 & bit) { this.f56 &= ~bit; this.w(0xbd, this.f56) }
      this.f56 |= bit
      const [reg, ch, slot] = DRUM_OUT[bit], p = this.drumPatch[slot], b = this.bank
      this.w(reg, TL_DRUM[(LEVEL[(b[p + 3] & 0x3f) ^ 0x3f] * v) >> 8] | (b[p + 3] & 0xc0))
      if (this.f119a & 0x80) { this.w(0xa0 + ch, this.f57 & 0xff); this.w(0xb0 + ch, this.f57 >> 8) }
    } else this.f56 &= ~bit
    this.w(0xbd, this.f56)
  }
}
