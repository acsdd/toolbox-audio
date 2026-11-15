# Release verification — 2026-11-15

## 0.2.0 candidate

The user accepted the latest Navidrome/Plex preview. Google sign-in and Mini positioning were previously confirmed interactively. Detailed live NAS playback assertions were not recorded; automated provider checks use fixtures.

Local validation before release preparation: 92 ArtistWave tests and 20 AudioWave tests passed, along with typecheck and the general, Navidrome and Plex Electron smoke checks. The packaged Plex smoke also passed.

The general smoke covers bundled UI, sandbox boundaries, visible controls, single-window Mini, right-edge/full-height positioning, pin toggle and restoration. Provider smoke checks exercise the real library UI and native media handler with generated WAV audio, including playback, seeking, encrypted storage, Mini and disconnect. Unit checks cover authentication cancellation/state/PKCE, pagination, search, restart restoration and rejected media routes.

The source snapshot is bundled; desktop changes do not depend on Pages deployment. Google desktop configuration is injected locally or through the release secret.

Remaining release checks: clean-browser/mobile provider flows and hosted Pages review. Windows signing is deferred by the owner. Draft release builds require the desktop OAuth repository secret.

Final 0.2.0 validation: 112 unit tests passed (92 ArtistWave, 20 AudioWave), typecheck and general desktop smoke passed, and Navidrome/Plex smoke checks passed against the packaged ASAR. Desktop OAuth configuration is excluded from Git and the release Actions secret is configured. The owner authorized unsigned Git commits for this update after signing failed.
