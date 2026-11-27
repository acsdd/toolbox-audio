import test from 'node:test'
import assert from 'node:assert/strict'
import { applyAudioBrand } from '../scripts/audio-brand.mjs'

test('snapshot branding preserves controls and scripts and is idempotent', () => {
  const main = '<html><head><link rel="stylesheet" href="styles.css" /></head><body><a href="#" class="brand" aria-label="ArtistWave home"><span>artistwave</span></a><button id="playButton">Play</button><script src="app.js"></script></body></html>'
  const branded = applyAudioBrand(main, 'full')
  assert.ok(branded.includes('aria-label="AudioWave home"'))
  assert.ok(branded.includes('audiowave-mark.svg'))
  assert.ok(branded.includes('id="locationName"'))
  assert.ok(branded.includes('<button id="playButton">Play</button>'))
  assert.ok(branded.includes('<script src="app.js"></script>'))
  assert.equal((branded.match(/href="family-foundation.css"/g) || []).length, 1)
  assert.equal((branded.match(/href="family-audio.css"/g) || []).length, 1)
  assert.equal(applyAudioBrand(branded, 'full'), branded)
})

test('Mini retains its independent player markup while sharing desktop identity', () => {
  const mini = '<html><head></head><body><div class="mini-brand"><span>artist<strong>wave</strong></span></div><button id="miniPlay">▶</button></body></html>'
  const branded = applyAudioBrand(mini, 'mini')
  assert.ok(branded.includes('audio<strong>wave</strong>'))
  assert.ok(branded.includes('<button id="miniPlay">▶</button>'))
  assert.equal(applyAudioBrand(branded, 'mini'), branded)
})

test('changed upstream markup stops sync rather than silently dropping branding', () => {
  assert.throws(() => applyAudioBrand('<html><head></head><body>No brand</body></html>', 'full'), /brand anchor/)
  assert.throws(() => applyAudioBrand('<div class="mini-brand">ArtistWave</div>', 'mini'), /head/)
})
