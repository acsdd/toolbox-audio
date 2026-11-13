# Security

AudioWave is a local Windows music app that hosts the first-party ArtistWave player and a small first-party widget manager. The player remains the app’s core. Third-party widgets are not supported in this version.

## What the shell does

- Loads `https://acsdd.github.io/ArtistWave/` in a sandboxed top-level window.
- Denies Mini Player popups and resizes the existing window for the embedded compact view.
- Opens ordinary HTTP(S) links in the system browser and denies other popups.
- Provides a local widget manager with a small, explicit IPC surface for the first-party catalog.

## What the shell does not do

- **No secrets in the shell.** It does not read or store API keys, passwords or tokens.
- **No Node access in the remote player.** The page uses `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, and no preload bridge.
- **No arbitrary widget code.** The manager changes a local installed-widget list; it does not fetch executable widget code.
- **No telemetry.** The shell sends no usage analytics.

## Trust boundary

The ArtistWave player is maintained separately and loaded over HTTPS. The Mini Player page is part of that same first-party site and uses its same-origin parent to read and control the existing player session. Third-party widgets would need a separate, isolated runtime with narrower capabilities; the Mini Player’s same-origin connection must never be granted to outside code.

## Reporting a vulnerability

Please report security issues privately to the maintainers rather than opening a public issue. Include reproduction steps and the affected version.