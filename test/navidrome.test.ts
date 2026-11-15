import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const { createNavidrome, normalizeConnection } = require('../scripts/navidrome.cjs')
const secureStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (text: string) => Buffer.from(text).toString('base64'),
  decryptString: (bytes: Buffer) => Buffer.from(bytes.toString(), 'base64').toString()
}

test('Navidrome normalizes the app URL and creates salted token authentication', () => {
  const config = normalizeConnection({ url: 'http://nas.example:4533/app/#/album/recentlyAdded', username: 'listener', password: 'test-password' })
  assert.equal(config.url, 'http://nas.example:4533/')
  assert.equal(config.token, createHash('md5').update('test-password' + config.salt).digest('hex'))
  assert.equal(config.password, undefined)
  assert.throws(() => normalizeConnection({ url: 'file:///etc', username: 'a', password: 'b' }))
  assert.throws(() => normalizeConnection({ url: 'http://user:password@server', username: 'a', password: 'b' }))
})

test('Navidrome connects, pages albums, searches, restores and proxies ranges without exposing credentials', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'navidrome-test-'))
  const file = join(directory, 'connection.bin')
  const requests: URL[] = []
  const fetchImpl = async (address: URL, options: RequestInit) => {
    const url = new URL(address)
    requests.push(url)
    assert.equal(url.searchParams.get('u'), 'listener')
    assert.equal(url.searchParams.get('p'), null)
    assert.equal(url.searchParams.get('t'), createHash('md5').update('test-password' + url.searchParams.get('s')).digest('hex'))
    if (url.pathname.endsWith('/stream.view')) {
      assert.equal(new Headers(options.headers).get('range'), 'bytes=5-9')
      return new Response('56789', { status: 206, headers: { 'content-range': 'bytes 5-9/10', 'content-type': 'audio/mpeg' } })
    }
    const response: Record<string, unknown> = { status: 'ok' }
    if (url.pathname.endsWith('/getAlbumList2.view')) response.albumList2 = { album: [{ id: 'album1', name: 'Album', artist: 'Artist', songCount: 1 }] }
    if (url.pathname.endsWith('/search3.view')) response.searchResult3 = { album: [] }
    if (url.pathname.endsWith('/getAlbum.view')) response.album = { song: [{ id: 'song1', title: 'Track', artist: 'Artist', album: 'Album', coverArt: 'cover1' }] }
    return Response.json({ 'subsonic-response': response })
  }
  try {
    const service = createNavidrome({ file, secureStorage, fetchImpl })
    await service.connect({ url: 'http://nas:4533', username: 'listener', password: 'test-password' })
    assert.equal(service.status().connected, true)
    assert.equal(service.status().token, undefined)
    assert.equal(readFileSync(file, 'utf8').includes('test-password'), false)
    const albums = await service.albums({ offset: 40 })
    assert.equal(albums.albums[0].name, 'Album')
    assert.equal(requests.at(-1)!.searchParams.get('offset'), '40')
    await service.albums({ query: 'some artist', offset: 80 })
    assert.equal(requests.at(-1)!.searchParams.get('albumOffset'), '80')
    const [track] = await service.tracks('album1')
    assert.equal(track.source, 'NAVIDROME')
    assert.equal(new URL(track.url).searchParams.get('t'), null)
    assert.equal(track.url.includes('nas:4533'), false)
    const restored = createNavidrome({ file, secureStorage, fetchImpl })
    const media = await restored.media(new Request(track.url, { headers: { Range: 'bytes=5-9' } }))
    assert.equal(media.status, 206)
    assert.equal(media.headers.get('content-range'), 'bytes 5-9/10')
    assert.equal(await media.text(), '56789')
    assert.equal((await restored.media(new Request(track.url.replace('/stream?', '/deleteUser?')))).status, 404)
    restored.disconnect()
    assert.equal((await restored.media(new Request(track.url))).status, 503)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('a failed replacement connection preserves the previous saved server', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'navidrome-failure-'))
  let accept = true
  const service = createNavidrome({
    file: join(directory, 'connection.bin'), secureStorage,
    fetchImpl: async () => Response.json({ 'subsonic-response': accept ? { status: 'ok' } : { status: 'failed', error: { code: 40 } } })
  })
  try {
    await service.connect({ url: 'http://first:4533', username: 'a', password: 'b' })
    accept = false
    await assert.rejects(service.connect({ url: 'http://second:4533', username: 'a', password: 'wrong' }), /credentials/)
    assert.equal(service.status().url, 'http://first:4533/')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
