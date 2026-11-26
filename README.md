# AudioWave

**Status:** `external_UAT` — released for acceptance testing outside the team. ![status](https://img.shields.io/badge/status-external_UAT-9cf37e?style=flat-square)

**Previously published:** [AudioWave 0.2.0](https://github.com/acsdd/toolbox-audio/releases/tag/v0.2.0) — [Setup](https://github.com/acsdd/toolbox-audio/releases/download/v0.2.0/AudioWave-Setup-0.2.0.exe) · [Portable](https://github.com/acsdd/toolbox-audio/releases/download/v0.2.0/AudioWave-Portable-0.2.0.exe) · [SHA256SUMS.txt](https://github.com/acsdd/toolbox-audio/releases/download/v0.2.0/SHA256SUMS.txt). The current source is **1.0.1**; a source version does not by itself imply that a matching GitHub release is published.

**Site:** <https://acsdd.github.io/toolbox-audio/> — The project landing page.

AudioWave is a self-contained Windows music player with a bundled ArtistWave interface, local-file playlists, online discovery, and optional Navidrome and Plex libraries. The current source bundles ArtistWave **3.4**. See [release notes](CHANGELOG.md).

## Use

Run the portable EXE or install the Windows x64 setup package. End users do not need Node.js or other runtimes. Internet access is needed for online sources and sign-in; NAS playback needs connectivity to your server.

Under **Local music**, choose Navidrome or Plex. Navidrome accepts your server URL and account credentials. Plex opens your browser for account authorization and then offers the server's music libraries. Browse albums, search, play tracks and save them to playlists.

Choose **Appearance → Audio output** to select speakers or headphones for the main player, Mini player, and Showdance. The choice is saved on this device; if it is disconnected, the player falls back to the system default and restores it when available. YouTube's embedded player uses its own output settings.

The player's Mini button switches the same playback session into a full-height, 380px window at the right screen edge. The visible pin button toggles always-on-top. Select saved playlists directly in Mini; Full restores the previous window. The optional first-party widget manager controls the menu shortcut. No third-party plugins are supported.

## Development

Requires Node.js 22+ on Windows for the desktop checks and packaging.

```sh
npm ci
npm start
npm run typecheck
npm test
npm run smoke
```

Copy `config/google-oauth.example.json` to `config/google-oauth.json` and supply a Google Desktop OAuth client's configuration for real sign-in. This file is ignored by Git and bundled at packaging time. Tests use injected fixtures. Installed-app credentials can be extracted from a distributed executable; they are not a confidential server credential.

The committed `artistwave/` snapshot is the runtime UI. After updating the sibling ArtistWave checkout, run `npm run sync:artistwave` and commit the refreshed snapshot. A deployed website update is not needed for desktop UI changes.

## Packaging

```sh
npm run portable
# Optional installed toolchain and new output folder:
node scripts/pack-portable.mjs . dist/release-1.0.1
```

The package includes Electron, application code, ArtistWave and desktop OAuth configuration. It refuses to overwrite an existing portable EXE. Previous build artifacts are excluded.

The `v*` tag workflow builds an installer and portable EXE, generates SHA256 checksums, and creates a **draft** GitHub release. Configure the repository Actions secret `GOOGLE_DESKTOP_OAUTH_JSON` with the same JSON before triggering a release build. Windows previews are currently unsigned.

## Security and privacy

The player is sandboxed with context isolation and no Node integration. Narrow, main-frame-validated bridges expose Google sign-in and library operations. Google tokens stay in memory; NAS connection credentials are encrypted with Windows safeStorage. Native handlers attach credentials to media requests so playlist URLs contain only opaque connection/media IDs. Disconnect forgets the saved connection.

The bundled UI uses the existing ArtistWave HTTPS origin to preserve local library storage. The shell sends no telemetry. Chosen providers receive requests required for playback and account features. See [SECURITY.md](SECURITY.md), [verification](docs/VERIFICATION.md), and [widget boundaries](docs/WIDGETS.md).

## License

MIT — see [LICENSE](LICENSE).
