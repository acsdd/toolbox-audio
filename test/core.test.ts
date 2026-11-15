import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_PREFIX, isArtistWaveMiniUrl } from '../dist/core.js'

test('isArtistWaveMiniUrl matches the mini-player path on the app origin', () => {
  assert.equal(isArtistWaveMiniUrl(`${APP_PREFIX}mini-player.html`), true)
})

test('isArtistWaveMiniUrl rejects the app root and other paths', () => {
  assert.equal(isArtistWaveMiniUrl(APP_PREFIX), false)
  assert.equal(isArtistWaveMiniUrl(`${APP_PREFIX}index.html`), false)
})

test('isArtistWaveMiniUrl rejects other origins and malformed input', () => {
  assert.equal(isArtistWaveMiniUrl('https://evil.example/mini-player.html'), false)
  assert.equal(isArtistWaveMiniUrl('not a url'), false)
  assert.equal(isArtistWaveMiniUrl(''), false)
})

import { parseProbe } from '../dist/core.js'

test('parseProbe reads the mini flag and defaults mode to audio', () => {
  assert.deepEqual(parseProbe({ mini: true, mode: 'audio' }), { mini: true, mode: 'audio' })
  assert.deepEqual(parseProbe({}), { mini: false, mode: 'audio' })
  assert.deepEqual(parseProbe(null), { mini: false, mode: 'audio' })
})

test('parseProbe keeps studio/youtube and rejects unknown modes', () => {
  assert.equal(parseProbe({ mode: 'studio' }).mode, 'studio')
  assert.equal(parseProbe({ mode: 'youtube' }).mode, 'youtube')
  assert.equal(parseProbe({ mode: 'bogus' }).mode, 'audio')
  assert.equal(parseProbe({ mini: 'yes' }).mini, false)
})

import { computeMiniBounds } from '../dist/core.js'

test('computeMiniBounds caps width at 380 and pins to the right edge', () => {
  const work = { x: 0, y: 0, width: 1920, height: 1040 }
  const restore = { x: 100, y: 100, width: 1180, height: 780 }
  const b = computeMiniBounds(work, restore)
  assert.equal(b.width, 380)
  assert.equal(b.height, 1040)
  assert.equal(b.x, 1920 - 380)
  assert.equal(b.y, 0)
})

test('computeMiniBounds clamps height to the work area and respects offset monitors', () => {
  const work = { x: 1920, y: 0, width: 1280, height: 720 }
  const restore = { x: 2000, y: 100, width: 1180, height: 900 }
  const b = computeMiniBounds(work, restore)
  assert.equal(b.height, 720)
  assert.equal(b.x, 1920 + 1280 - 380)
  assert.equal(b.y, 0)
})

test('computeMiniBounds never exceeds a narrow work area', () => {
  const work = { x: 0, y: 0, width: 360, height: 640 }
  const restore = { x: 0, y: 0, width: 1180, height: 780 }
  const b = computeMiniBounds(work, restore)
  assert.equal(b.width, 360)
  assert.ok(b.x >= 0)
})

import { normalizeSnapshot } from '../dist/core.js'

test('normalizeSnapshot supplies friendly defaults for an empty state', () => {
  const s = normalizeSnapshot({})
  assert.equal(s.title, 'Nothing playing yet')
  assert.equal(s.artist, 'Choose a track in ArtistWave')
  assert.equal(s.source, 'READY')
  assert.equal(s.playing, false)
  assert.equal(s.cover, '')
  assert.deepEqual(s.upNext, [])
})

test('normalizeSnapshot clamps the clock and only allows https covers', () => {
  const s = normalizeSnapshot({ duration: 100, currentTime: 250, cover: 'http://x/c.png' })
  assert.equal(s.currentTime, 100)
  assert.equal(s.cover, '')
  const https = normalizeSnapshot({ cover: 'https://x/c.png' })
  assert.equal(https.cover, 'https://x/c.png')
})

test('normalizeSnapshot clamps volume to 0..1 and filters upNext', () => {
  const s = normalizeSnapshot({
    volume: 5,
    upNext: [
      { title: 'A', artist: 'a', index: 1, source: 'smart' },
      { title: '', artist: 'b', index: 2, source: 'library' },
      { title: 'C', artist: 'c', index: -1, source: 'library' }
    ]
  })
  assert.equal(s.volume, 1)
  assert.equal(s.upNext.length, 1)
  assert.equal(s.upNext[0].title, 'A')
  assert.equal(s.upNext[0].source, 'smart')
})
