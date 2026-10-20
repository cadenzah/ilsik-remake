// OPL2 (YM3812) FM 음원 흉내 — 배경음악용 (formats.md "배경음악"). 칩 본래 속도 49716 Hz 로 한 표본씩 만든다.
// 포락선 속도표는 MAME fmopl (Jarek Burczynski), 위상·로그사인·지수표·KSL·떨림(트레몰로·비브라토)·리듬 위상은 Nuked OPL3 를 따랐다.
// 다른 모듈을 가져오지 않는다 (AudioWorklet 과 node 시험 도구에서 그대로 쓰려고)

export const OPL_RATE = 49716

const MT = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 20, 24, 24, 30, 30]   // 배율 ×2
const KSL_ROM = [0, 32, 40, 45, 48, 51, 53, 55, 56, 58, 59, 60, 61, 62, 63, 64]
const KSL_SHIFT = [8, 1, 2, 0]
/** 레지스터 칸 (0x20+n 의 n) → 연산자 번호. 없는 칸 = -1 */
const REG_SLOT = [0, 1, 2, 3, 4, 5, -1, -1, 6, 7, 8, 9, 10, 11, -1, -1, 12, 13, 14, 15, 16, 17, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
/** 채널 → (모듈레이터, 캐리어) 연산자 번호 */
const CH_SLOT = [0, 1, 2, 6, 7, 8, 12, 13, 14].map(m => [m, m + 3])
const SLOT_CH = Array.from({ length: 18 }, (_, k) => CH_SLOT.findIndex(p => p.includes(k)))

const LOGSIN = new Uint16Array(256), EXP = new Uint16Array(256)
for (let i = 0; i < 256; i++) {
  LOGSIN[i] = Math.round(-Math.log2(Math.sin((i + 0.5) * Math.PI / 512)) * 256)
  EXP[i] = Math.round(Math.pow(2, (255 - i) / 256) * 1024)
}
function calcExp(level: number) {
  if (level > 0x1fff) level = 0x1fff
  return (EXP[level & 0xff] << 1) >> (level >> 8)
}
/** 파형 4가지 (사인·반사인·절댓값 사인·¼ 사인 펄스). phase = 10비트, env = 감쇠 (0.1875 dB 단위, 0..511) */
function wave(wf: number, phase: number, env: number) {
  phase &= 0x3ff
  const e = env << 3
  switch (wf) {
    case 0: {
      const out = calcExp((phase & 0x100 ? LOGSIN[(phase & 0xff) ^ 0xff] : LOGSIN[phase & 0xff]) + e)
      return phase & 0x200 ? ~out : out
    }
    case 1:
      if (phase & 0x200) return 0
      return calcExp((phase & 0x100 ? LOGSIN[(phase & 0xff) ^ 0xff] : LOGSIN[phase & 0xff]) + e)
    case 2:
      return calcExp((phase & 0x100 ? LOGSIN[(phase & 0xff) ^ 0xff] : LOGSIN[phase & 0xff]) + e)
    default:
      if (phase & 0x100) return 0
      return calcExp(LOGSIN[phase & 0xff] + e)
  }
}

// 포락선 속도 (MAME fmopl eg_inc · eg_rate_select · eg_rate_shift). 표 칸 = 16 + 속도 (0..63) + 16
const EG_INC = [
  0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 4, 4, 2, 4, 4, 4,
  4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0,
]
const EG_SEL = new Uint8Array(96), EG_SH = new Uint8Array(96)
for (let i = 0; i < 96; i++) {
  const r = i - 16
  if (r < 0) { EG_SEL[i] = 14 * 8; EG_SH[i] = 0 }
  else if (r < 52) { EG_SEL[i] = (r & 3) * 8; EG_SH[i] = 12 - (r >> 2) }
  else if (r < 60) { EG_SEL[i] = (4 + (r - 52)) * 8; EG_SH[i] = 0 }
  else { EG_SEL[i] = 12 * 8; EG_SH[i] = 0 }
}
const MAX_ATT = 511
const Eg = { Off: 0, Rel: 1, Sus: 2, Dec: 3, Att: 4 } as const

class Slot {
  // 레지스터 값
  am = 0; vib = 0; egt = 0; ksr = 0; mult = 0; ksl = 0; tl = 0; ar = 0; dr = 0; sl = 0; rr = 0; wf = 0
  // 상태
  phase = 0; inc = 0; phaseOut = 0
  vol = MAX_ATT; state: number = Eg.Off; key = 0
  kslAdd = 0; ksrIdx = 0
  out = 0; prout = 0; fbmod = 0
}

class Channel {
  fnum = 0; block = 0; kon = 0; fb = 0; cnt = 0
}

export class Opl2 {
  private s = Array.from({ length: 18 }, () => new Slot())
  private c = Array.from({ length: 9 }, () => new Channel())
  private wse = false; private nts = 0; private rhy = 0
  private egCnt = 0; private timer = 0
  private tremPos = 0; private trem = 0; private vibPos = 0
  private noise = 1

  write(reg: number, v: number) {
    reg &= 0xff; v &= 0xff
    const lo = reg & 0x1f
    switch (reg & 0xe0) {
      case 0x00:
        if (reg === 0x01) this.wse = !!(v & 0x20)
        else if (reg === 0x08) this.nts = (v >> 6) & 1
        return
      case 0x20: { const k = REG_SLOT[lo]; if (k < 0) return; const s = this.s[k]
        s.am = v >> 7; s.vib = (v >> 6) & 1; s.egt = (v >> 5) & 1; s.ksr = (v >> 4) & 1; s.mult = v & 15; this.slotFreq(k); return }
      case 0x40: { const k = REG_SLOT[lo]; if (k < 0) return; const s = this.s[k]
        s.ksl = v >> 6; s.tl = v & 0x3f; this.slotFreq(k); return }
      case 0x60: { const k = REG_SLOT[lo]; if (k < 0) return; const s = this.s[k]
        s.ar = v >> 4; s.dr = v & 15; return }
      case 0x80: { const k = REG_SLOT[lo]; if (k < 0) return; const s = this.s[k]
        s.sl = v >> 4 === 15 ? 31 : v >> 4; s.rr = v & 15; return }
      case 0xe0: { const k = REG_SLOT[lo]; if (k < 0) return
        this.s[k].wf = this.wse ? v & 3 : 0; return }
      case 0xa0: {
        if (reg === 0xbd) { this.rhythm(v); return }
        const n = reg & 0x0f
        if (n > 8) return
        const ch = this.c[n]
        if (reg & 0x10) {   // B0
          ch.fnum = (ch.fnum & 0xff) | ((v & 3) << 8); ch.block = (v >> 2) & 7
          const kon = (v >> 5) & 1
          if (kon !== ch.kon) { ch.kon = kon; for (const k of CH_SLOT[n]) kon ? this.keyOn(k, 1) : this.keyOff(k, 1) }
        } else ch.fnum = (ch.fnum & 0x300) | v
        for (const k of CH_SLOT[n]) this.slotFreq(k)
        return
      }
      case 0xc0: {
        if (lo > 8) return
        this.c[lo].fb = (v >> 1) & 7; this.c[lo].cnt = v & 1
        return
      }
    }
  }

  private dam = 0; private dvb = 0
  private rhythm(v: number) {
    this.dam = v >> 7; this.dvb = (v >> 6) & 1
    const was = this.rhy
    this.rhy = v & 0x3f
    if (this.rhy & 0x20) {
      // BD 12·15, SD 16, TT 14, CY 17, HH 13
      const keys: [number, number][] = [[0x10, 12], [0x10, 15], [0x08, 16], [0x04, 14], [0x02, 17], [0x01, 13]]
      for (const [b, k] of keys) (v & b) ? this.keyOn(k, 2) : this.keyOff(k, 2)
    } else if (was & 0x20) for (const k of [12, 13, 14, 15, 16, 17]) this.keyOff(k, 2)
  }

  private slotFreq(k: number) {
    const s = this.s[k], ch = this.c[SLOT_CH[k]]
    const ksv = (ch.block << 1) | ((ch.fnum >> (9 - this.nts)) & 1)
    s.ksrIdx = s.ksr ? ksv : ksv >> 2
    let ksl = (KSL_ROM[ch.fnum >> 6] << 2) - ((8 - ch.block) << 5)
    if (ksl < 0) ksl = 0
    s.kslAdd = ksl >> KSL_SHIFT[s.ksl]
  }

  private keyOn(k: number, bit: number) {
    const s = this.s[k]
    if (!s.key) { s.phase = 0; s.state = Eg.Att }
    s.key |= bit
  }
  private keyOff(k: number, bit: number) {
    const s = this.s[k]
    if (!s.key) return
    s.key &= ~bit
    if (!s.key && s.state > Eg.Rel) s.state = Eg.Rel
  }

  private rate(r: number, s: Slot) { return r ? 16 + (r << 2) + s.ksrIdx : 0 }

  private envelope(s: Slot) {
    const cnt = this.egCnt
    switch (s.state) {
      case Eg.Att: {
        const i = this.rate(s.ar, s), sh = EG_SH[i]
        // 속도 62 이상은 즉시 (MAME)
        if (i >= 16 + 62) { s.vol = 0; s.state = Eg.Dec; break }
        if (!(cnt & ((1 << sh) - 1))) {
          s.vol += ((~s.vol) * EG_INC[EG_SEL[i] + ((cnt >> sh) & 7)]) >> 3
          if (s.vol <= 0) { s.vol = 0; s.state = Eg.Dec }
        }
        break
      }
      case Eg.Dec: {
        const i = this.rate(s.dr, s), sh = EG_SH[i]
        if (!(cnt & ((1 << sh) - 1))) {
          s.vol += EG_INC[EG_SEL[i] + ((cnt >> sh) & 7)]
          if (s.vol >= s.sl << 4) s.state = Eg.Sus
        }
        break
      }
      case Eg.Sus:
        if (s.egt) break
      // 지속형이 아니면 해제 속도로 계속 줄어든다
      // falls through
      case Eg.Rel: {
        const i = this.rate(s.rr, s), sh = EG_SH[i]
        if (!(cnt & ((1 << sh) - 1))) {
          s.vol += EG_INC[EG_SEL[i] + ((cnt >> sh) & 7)]
          if (s.vol >= MAX_ATT) { s.vol = MAX_ATT; if (s.state === Eg.Rel) s.state = Eg.Off }
        }
        break
      }
    }
  }

  private phaseStep(k: number) {
    const s = this.s[k], ch = this.c[SLOT_CH[k]]
    let f = ch.fnum
    if (s.vib) {
      let range = (f >> 7) & 7
      const vp = this.vibPos
      if (!(vp & 3)) range = 0
      else if (vp & 1) range >>= 1
      range >>= this.dvb ? 0 : 1
      if (vp & 4) range = -range
      f += range
    }
    const inc = (((f << ch.block) >> 1) * MT[s.mult]) >> 1
    s.phase = (s.phase + inc) & 0x7ffff
    s.phaseOut = s.phase >> 9
  }

  private egOut(s: Slot) {
    const v = s.vol + (s.tl << 2) + s.kslAdd + (s.am ? this.trem : 0)
    return v > 0x1ff ? 0x1ff : v
  }

  private op(s: Slot, mod: number) {
    s.out = wave(s.wf, s.phaseOut + mod, this.egOut(s))
    return s.out
  }

  /** 표본 하나 (부호 있는 16비트 범위) */
  sample() {
    // 떨림 위치 (Nuked: 트레몰로 64 표본, 비브라토 1024 표본마다)
    if ((this.timer & 0x3f) === 0x3f) {
      this.tremPos = (this.tremPos + 1) % 210
      const t = this.tremPos < 105 ? this.tremPos : 210 - this.tremPos
      this.trem = t >> (this.dam ? 2 : 4)
    }
    if ((this.timer & 0x3ff) === 0x3ff) this.vibPos = (this.vibPos + 1) & 7
    this.timer = (this.timer + 1) & 0xffff
    this.egCnt++

    for (let k = 0; k < 18; k++) { this.envelope(this.s[k]); this.phaseStep(k) }
    const n = this.noise, bit = ((n >> 14) ^ n) & 1
    this.noise = (n >> 1) | (bit << 22)

    const rhy = this.rhy & 0x20
    if (rhy) {
      const hh = this.s[13], sd = this.s[16], tc = this.s[17]
      const p13 = hh.phaseOut, p17 = tc.phaseOut
      const b2 = (p13 >> 2) & 1, b3 = (p13 >> 3) & 1, b7 = (p13 >> 7) & 1, b8 = (p13 >> 8) & 1
      const t3 = (p17 >> 3) & 1, t5 = (p17 >> 5) & 1
      const x = (b2 ^ b7) | (b3 ^ t5) | (t3 ^ t5), nz = this.noise & 1
      hh.phaseOut = (x << 9) | ((x ^ nz) ? 0xd0 : 0x34)
      sd.phaseOut = (b8 << 9) | ((b8 ^ nz) << 8)
      tc.phaseOut = (x << 9) | 0x80
    }

    let acc = 0
    const nch = rhy ? 6 : 9
    for (let c = 0; c < nch; c++) acc += this.channel(c)
    if (rhy) {
      // BD = 채널 6 캐리어만 (CNT 1 이면 모듈레이터 없이)
      const ch = this.c[6], m = this.s[12]
      m.fbmod = ch.fb ? (m.prout + m.out) >> (9 - ch.fb) : 0
      m.prout = m.out
      const mo = this.op(m, m.fbmod)
      acc += this.op(this.s[15], ch.cnt ? 0 : mo) * 2
      acc += (this.op(this.s[13], 0) + this.op(this.s[16], 0)) * 2
      acc += (this.op(this.s[14], 0) + this.op(this.s[17], 0)) * 2
    }
    return acc > 32767 ? 32767 : acc < -32768 ? -32768 : acc
  }

  private channel(c: number) {
    const ch = this.c[c], m = this.s[CH_SLOT[c][0]], car = this.s[CH_SLOT[c][1]]
    m.fbmod = ch.fb ? (m.prout + m.out) >> (9 - ch.fb) : 0
    m.prout = m.out
    const mo = this.op(m, m.fbmod)
    const co = this.op(car, ch.cnt ? 0 : mo)
    return ch.cnt ? mo + co : co
  }
}
