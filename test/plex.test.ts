import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { createPlex, serverAddress } = require('../scripts/plex.cjs')
const secureStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (text: string) => Buffer.from(text).toString('base64'),
  decryptString: (bytes: Buffer) => Buffer.from(bytes.toString(), 'base64').toString()
}

test('Plex normalizes the web interface URL without retaining its fragment', () => {
  assert.equal(serverAddress('http://nas.example:32400/web/index.html#!/'), 'http://nas.example:32400/')
  assert.throws(() => serverAddress('file:///tmp/plex'))
  assert.throws(() => serverAddress('https://user:password@server'))
})

test('Plex browser authorization obtains a server token and supports music libraries, playback and restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'plex-test-'))
  const file = join(directory, 'connection.bin')
  const calls: URL[] = []
  let browserOpened = false
  const fetchImpl = async (address: string | URL, options: RequestInit) => {
    const url = new URL(address)
    calls.push(url)
    const token = new Headers(options.headers).get('X-Plex-Token')
    if (url.hostname === 'plex.tv') {
      assert.equal(token, null)
      if (url.pathname === '/api/v2/pins') {
        assert.equal(options.method, 'POST')
        return Response.json({ id: 123, code: 'fixture-pin' })
      }
      return Response.json({ authToken: 'account-token' })
    }
    if (url.hostname === 'clients.plex.tv') {
      assert.equal(token, 'account-token')
      return Response.json([{ clientIdentifier: 'server-id', provides: 'server', accessToken: 'server-token' }])
    }
    assert.equal(url.origin, 'http://nas:32400')
    if (url.pathname === '/identity') {
      assert.equal(token, null)
      return Response.json({ MediaContainer: { machineIdentifier: 'server-id' } })
    }
    assert.equal(token, 'server-token')
    if (url.pathname === '/library/sections') return Response.json({ MediaContainer: { Directory: [
      { key: '1', title: 'Movies', type: 'movie' }, { key: '2', title: 'Music', type: 'artist' },
      { key: '3', title: 'Other music', type: 'artist' }
    ] } })
    if (url.pathname.endsWith('/all')) return Response.json({ MediaContainer: {
      totalSize: 100, Metadata: [{ ratingKey: '10', type: 'album', title: 'Album', parentTitle: 'Artist', thumb: '/library/metadata/10/thumb/1' }]
    } })
    if (url.pathname.startsWith('/library/parts/')) {
      assert.equal(new Headers(options.headers).get('Range'), 'bytes=2-4')
      return new Response('234', { status: 206, headers: { 'content-range': 'bytes 2-4/10', 'content-type': 'audio/mpeg' } })
    }
    return Response.json({ MediaContainer: { Metadata: [{
      ratingKey: '11', type: 'track', title: 'Track', parentTitle: 'Album', grandparentTitle: 'Artist',
      Media: [{ Part: [{ key: '/library/parts/12/1/file.mp3' }] }]
    }] } })
  }
  const options = { file, secureStorage, fetchImpl, pollMs: 1,
    openExternal: async (address: string) => {
      const url = new URL(address)
      assert.equal(url.origin, 'https://app.plex.tv')
      assert(url.hash.includes('fixture-pin'))
      browserOpened = true
    }
  }
  try {
    const service = createPlex(options)
    const state = await service.connect({ url: 'http://nas:32400/web/index.html#!/' })
    assert(browserOpened)
    assert.equal(state.connected, true)
    assert.deepEqual(state.libraries.map((item: { name: string }) => item.name), ['Music', 'Other music'])
    assert.equal(state.token, undefined)
    assert(!readFileSync(file, 'utf8').includes('server-token'))
    const result = await service.albums({ library: '3', offset: 40, query: 'Album' })
    assert.equal(calls.at(-1)!.pathname, '/library/sections/3/all')
    assert.equal(calls.at(-1)!.searchParams.get('X-Plex-Container-Start'), '40')
    assert(result.more)
    const [track] = await service.tracks('10')
    assert.equal(track.source, 'PLEX')
    assert(!track.url.includes('token'))
    const restored = createPlex(options)
    const response = await restored.media(new Request(track.url, { headers: { Range: 'bytes=2-4' } }))
    assert.equal(response.status, 206)
    assert.equal(await response.text(), '234')
    assert.equal((await restored.media(new Request(track.url.replace('/stream?', '/admin?')))).status, 404)
    restored.disconnect()
    assert.equal((await restored.media(new Request(track.url))).status, 503)
  } finally {
    assert(directory.startsWith(join(tmpdir(), 'plex-test-')))
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Plex rejects an account without access to the selected server and supports cancellation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'plex-access-'))
  let pending = false
  const options = {
    file: join(directory, 'connection.bin'), secureStorage, pollMs: 1,
    fetchImpl: async (address: string | URL) => {
      const url = new URL(address)
      if (url.pathname === '/identity') return Response.json({ MediaContainer: { machineIdentifier: 'wanted-server' } })
      if (url.pathname === '/api/v2/pins') return Response.json({ id: 1, code: 'pin' })
      if (url.pathname === '/api/v2/pins/1') return Response.json({ authToken: pending ? null : 'account-token' })
      return Response.json([{ clientIdentifier: 'other-server', provides: 'server', accessToken: 'other-token' }])
    },
    openExternal: async () => {}
  }
  try {
    const service = createPlex(options)
    await assert.rejects(service.connect({ url: 'http://nas:32400' }), /does not have access/)
    assert.equal((await service.status()).connected, false)
    pending = true
    const connecting = service.connect({ url: 'http://nas:32400' })
    setTimeout(() => service.cancel(), 20)
    await assert.rejects(connecting, /cancelled/)
  } finally {
    assert(directory.startsWith(join(tmpdir(), 'plex-access-')))
    rmSync(directory, { recursive: true, force: true })
  }
})
