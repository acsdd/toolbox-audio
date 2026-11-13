# Current release verification

## Current source

Full and Mini now share one window. Mini requests 380px width and always-on-top; Full restores the prior bounds. Smoke assertions now check this behavior instead of expecting a second window. ArtistWave adds saved-playlist browsing and playback to its embedded Mini Player.

- AudioWave typecheck and 11 existing unit tests pass.
- ArtistWave 91 existing tests pass.
- Current Electron smoke and packaged interactive behavior remain unverified in the restricted agent runner.
- Real restart persistence, browser/mobile and OAuth checks remain outstanding.
- Playlist browsing requires the matching ArtistWave site deployment.

## Earlier build evidence

The owner successfully ran the earlier separate-window smoke, including widget install/remove and saved-settings assertions after correcting a test timing race. The owner also built and launched `dist/verified-2026-11-13/AudioWave-Portable-0.1.0.exe`. That executable predates the single-window change and must be rebuilt before validating the current behavior.

No deployment or signing configuration was changed. Generated EXEs are excluded from the commit.

Owner-terminal current single-window smoke PASSED: one window, 1180px full width, 380px Mini width, always-on-top in Mini and original width restored in Full. Current packaged-app and hosted saved-playlist checks remain outstanding. Both commit attempts failed because the configured SSH signing key was unavailable.
