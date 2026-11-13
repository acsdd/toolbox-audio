# AudioWave

AudioWave is a Windows music app built around the ArtistWave player. It keeps ArtistWave’s music discovery, listening and library features intact, and adds a host for small installable widgets. The first widget is the Mini Player, which switches the existing window into a compact, always-on-top view while keeping the same playback session.

## First-party widgets

Open **Widgets → Manage Widgets…** (or press **Ctrl+Shift+W**) to install or remove the Mini Player. Its installed state is saved on this PC. The installed state controls the widget-menu shortcut. The player’s Mini button switches the existing window to 380px compact mode; Full player restores its previous size. Only one player view is visible at a time. Saved playlists can be browsed and played in Mini mode once the matching ArtistWave site update is deployed.

The first version only offers widgets maintained by the AudioWave team. It does not download or run outside widget code. Read [the widget review and safety plan](docs/WIDGETS.md) for the checks required before third-party widgets are considered.

## Requirements

- Windows 10/11 x64
- Node.js 22+ for development and packaging
- Internet access — AudioWave loads the maintained ArtistWave player at `https://acsdd.github.io/ArtistWave/`

## Run locally

```bash
npm ci
npm start
```

The app shell runs locally; the ArtistWave player and its online sources require a working network connection.

## Package

```bash
npm run portable
```

Builds `dist/AudioWave-Portable-<version>.exe`. The package script uses the Electron toolchain installed with this project. To use another installed toolchain or output folder, pass its path:

```bash
node scripts/pack-portable.mjs [toolchain-dir] [output-dir]
```

CI builds the NSIS installer (`AudioWave-Setup-<version>.exe`) and portable EXE on a `v*` tag.

## Security and privacy

- The main ArtistWave page stays in a sandboxed window with no Node integration or preload bridge.
- The local widget manager has a narrow bridge for listing, installing, removing and opening the known first-party Mini Player. It cannot read arbitrary files or run commands.
- Mini Player is served by the maintained ArtistWave site and is allowed only at its exact same-origin player path.
- The shell handles no credentials and sends no telemetry. The remote player may make the service requests needed for its chosen features.

See [SECURITY.md](SECURITY.md) and [docs/WIDGETS.md](docs/WIDGETS.md).

## License

MIT — see [LICENSE](LICENSE).