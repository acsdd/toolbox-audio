# Security

AudioWave bundles its first-party ArtistWave UI and serves it locally under its established HTTPS origin. Third-party widgets are not supported.

- The main renderer is sandboxed, context-isolated and has no Node integration.
- Narrow IPC methods support Google sign-in, Navidrome and Plex. Calls require the main frame, expected origin/path and main window.
- Google authorization uses the system browser, PKCE, random state and a temporary loopback callback. Access tokens stay in memory.
- Navidrome authentication material and Plex server tokens are encrypted with Windows safeStorage. Plex account tokens are discarded after selecting the configured server.
- Renderer media URLs carry connection/media identifiers; native proxies add credentials and preserve Range requests for seeking. Disconnect removes stored connection credentials.
- Desktop OAuth build configuration is excluded from Git. Installed-app client credentials are distributed in the package and cannot be treated as confidential.
- Ordinary HTTP(S) links open in the system browser. Arbitrary widget code and broad filesystem/process bridges are not exposed.
- The shell sends no telemetry. Selected providers receive the requests needed for their features.

Mini shares the existing playback session through its first-party parent frame. Outside code must never receive that same-origin access. See [widget review requirements](docs/WIDGETS.md).

Report security issues privately to the maintainers with reproduction steps and the affected version.
