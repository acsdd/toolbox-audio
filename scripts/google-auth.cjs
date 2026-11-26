const http = require('node:http')
const { randomBytes, createHash } = require('node:crypto')

// Installed-app configuration is supplied locally or by the release build.
function readCredentials() {
  try { return require('../config/google-oauth.json') }
  catch { throw new Error('Google sign-in is not configured in this build.') }
}
const SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata'

function signIn({ openExternal, signal, fetchToken = fetch, timeoutMs = 180000, credentials }) {
  return new Promise((resolve, reject) => {
    const config = credentials || readCredentials()
    if (!config.client_id || !config.client_secret) throw new Error('Google sign-in configuration is incomplete.')
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const controller = new AbortController()
    let finished = false
    let exchanging = false
    let redirectUri
    const finish = (error, result) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      controller.abort()
      server.close()
      server.closeAllConnections()
      if (error) reject(error)
      else resolve(result)
    }
    const cancel = () => finish(new Error('Sign-in cancelled.'))
    const server = http.createServer(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      const url = new URL(req.url, redirectUri)
      if (req.method !== 'GET' || url.pathname !== '/callback' || url.searchParams.get('state') !== state) {
        res.writeHead(400).end('Invalid sign-in callback.')
        return
      }
      if (exchanging) {
        res.writeHead(409).end('Sign-in is already being completed.')
        return
      }
      if (url.searchParams.has('error')) {
        res.end('Sign-in cancelled. You can return to AudioWave.')
        finish(new Error('Google sign-in was declined.'))
        return
      }
      const code = url.searchParams.get('code')
      if (!code) {
        res.writeHead(400).end('Missing authorization code.')
        return
      }
      exchanging = true
      try {
        const response = await fetchToken('https://oauth2.googleapis.com/token', {
          method: 'POST',
          body: new URLSearchParams({
            client_id: config.client_id, client_secret: config.client_secret, code,
            code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code'
          }),
          signal: controller.signal
        })
        const token = await response.json()
        if (!response.ok || typeof token.access_token !== 'string') {
          throw new Error('Google could not complete sign-in. Please try again.')
        }
        res.end('Google sign-in completed. Return to AudioWave to finish loading your library.')
        finish(null, { access_token: token.access_token, expires_in: token.expires_in, refresh_token: token.refresh_token })
      } catch (error) {
        res.writeHead(502).end('Sign-in failed. Return to AudioWave and try again.')
        finish(new Error('Google sign-in could not be completed. Please try again.'))
      }
    })
    const timer = setTimeout(() => finish(new Error('Sign-in timed out. Please try again.')), timeoutMs)
    server.on('error', () => finish(new Error('Could not start the local sign-in callback.')))
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) return cancel()
    server.listen(0, '127.0.0.1', async () => {
      if (finished) return
      redirectUri = 'http://127.0.0.1:' + server.address().port + '/callback'
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.search = new URLSearchParams({
        client_id: config.client_id, redirect_uri: redirectUri, response_type: 'code',
        scope: SCOPE, state, code_challenge: challenge, code_challenge_method: 'S256',
        prompt: 'select_account'
      }).toString()
      try { await openExternal(url.href) }
      catch { finish(new Error('Could not open your browser for sign-in.')) }
    })
  })
}

module.exports = { signIn, readCredentials }
