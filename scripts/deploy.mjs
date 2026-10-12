// pages.dev 배포: 원작 자원 확인 → 빌드 → dist 직접 업로드 (wrangler).
// public/assets 는 gitignore 라 Cloudflare 의 Git 연동 빌드로는 게임이 뜨지 않는다. 반드시 로컬에서 올린다.
// 프로젝트 이름은 .env 의 CF_PAGES_PROJECT. --dry 는 빌드·검사만 한다.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'))
const dry = process.argv.includes('--dry')
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })
const fail = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1) }

// src/data.ts 가 시작 시 읽는 파일들
const REQUIRED = ['units', 'items', 'magic', 'dialogue', 'battles', 'scenes'].map(n => `assets/data/${n}.json`)
  .concat(['assets/stages/01.json', 'assets/stages/01.png'])

const missing = (dir) => REQUIRED.filter(f => !existsSync(join(ROOT, dir, f)))

if (missing('public').length) {
  fail(`public/ 에 원작 자원이 없습니다: ${missing('public').join(', ')}\n  pnpm run setup 으로 먼저 생성하세요.`)
}

console.log('\n▶ 빌드')
run('pnpm', ['run', 'build'])
if (missing('dist').length) fail(`dist/ 에 자원이 빠졌습니다: ${missing('dist').join(', ')}`)

if (dry) {
  console.log('\n빌드 확인 완료 (--dry). pnpm preview 로 확인할 수 있습니다.')
  process.exit(0)
}

const project = process.env.CF_PAGES_PROJECT
if (!project) fail('.env 의 CF_PAGES_PROJECT 에 Cloudflare Pages 프로젝트 이름을 지정하세요 (.env.example 참고).')

console.log(`\n▶ Cloudflare Pages 업로드 → ${project}`)
run('pnpm', ['dlx', 'wrangler@4', 'pages', 'deploy', 'dist', '--project-name', project, '--branch', 'main'])
