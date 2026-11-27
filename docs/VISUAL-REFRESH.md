# Family visual refresh · 27 November 2026

AudioWave now has its own desktop mark and default lavender accent, a framed discovery feature, coordinated search/library/playlist surfaces, responsive playback controls, matching dialogs, and Full/Mini appearance. All eleven existing themes remain available. The underlying ArtistWave engine, provider controls and playback element IDs are preserved.

`artistwave/family-foundation.css` is shared with Desktop. `artistwave/family-audio.css` adapts that foundation to Full and Mini. Both are bundled local assets; no external fonts or new production dependencies are required. The canonical foundation and nine-app adoption guide live at `brand-assets/family-ui/` in the parent workspace. Builds work independently of that directory.

`npm run sync:artistwave` preserves the two family stylesheets and `audiowave-mark.svg`, then reapplies the stylesheet links and desktop branding to upstream Full/Mini markup. `scripts/audio-brand.mjs` validates the expected anchors before any snapshot replacement. Its transform tests cover repeatability, playback control preservation and changed upstream markup. The compatibility live label also prevents existing library navigation from writing to a missing breadcrumb element.

Account-free screenshots include fictional playlists and paused tracks; they do not verify a provider account or live playback. The visual branch is separate from the unfinished `codex/audio-next-wave` functional worktree. Full/Mini always-on-top behavior still has the two acceptance failures recorded in the parent verification report. No release, installation or version bump is included.
