import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const context: any = { URL }; vm.createContext(context)
const path = new URL('../artistwave/resume-state.js', import.meta.url)
if (fs.existsSync(path)) vm.runInContext(fs.readFileSync(path, 'utf8'), context)
const snapshot = { version: 1, source: 'local', trackId: 'local:' + 'a'.repeat(64), queueIds: ['local:' + 'a'.repeat(64)], queueIndex: 0, positionSeconds: 95 }
test('resume validator is exposed to the plain-script runtime', () => assert.equal(typeof context.ArtistWaveResumeState?.validateSnapshot, 'function'))
test('validated snapshots preserve only bounded stable identifiers', () => {
  const api = context.ArtistWaveResumeState; assert.ok(api)
  assert.equal(api.validateSnapshot(snapshot).positionSeconds, 95)
  for (const value of [null, {}, { ...snapshot, version: 2 }, { ...snapshot, positionSeconds: Infinity }, { ...snapshot, queueIndex: 5 }, { ...snapshot, trackId: 'https://example.org/audio?token=secret' }, { ...snapshot, queueIds: Array(501).fill(snapshot.trackId) }]) assert.equal(api.validateSnapshot(value), null)
  const serialized = api.serializeSnapshot({ ...snapshot, token: 'never-store', url: 'https://signed.example/' })
  assert.equal(serialized.includes('never-store'), false); assert.equal(serialized.includes('https:'), false)
})
test('resume resolution skips missing queue items, stays paused and clamps position', () => {
  const api = context.ArtistWaveResumeState; assert.ok(api)
  const available = [{ source: 'LOCAL', localKey: 'a'.repeat(64), duration: 30, url: 'blob:current' }]
  const restored = api.resolveSnapshot({ ...snapshot, queueIds: [snapshot.trackId, 'local:' + 'b'.repeat(64)] }, available, {})
  assert.equal(restored.paused, true); assert.equal(restored.skipped, 1); assert.equal(restored.positionSeconds, 30)
  assert.equal(api.resolveSnapshot(snapshot, [], {}), null)
  const nas = { version: 1, source: 'navidrome', trackId: 'navidrome:server:song', queueIds: ['navidrome:server:song'], queueIndex: 0, positionSeconds: 0 }
  assert.equal(api.resolveSnapshot(nas, [{ id: nas.trackId, source: 'NAVIDROME' }], {}), null)
})
