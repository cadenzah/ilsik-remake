// 배경음악 한 곡을 웹과 같은 코드 (src/core/opl2.ts · fmDriver.ts) 로 WAV 로 굽는다 — 소리 확인·음량 점검용 (node 23.6+ 가 .ts 를 바로 읽음).
// 사용: node tools/music_render.mjs N [초=30] [출력=build/music/NN.wav]   → 끝에 최대·RMS 를 찍는다
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Opl2, OPL_RATE } from '../src/core/opl2.ts'
import { FmDriver, IRQ_HZ } from '../src/core/fmDriver.ts'

const n = +(process.argv[2] ?? 0), sec = +(process.argv[3] ?? 30)
const out = process.argv[4] ?? `build/music/${String(n).padStart(2, '0')}.wav`
const cmf = readFileSync(`public/assets/music/${String(n).padStart(2, '0')}.cmf`)
const opl = new Opl2(), drv = new FmDriver((r, v) => opl.write(r, v))
drv.play(new Uint8Array(cmf))
const len = Math.floor(sec * OPL_RATE), pcm = new Int16Array(len)
const per = OPL_RATE / IRQ_HZ
let next = 0, peak = 0, sq = 0
const t0 = performance.now()
for (let i = 0; i < len; i++) {
  while (i >= next) { drv.irq(); next += per }
  const s = opl.sample()
  pcm[i] = s; peak = Math.max(peak, Math.abs(s)); sq += s * s
}
const ms = performance.now() - t0
const hdr = Buffer.alloc(44)
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + len * 2, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16)
hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(OPL_RATE, 24); hdr.writeUInt32LE(OPL_RATE * 2, 28)
hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(len * 2, 40)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, Buffer.concat([hdr, Buffer.from(pcm.buffer)]))
console.log(out, `${sec}s`, 'peak', peak, 'rms', Math.round(Math.sqrt(sq / len)), `render ${Math.round(ms)}ms (${(sec * 1000 / ms).toFixed(1)}× 실시간)`)
