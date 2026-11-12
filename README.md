# ArtistWave (toolbox-audio)

A standalone Windows player for the Toolbox suite. ArtistWave is a thin native
Electron shell around the existing **ArtistWave web app** — it loads the remote
player full-window and adds native mini-player window management, always-on-top,
uninterrupted audio and safe external-link handling. It was extracted from
Toolbox desktop so the desktop app carries no audio.

There is no local player source: the library, queue, YouTube and Studio features
all live in the remote web app. This repository owns only the native wrapper.

## Toolbox suite

| App | Repo | Role |
| --- | --- | --- |
| Toolbox desktop | `toolbox-desktop` | Local-first Windows toolset (no audio) |
| ArtistWave | `toolbox-audio` | Standalone player shell (this app) |
| Model Farm panel | `toolbox-mcp` | Local MCP server + ops panel |
| Toolbox NAS | `toolbox-nas` | NAS companion |
| Model Farm CLI | `LLamaFarm_Cli_P1` | Command-line model farm |
| Shared widgets | `toolbox-widgets` | Public MIT core shared by the apps |

## Requirements

- Windows 10/11 x64
- Node.js 22+ (for development and packaging)
- Network access — the player loads `https://acsdd.github.io/ArtistWave/`.
  There is **no offline mode**; the remote page must be reachable.

## Run

```bash
npm install
npm start
```

`npm start` compiles the core and launches the shell.

## Test

```bash
npm test          # unit tests for the pure logic in src/core.ts
npm run smoke     # end-to-end smoke against the live remote page
```

The smoke test boots the real shell, waits for the player, and asserts:
top-level load (the app is not framed), no preload bridge, sandbox enabled,
volume command applies, the mini player shrinks the window and stays on top,
closing the fallback restores the window, and foreign popups are denied.

## Package

```bash
npm run portable
```

Builds `dist/ArtistWave-Portable-<version>.exe` locally. The packer stages the
app outside the workspace and reuses the sibling `../quoder` Electron toolchain
(`electronDist`) to avoid re-downloading Electron. Pass an alternate toolchain or
output directory as arguments if needed:

```bash
node scripts/pack-portable.mjs [toolchain-dir] [output-dir]
```

CI builds both the NSIS installer (`ArtistWave-Setup-<version>.exe`) and the
portable EXE on a `v*` tag — see `.github/workflows/release.yml`.

## Architecture

- **Main-process only.** `scripts/desktop.cjs` is the whole app: one
  `BrowserWindow` that loads the remote URL top-level. There is no React
  renderer and no preload bridge.
- **Pure logic** lives in `src/core.ts` (URL matching, probe parsing, mini-window
  bounds, snapshot normalization) and is unit-tested.
- **Sandboxed:** `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`. The remote page never sees Node or any local API.
- **Audio keeps playing** when the window is backgrounded
  (`backgroundThrottling: false`, `autoplayPolicy: 'no-user-gesture-required'`).
- **Mini player:** the web app's mini-player popup is intercepted and the window
  shrinks to a compact always-on-top panel; closing the fallback restores it.
- **Navigation guard:** only the app origin may load in-window; `http(s)` links
  open in the system browser; every other popup is denied.

## Privacy

The shell handles no credentials, no vault data and no telemetry. It only loads
the public remote player and manages the native window. See [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).