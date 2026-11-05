// 게임에 보여 줄 버전 __VERSION__ = package.json version + 빌드한 커밋. 예: v0.1.0 (d0ea457)
// version 은 주요 배포 때만 올린다 (README 배포). 그 사이 작은 배포는 커밋으로 구분한다.
// 게임 코드에 커밋 안 한 수정이 있으면 -dirty 를 붙인다 (tools/ 등 게임에 안 들어가는 수정은 빼고)
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

function commit() {
  try { return git('rev-parse --short HEAD') + (git('status --porcelain -- src content package.json') ? '-dirty' : '') }
  catch { return 'unknown' }   // git 저장소 밖에서 빌드
}

export default defineConfig({
  define: { __VERSION__: JSON.stringify(`v${version} (${commit()})`) },
})
