import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { OUTPUT_PROBE_URL, allowOutputPermission } = require('../scripts/output-permissions.cjs')

test('only the trusted main page gets speaker selection; microphone and camera stay denied', () => {
  const contents = {}, main = { webContents: contents, isDestroyed: () => false }
  const details = { isMainFrame: true, requestingUrl: 'https://acsdd.github.io/ArtistWave/' }
  const check = (permission: string, overrides = {}, origin = 'https://acsdd.github.io/') =>
    allowOutputPermission(contents, permission, origin, { ...details, ...overrides }, main, null)
  assert.equal(check('speaker-selection'), true)
  assert.equal(check('media', { mediaType: 'audio' }), false)
  assert.equal(check('media', { mediaType: 'video' }), false)
  assert.equal(check('speaker-selection', { isMainFrame: false }), false)
  assert.equal(check('speaker-selection', { requestingUrl: 'https://acsdd.github.io/other/' }), false)
  assert.equal(check('speaker-selection', {}, 'https://evil.example'), false)
})

test('the scriptless enumerator has only the narrow checks needed for audio output listing', () => {
  const contents = {}, probe = { webContents: contents, isDestroyed: () => false }
  const details = { isMainFrame: true, requestingUrl: OUTPUT_PROBE_URL }
  const check = (permission: string, overrides = {}) =>
    allowOutputPermission(contents, permission, 'https://acsdd.github.io/', { ...details, ...overrides }, null, probe)
  assert.equal(check('media', { mediaType: 'audio' }), true)
  assert.equal(check('speaker-selection'), true)
  assert.equal(check('media', { mediaType: 'video' }), false)
  assert.equal(check('media', { mediaType: 'audio', requestingUrl: 'https://acsdd.github.io/ArtistWave/' }), false)
  assert.equal(check('media', { mediaType: 'audio', isMainFrame: false }), false)
})
