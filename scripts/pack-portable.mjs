/* Local portable build using this project's installed Electron tools.
 * Usage: node scripts/pack-portable.mjs [toolchain-dir] [output-dir]
 */
import { constants } from 'node:fs'
import { copyFile, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const toolchain = resolve(process.argv[2] ?? root)
const output = resolve(process.argv[3] ?? join(root, 'dist'))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const electron = JSON.parse(await readFile(join(toolchain, 'node_modules/electron/package.json'), 'utf8'))

function run(script, args, cwd = root) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${script} exited with code ${result.status}`)
}

run(join(root, 'node_modules/typescript/bin/tsc'), ['-p', join(root, 'tsconfig.json')])

const stage = await mkdtemp(join(tmpdir(), 'audiowave-portable-'))
const appDir = join(stage, 'app')
const buildDir = join(stage, 'release')
await mkdir(join(appDir, 'scripts'), { recursive: true })
await mkdir(join(appDir, 'dist'), { recursive: true })
await copyFile(join(root, 'dist/core.js'), join(appDir, 'dist/core.js'))
await mkdir(join(appDir, 'config'), { recursive: true })
await copyFile(join(root, 'config/google-oauth.json'), join(appDir, 'config/google-oauth.json'))
await copyFile(join(root, 'scripts/desktop.cjs'), join(appDir, 'scripts/desktop.cjs'))
for (const file of ['plex.cjs', 'navidrome.cjs', 'google-auth.cjs', 'google-session.cjs', 'output-permissions.cjs', 'auth-preload.cjs', 'widget-manager-preload.cjs', 'widgets.html', 'widget-manager-ui.js', 'widgets.css']) {
  await copyFile(join(root, 'scripts', file), join(appDir, 'scripts', file))
}
await mkdir(join(appDir, 'build'), { recursive: true })
await cp(join(root, 'artistwave'), join(appDir, 'artistwave'), { recursive: true })
run(join(root, 'scripts/prepare-youtube-key.cjs'), [join(appDir, 'artistwave/youtube-bundled-config.js')])
await copyFile(join(root, 'build/icon.png'), join(appDir, 'build/icon.png'))

await writeFile(join(appDir, 'package.json'), JSON.stringify({
  name: 'toolbox-audio',
  productName: 'AudioWave',
  version: manifest.version,
  description: manifest.description,
  author: manifest.author,
  license: manifest.license,
  private: true,
  type: 'module',
  main: 'scripts/desktop.cjs',
  build: {
    appId: 'com.alpha.audiowave',
    productName: 'AudioWave',
    electronVersion: electron.version,
    electronDist: join(toolchain, 'node_modules/electron/dist'),
    npmRebuild: false,
    asar: true,
    compression: 'maximum',
    directories: { output: buildDir },
    files: ['dist/core.js', 'config/google-oauth.json', 'artistwave/**/*', 'scripts/desktop.cjs', 'scripts/plex.cjs', 'scripts/navidrome.cjs', 'scripts/google-auth.cjs', 'scripts/google-session.cjs', 'scripts/output-permissions.cjs', 'scripts/auth-preload.cjs', 'scripts/widget-manager-preload.cjs', 'scripts/widgets.html', 'scripts/widget-manager-ui.js', 'scripts/widgets.css', 'package.json'],
    win: { icon: join(appDir, 'build/icon.png'), target: [{ target: 'portable', arch: ['x64'] }] },
    portable: { artifactName: 'AudioWave-Portable-${version}.${ext}' }
  }
}, null, 2))

console.log(`PACKAGE_STAGE=${stage}`)
run(join(toolchain, 'node_modules/electron-builder/cli.js'), [
  '--projectDir', appDir, '--win', 'portable', '--x64', '--publish', 'never'
], appDir)

await mkdir(output, { recursive: true })
const artifactName = `AudioWave-Portable-${manifest.version}.exe`
await copyFile(join(buildDir, artifactName), join(output, artifactName), constants.COPYFILE_EXCL)
console.log(`PORTABLE_EXE=${join(output, artifactName)}`)
console.log(`UNPACKED_APP=${join(buildDir, 'win-unpacked')}`)
