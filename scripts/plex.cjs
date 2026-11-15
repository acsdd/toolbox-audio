const fs = require('node:fs')
const { randomUUID, createHash } = require('node:crypto')
const { setTimeout: delay } = require('node:timers/promises')
const MEDIA_PREFIX = 'https://acsdd.github.io/ArtistWave/__plex/'

function serverAddress(raw) {
  const url = new URL(String(raw || '').trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Enter your Plex server HTTP or HTTPS address.')
  }
  url.hash = ''; url.search = ''
  url.pathname = url.pathname.replace(/\/web(?:\/index.html)?\/?$/, '/').replace(/\/?$/, '/')
  return url.href
}

function createPlex({ file, secureStorage, openExternal, fetchImpl = fetch, pollMs = 1500 }) {
  let connection = null
  let attempt = null
  let storageError = ''
  if (fs.existsSync(file)) {
    try { connection = JSON.parse(secureStorage.decryptString(fs.readFileSync(file))) }
    catch { storageError = 'Saved Plex credentials could not be opened. Sign in again.' }
  }
  const clientFile = file + '.client'
  const clientId = fs.existsSync(clientFile) ? fs.readFileSync(clientFile, 'utf8') : randomUUID()
  if (!fs.existsSync(clientFile)) fs.writeFileSync(clientFile, clientId)
  const headers = token => ({
    Accept: 'application/json', 'X-Plex-Product': 'AudioWave',
    'X-Plex-Client-Identifier': clientId,
    ...(token ? { 'X-Plex-Token': token } : {})
  })
  async function request(url, token, options = {}) {
    let response
    try {
      response = await fetchImpl(url, {
        ...options, headers: { ...headers(token), ...options.headers }, redirect: 'error',
        signal: AbortSignal.any([options.signal || new AbortController().signal, AbortSignal.timeout(15000)])
      })
    } catch {
      if (options.signal?.aborted) throw new Error('Plex sign-in cancelled or timed out.')
      throw new Error('Cannot reach Plex. Check your server address and network connection.')
    }
    if ([401, 403].includes(response.status)) throw new Error('Plex access was denied. Sign in with an account that can access this server.')
    if (!response.ok) throw new Error('Plex returned HTTP ' + response.status + '.')
    return response
  }
  async function json(url, token, options) {
    const response = await request(url, token, options)
    try { return await response.json() }
    catch { throw new Error('Plex returned an unexpected response.') }
  }
  const endpoint = (config, path, params = {}) => {
    const url = new URL(path.replace(/^\//, ''), config.url)
    url.search = new URLSearchParams(params).toString()
    return url
  }
  async function libraries(config, signal) {
    const result = await json(endpoint(config, 'library/sections'), config.token, { signal })
    return (result.MediaContainer?.Directory || []).filter(item => item.type === 'artist')
      .map(item => ({ id: String(item.key), name: String(item.title || 'Music') }))
  }
  function configured() {
    if (!connection) throw new Error('Sign in with Plex first.')
    return connection
  }
  const summary = () => ({
    connected: Boolean(connection), url: connection?.url || '', username: '',
    libraries: connection?.libraries || [], error: storageError
  })
  const mediaUrl = (config, kind, id) => MEDIA_PREFIX + config.id + '/' + kind + '?id=' + encodeURIComponent(id)
  const cancel = () => attempt?.abort()
  return {
    async status() {
      const config = connection
      if (config) {
        try {
          const list = await libraries(config)
          if (config === connection) { config.libraries = list; storageError = '' }
        } catch (error) { if (config === connection) storageError = error.message }
      }
      return summary()
    },
    cancel,
    async connect(input) {
      if (attempt) throw new Error('Plex sign-in is already open.')
      const controller = new AbortController()
      attempt = controller
      const timeout = setTimeout(() => controller.abort(), 180000)
      try {
        const url = serverAddress(input?.url)
        const identity = await request(new URL('identity', url), null, { signal: controller.signal })
        const identityData = await identity.json()
        const machineId = identityData.MediaContainer?.machineIdentifier
        if (!machineId) throw new Error('This address did not identify a Plex Media Server.')
        const pin = await json('https://plex.tv/api/v2/pins?strong=true', null, { method: 'POST', signal: controller.signal })
        if (!pin.id || !pin.code) throw new Error('Plex could not start account sign-in.')
        await openExternal('https://app.plex.tv/auth#?' + new URLSearchParams({
          clientID: clientId, code: pin.code, 'context[device][product]': 'AudioWave'
        }))
        let accountToken
        while (!accountToken) {
          await delay(pollMs, undefined, { signal: controller.signal })
          const result = await json('https://plex.tv/api/v2/pins/' + encodeURIComponent(pin.id), null, { signal: controller.signal })
          accountToken = result.authToken
        }
        const resources = await json('https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=0',
          accountToken, { signal: controller.signal })
        const server = Array.isArray(resources) && resources.find(item => item.clientIdentifier === machineId && item.provides?.split(',').includes('server'))
        if (!server?.accessToken) throw new Error('This Plex account does not have access to the selected server.')
        const candidate = {
          url, token: server.accessToken,
          id: createHash('sha256').update(machineId).digest('hex').slice(0, 24)
        }
        candidate.libraries = await libraries(candidate, controller.signal)
        controller.signal.throwIfAborted()
        if (!secureStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.')
        fs.writeFileSync(file + '.tmp', secureStorage.encryptString(JSON.stringify(candidate)), { mode: 0o600 })
        fs.renameSync(file + '.tmp', file)
        connection = candidate; storageError = ''
        return summary()
      } catch (error) {
        if (controller.signal.aborted) throw new Error('Plex sign-in cancelled or timed out. Try again when ready.')
        throw error
      } finally { clearTimeout(timeout); attempt = null }
    },
    disconnect() {
      cancel()
      fs.rmSync(file, { force: true })
      connection = null; storageError = ''
      return summary()
    },
    async albums({ offset = 0, query = '', library = '' } = {}) {
      const config = configured()
      const section = config.libraries.find(item => item.id === library) || config.libraries[0]
      if (!section) throw new Error('Add a Music library in Plex, then reopen this connection.')
      const start = Math.max(0, Math.min(1000000, Math.floor(Number(offset) || 0)))
      const text = String(query).trim().slice(0, 200)
      const params = { type: '9', sort: 'addedAt:desc', 'X-Plex-Container-Start': String(start), 'X-Plex-Container-Size': '40' }
      if (text) params.title = text
      const data = await json(endpoint(config, 'library/sections/' + encodeURIComponent(section.id) + '/all', params), config.token)
      if (config !== connection) throw new Error('Plex connection changed. Reopen the library.')
      const container = data.MediaContainer || {}
      const albums = (container.Metadata || []).filter(item => item.type === 'album')
      return {
        albums: albums.map(item => ({
          id: String(item.ratingKey), name: String(item.title || 'Untitled album'),
          artist: String(item.parentTitle || 'Unknown artist'), count: Number(item.leafCount) || 0,
          artwork: /^\/library\/metadata\/\d+\/thumb(?:\/\d+)?$/.test(item.thumb || '') ? mediaUrl(config, 'cover', item.thumb) : ''
        })),
        more: start + albums.length < Number(container.totalSize || 0) || (!container.totalSize && albums.length === 40)
      }
    },
    async tracks(id) {
      const config = configured()
      if (!/^\d+$/.test(String(id))) throw new Error('Choose a Plex album.')
      const data = await json(endpoint(config, 'library/metadata/' + id + '/children'), config.token)
      if (config !== connection) throw new Error('Plex connection changed. Reopen the library.')
      return (data.MediaContainer?.Metadata || []).filter(item => item.type === 'track' && item.Media?.some(media => media.Part?.length))
        .map(item => ({
          id: 'plex:' + config.id + ':' + item.ratingKey, title: String(item.title || 'Untitled'),
          artist: String(item.originalTitle || item.grandparentTitle || 'Unknown artist'),
          collection: String(item.parentTitle || ''), albumKind: 'album', source: 'PLEX',
          url: mediaUrl(config, 'stream', item.ratingKey),
          ...(/^\/library\/metadata\/\d+\/thumb(?:\/\d+)?$/.test(item.thumb || item.parentThumb || '')
            ? { artwork: mediaUrl(config, 'cover', item.thumb || item.parentThumb) } : {})
        }))
    },
    async media(requestData) {
      try {
        const config = configured()
        const url = new URL(requestData.url)
        const parts = url.pathname.slice('/ArtistWave/__plex/'.length).split('/')
        const id = url.searchParams.get('id') || ''
        if (parts.length !== 2 || parts[0] !== config.id || !['GET', 'HEAD'].includes(requestData.method)) {
          return new Response('Not found', { status: 404 })
        }
        let path
        if (parts[1] === 'cover' && /^\/library\/metadata\/\d+\/thumb(?:\/\d+)?$/.test(id)) path = id
        else if (parts[1] === 'stream' && /^\d+$/.test(id)) {
          const data = await json(endpoint(config, 'library/metadata/' + id), config.token, { signal: requestData.signal })
          const track = data.MediaContainer?.Metadata?.find(item => item.type === 'track')
          path = track?.Media?.flatMap(media => media.Part || []).find(part => /^\/library\/parts\/\d+\//.test(part.key || ''))?.key
        }
        if (!path || path.includes('..') || path.includes('?') || path.includes('#')) return new Response('Not found', { status: 404 })
        const target = endpoint(config, path)
        if (target.origin !== new URL(config.url).origin) return new Response('Not found', { status: 404 })
        const relativePath = target.pathname.slice(new URL(config.url).pathname.length - 1)
        if (parts[1] === 'stream' && !/^\/library\/parts\/\d+\//.test(relativePath)) {
          return new Response('Not found', { status: 404 })
        }
        const requestHeaders = headers(config.token)
        const range = requestData.headers.get('range')
        if (range) requestHeaders.Range = range
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        let response
        try {
          response = await fetchImpl(target, { headers: requestHeaders, method: requestData.method,
            redirect: 'error', signal: AbortSignal.any([requestData.signal, controller.signal]) })
        } finally { clearTimeout(timeout) }
        if (!response.ok && response.status !== 416) {
          await response.body?.cancel()
          return new Response('Plex media unavailable', { status: 502 })
        }
        const returned = new Headers({ 'Cache-Control': 'no-store' })
        for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
          if (response.headers.has(name)) returned.set(name, response.headers.get(name))
        }
        return new Response(response.body, { status: response.status, headers: returned })
      } catch { return new Response('Connect to Plex to play this media.', { status: 503 }) }
    }
  }
}
module.exports = { createPlex, serverAddress, MEDIA_PREFIX }
