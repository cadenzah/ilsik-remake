// pnpm start: 로컬 준비(setup.mjs) 후 Vite 개발 서버를 연다.
// 인자는 Vite 에 그대로 넘긴다. 같은 네트워크의 다른 기기에서 접속하려면 --host
//   pnpm start --host            # 모든 인터페이스 (Network 주소가 출력된다)
//   pnpm start --host 192.168.0.5 --port 8080
// --force 는 setup.mjs 에 넘겨 추출·생성을 다시 한다.
import { spawn, execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
// pnpm start -- --host 처럼 붙는 '--' 는 Vite 가 옵션 끝으로 보므로 걸러낸다
const args = process.argv.slice(2).filter((a) => a !== '--')
const force = args.includes('--force')
const viteArgs = args.filter((a) => a !== '--force')

execFileSync(process.execPath, [join(ROOT, 'scripts', 'setup.mjs'), ...(force ? ['--force'] : [])],
  { cwd: ROOT, stdio: 'inherit' })

const vite = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--open', ...viteArgs],
  { cwd: ROOT, stdio: 'inherit' })
vite.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
