const fs = require('node:fs')
const { createHash, randomBytes } = require('node:crypto')
const MEDIA_PREFIX = 'https://acsdd.github.io/ArtistWave/__navidrome/'

function normalizeConnection(input) {
  const url = new URL(String(input?.url || '').trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Enter an HTTP or HTTPS server address without embedded credentials.')
  }
  url.hash = ''; url.search = ''
  url.pathname = url.pathname.replace(/\/app\/?$/, '/').replace(/\/?$/, '/')
  const username = String(input.username || '').trim()
  const password = String(input.password || '')
  if (!username || !password || username.length > 200 || password.length > 2000) {
    throw new Error('Enter your Navidrome username and password.')
  }
  const salt = randomBytes(16).toString('hex')
  return {
    url: url.href, username, salt,
    token: createHash('md5').update(password + salt).digest('hex'),
    id: createHash('sha256').update(url.href + '\n' + username).digest('hex').slice(0, 24)
  }
}

function createNavidrome({ file, secureStorage, fetchImpl = fetch }) {
  let connection = null
  let revision = 0
  let connecting = false
  let storageError = ''
  if (fs.existsSync(file)) {
    try {
      connection = JSON.parse(secureStorage.decryptString(fs.readFileSync(file)))
    } catch {
      storageError = 'Saved Navidrome credentials could not be opened. Connect again.'
    }
  }
  const status = () => ({
    id: connection?.id || '', connected: Boolean(connection), url: connection?.url || '',
    username: connection?.username || '', error: storageError
  })
  function endpoint(config, name, params = {}) {
    const url = new URL('rest/' + name + '.view', config.url)
    url.search = new URLSearchParams({
      u: config.username, t: config.token, s: config.salt,
      v: '1.16.1', c: 'AudioWave', f: 'json', ...params
    }).toString()
    return url
  }
  async function api(config, name, params = {}) {
    let response
    try {
      response = await fetchImpl(endpoint(config, name, params), {
        signal: AbortSignal.timeout(15000), redirect: 'error'
      })
    } catch {
      throw new Error('Cannot reach Navidrome. Check the server address and network connection.')
    }
    if (!response.ok) throw new Error('Navidrome returned HTTP ' + response.status + '.')
    let data
    try { data = (await response.json())['subsonic-response'] }
    catch { throw new Error('This address did not return a Navidrome API response.') }
    if (data?.status !== 'ok') {
      if ([40, 41, 42, 43, 44].includes(data?.error?.code)) throw new Error('Navidrome rejected these credentials.')
      throw new Error('Navidrome could not complete this request. Error ' + (data?.error?.code || 'unknown') + '.')
    }
    return data
  }
  function configured() {
    if (!connection) throw new Error('Connect to Navidrome first.')
    return connection
  }
  const mediaUrl = (config, kind, id) => MEDIA_PREFIX + config.id + '/' + kind + '?id=' + encodeURIComponent(id)
  function song(config, item) {
    return {
      id: 'navidrome:' + config.id + ':' + item.id,
      title: String(item.title || 'Untitled'), artist: String(item.artist || 'Unknown artist'),
      collection: String(item.album || ''), albumKind: 'album', source: 'NAVIDROME',
      url: mediaUrl(config, 'stream', item.id),
      ...(item.coverArt ? { artwork: mediaUrl(config, 'cover', item.coverArt) } : {})
    }
  }
  return {
    status,
    async connect(input) {
      if (connecting) throw new Error('A connection attempt is already running.')
      connecting = true
      const currentRevision = ++revision
      try {
        const candidate = normalizeConnection(input)
        await api(candidate, 'ping')
        if (revision !== currentRevision) throw new Error('Connection cancelled.')
        if (!secureStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.')
        const encrypted = secureStorage.encryptString(JSON.stringify(candidate))
        fs.writeFileSync(file + '.tmp', encrypted, { mode: 0o600 })
        fs.renameSync(file + '.tmp', file)
        connection = candidate
        storageError = ''
        return status()
      } finally { connecting = false }
    },
    disconnect() {
      revision++
      fs.rmSync(file, { force: true })
      connection = null
      storageError = ''
      return status()
    },
    async albums({ offset = 0, query = '' } = {}) {
      const config = configured()
      const start = Math.max(0, Math.min(1000000, Math.floor(Number(offset) || 0)))
      const text = String(query).trim().slice(0, 200)
      const data = text
        ? await api(config, 'search3', { query: text, albumCount: '40', albumOffset: String(start), artistCount: '0', songCount: '0' })
        : await api(config, 'getAlbumList2', { type: 'newest', size: '40', offset: String(start) })
      if (config !== connection) throw new Error('The server connection changed. Reload the library.')
      const albums = (text ? data.searchResult3?.album : data.albumList2?.album) || []
      return {
        albums: albums.map(item => ({
          id: String(item.id), name: String(item.name || item.title || 'Untitled album'),
          year: Number(item.year)||0, artist: String(item.artist || 'Unknown artist'), count: Number(item.songCount) || 0,
          artwork: item.coverArt ? mediaUrl(config, 'cover', item.coverArt) : ''
        })),
        more: albums.length === 40
      }
    },
    async tracks(id) {
      const config = configured()
      if (typeof id !== 'string' || !id || id.length > 500) throw new Error('Choose an album.')
      const data = await api(config, 'getAlbum', { id })
      if (config !== connection) throw new Error('The server connection changed. Reload the library.')
      return (data.album?.song || []).map(item => song(config, item))
    },
    async media(request) {
      try {
        const url = new URL(request.url)
        const path = url.pathname.slice('/ArtistWave/__navidrome/'.length).split('/')
        const config = configured()
        const id = url.searchParams.get('id')
        if (path.length !== 2 || path[0] !== config.id || !['stream', 'cover'].includes(path[1]) ||
            !id || id.length > 500 || !['GET', 'HEAD'].includes(request.method)) {
          return new Response('Not found', { status: 404 })
        }
        const headers = new Headers()
        const range = request.headers.get('range')
        if (range) headers.set('Range', range)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        let upstream
        try {
          upstream = await fetchImpl(endpoint(config, path[1] === 'stream' ? 'stream' : 'getCoverArt',
            { id, ...(path[1] === 'cover' ? { size: '300' } : {}) }), {
            method: request.method, headers, redirect: 'error',
            signal: AbortSignal.any([request.signal, controller.signal])
          })
        } finally { clearTimeout(timeout) }
        if (!upstream.ok && upstream.status !== 416) {
          await upstream.body?.cancel()
          return new Response('Media is unavailable', { status: 502 })
        }
        const returnedHeaders = new Headers({ 'Cache-Control': 'no-store' })
        for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
          if (upstream.headers.has(name)) returnedHeaders.set(name, upstream.headers.get(name))
        }
        return new Response(upstream.body, { status: upstream.status, headers: returnedHeaders })
      } catch {
        return new Response('Connect to Navidrome to play this media.', { status: 503 })
      }
    }
  }
}
module.exports = { createNavidrome, normalizeConnection, MEDIA_PREFIX }
