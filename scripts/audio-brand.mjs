/* Keep AudioWave's desktop identity when refreshing the upstream UI snapshot. */
export function applyAudioBrand(html, mode) {
  if (!html.includes('</head>')) throw new Error('Upstream page is missing its head; review the AudioWave adapter.')
  const anchor = mode === 'mini'
    ? /<div class="mini-brand">[\s\S]*?<\/div>/
    : /<a href="#" class="brand"[^>]*>[\s\S]*?<\/a>/
  if (!anchor.test(html)) throw new Error('Upstream brand anchor changed; review the AudioWave adapter.')
  const brand = mode === 'mini'
    ? '<div class="mini-brand"><img class="family-app-mark" src="audiowave-mark.svg" alt="" /><span>audio<strong>wave</strong></span></div>'
    : '<a href="#" class="brand" aria-label="AudioWave home"><img class="family-app-mark" src="audiowave-mark.svg" alt="" /><span>audio<span class="brand-light">wave</span><small>Your music. Your flow.</small></span></a>'
  let branded = html
    .replace(anchor, brand)
    .replace(/\s*<link rel="stylesheet" href="family-(?:foundation|audio)\.css"\s*\/>/g, '')
    .replace(/\s*<\/head>/, '\n  <link rel="stylesheet" href="family-foundation.css" />\n  <link rel="stylesheet" href="family-audio.css" />\n</head>')
  // Upstream navigation still updates this live label even when its old
  // breadcrumb is absent. Keep that contract in the desktop snapshot.
  if (mode === 'full' && !/id="locationName"/.test(branded)) {
    branded = branded.replace(/<body(?:\s[^>]*)?>/, '$&\n  <span id="locationName" class="family-view-name" aria-live="polite">Discover</span>')
  }
  return branded
}
