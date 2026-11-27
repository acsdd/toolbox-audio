import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const context: any = {}; vm.createContext(context)
const file = new URL('../artistwave/playback-state.js', import.meta.url)
if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), context)
test('handoff lifecycle rejects completions and ended events after a replacement selection', () => {
  assert.equal(typeof context.ArtistWavePlaybackState?.create, 'function')
  const state = context.ArtistWavePlaybackState.create()
  state.select({ source: 'local', trackId: 'one', queueIndex: 3, playing: true })
  const first = state.transition('mini'); const second = state.transition('full')
  assert.equal(state.complete(first), false); assert.equal(state.complete(second), true)
  assert.equal(state.snapshot().mode, 'full'); assert.equal(state.snapshot().queueIndex, 3)
  const old = state.snapshot().transitionId
  state.select({ source: 'youtube', trackId: 'two', queueIndex: 4, playing: false })
  assert.equal(state.accept(old, 'one'), false); assert.equal(state.snapshot().trackId, 'two')
  state.transition('mini'); state.transition('full')
  assert.equal(state.snapshot().mode, 'full'); assert.equal(state.snapshot().playing, false)
})
