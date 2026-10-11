// 로컬 실행 준비: 원작 ISO 추출 → Python 환경 → 이미지 추출 → 웹 자원 생성.
// 이미 된 단계는 건너뛴다. --force 는 추출·생성을 다시 한다.
// 환경마다 다른 값(원작 ISO 경로 등)은 .env 에 둔다 (.env.example 참고). 셸 환경변수가 우선한다.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'))
const force = process.argv.includes('--force')
const py = join(ROOT, '.venv', 'bin', 'python')
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })
const step = (msg) => console.log(`\n▶ ${msg}`)

const original = join(ROOT, 'original')
if (!existsSync(join(original, 'ECP.EXE'))) {
  const iso = process.env.ECLIPSE_ISO
  if (!iso || !existsSync(iso)) {
    console.error(`${iso ? `원작 ISO 를 찾을 수 없습니다: ${iso}` : 'original/ 이 비어 있습니다.'}\n`
      + '.env 의 ECLIPSE_ISO 에 원작 ISO 경로를 지정하세요 (.env.example 참고).')
    process.exit(1)
  }
  step(`원작 ISO 추출 → original/ (${iso})`)
  mkdirSync(original, { recursive: true })
  run('tar', ['-xf', iso, '-C', original])   // macOS bsdtar 는 ISO9660 을 읽는다
}

if (!existsSync(py)) {
  step('Python 가상환경 생성 (.venv)')
  run('python3', ['-m', 'venv', '.venv'])
}
step('Python 패키지 확인')
run(py, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '-r', 'requirements.txt'])

if (force || !existsSync(join(ROOT, 'build', 'catalog.json'))) {
  step('FRT 이미지 추출 → build/')
  run(py, ['tools/extract_all.py'])
}

const assets = join(ROOT, 'public', 'assets')
if (force || !existsSync(assets) || !readdirSync(assets).length) {
  step('웹 자원 생성 → public/assets/')
  run(py, ['tools/export_web.py'])
} else {
  step('데이터 표 갱신 → public/assets/data/')
  run(py, ['tools/export_web.py', 'data'])
}
console.log('\n준비 완료. pnpm dev 로 실행하세요.')
