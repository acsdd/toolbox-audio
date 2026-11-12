# Security

ArtistWave (`toolbox-audio`) is a local-only native shell around the public
ArtistWave web app. It is designed to expose as little as possible to the remote
page.

## What the shell does

- Loads `https://acsdd.github.io/ArtistWave/` in a single sandboxed window.
- Manages the native window (mini-player sizing, always-on-top, restore).
- Opens `http(s)` links in the system browser; denies every other popup.
- Keeps audio playing when the window is backgrounded.

## What the shell does not do

- **No credentials.** It never reads, stores or forwards vault entries, API keys,
  tokens or passwords. The remote page receives no local secrets.
- **No Node in the page.** `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`, and no preload bridge. The page cannot reach the file
  system, child processes or any local API.
- **No telemetry.** Nothing is collected or sent anywhere by the shell.
- **No arbitrary navigation.** In-window navigation is restricted to the app
  origin; foreign origins are blocked or handed to the system browser.

## Trust boundary

The player UI and all playback logic are owned by the remote web app, not this
repository. The shell trusts that page only as far as the sandbox allows: it can
render and play audio, but it cannot escape the renderer or touch local data.

## Reporting a vulnerability

Please report security issues privately to the maintainers rather than opening a
public issue. Include reproduction steps and the affected version.