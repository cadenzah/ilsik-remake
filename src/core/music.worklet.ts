// 배경음악 AudioWorklet: 원작 드라이버 (fmDriver) 가 OPL2 흉내 (opl2) 에 레지스터를 쓰고, 칩 속도 49716 Hz 표본을 출력 속도로 (선형 보간) 바꾼다.
// 메시지: { cmf: ArrayBuffer } = 처음부터 재생 (끝나면 반복), { stop: true } = 멈춤 (울리던 소리는 해제 꼬리까지)
import { FmDriver, IRQ_HZ } from './fmDriver'
import { OPL_RATE, Opl2 } from './opl2'

declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor { readonly port: MessagePort }

const TAIL = 3   // 멈춘 뒤 이만큼 (초) 더 만들고 쉰다

class MusicProcessor extends AudioWorkletProcessor {
  private opl = new Opl2()
  private drv = new FmDriver((r, v) => this.opl.write(r, v))
  private step = OPL_RATE / sampleRate
  private per = OPL_RATE / IRQ_HZ
  private t = 0; private next = 0; private frac = 0; private prev = 0; private cur = 0
  private idle = 0

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<{ cmf?: ArrayBuffer; stop?: boolean }>) => {
      if (e.data.cmf) { this.drv.play(new Uint8Array(e.data.cmf)); this.idle = 0 }
      else if (e.data.stop) this.drv.stop()
    }
  }

  private chip() {
    while (this.t >= this.next) { this.drv.irq(); this.next += this.per }
    this.t++
    this.prev = this.cur
    this.cur = this.opl.sample() / 32768
  }

  process(_in: Float32Array[][], outs: Float32Array[][]) {
    const out = outs[0], a = out[0]
    if (!this.drv.playing && this.idle > TAIL * sampleRate) return true   // 출력 버퍼는 0 으로 채워져 온다
    for (let i = 0; i < a.length; i++) {
      this.frac += this.step
      while (this.frac >= 1) { this.frac -= 1; this.chip() }
      a[i] = this.prev + (this.cur - this.prev) * this.frac
    }
    for (let k = 1; k < out.length; k++) out[k].set(a)
    this.idle = this.drv.playing ? 0 : this.idle + a.length
    return true
  }
}

registerProcessor('eclipse-music', MusicProcessor)
