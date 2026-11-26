'use strict'
const fs = require('node:fs')

// Refresh tokens never leave the main process. Windows safeStorage binds the
// encrypted file to the current Windows account; access tokens stay in memory.
function createGoogleSession({ file, secureStorage, credentials, fetchImpl = fetch }) {
  let revision = 0
  function forget() {
    revision++
    fs.rmSync(file, { force: true })
  }
  function remember(token) {
    forget() // Never restore an old account after a different sign-in.
    if (typeof token !== 'string' || !token || !secureStorage.isEncryptionAvailable()) return false
    const tmp = file + '.tmp'
    try {
      const encrypted = secureStorage.encryptString(JSON.stringify({ client_id: credentials.client_id, refresh_token: token }))
      fs.writeFileSync(tmp, encrypted, { mode: 0o600 })
      fs.renameSync(tmp, file)
      return true
    } catch { return false }
    finally { try { fs.rmSync(tmp, { force: true }) } catch {} }
  }
  async function restore() {
    if (!fs.existsSync(file)) return null
    if (!secureStorage.isEncryptionAvailable()) throw new Error('Windows credential storage is unavailable. Sign in again when it is available.')
    let saved
    try { saved = JSON.parse(secureStorage.decryptString(fs.readFileSync(file))) }
    catch { throw new Error('The saved Google session cannot be opened on this Windows account. Sign in again.') }
    if (!saved || saved.client_id !== credentials.client_id || typeof saved.refresh_token !== 'string' || !saved.refresh_token) {
      throw new Error('The saved Google session belongs to a different app configuration. Sign in again.')
    }
    const current = revision
    let response, result
    try {
      response = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST', body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret, refresh_token: saved.refresh_token, grant_type: 'refresh_token' }),
        signal: AbortSignal.timeout(15000), redirect: 'error'
      })
      result = await response.json()
    } catch { throw new Error('Could not restore Google sign-in. Check your connection and try again.') }
    if (current !== revision) return null
    if (!response.ok || typeof result?.access_token !== 'string') {
      if (result?.error === 'invalid_grant') {
        forget()
        throw new Error('Your Google session expired or was revoked. Sign in again.')
      }
      throw new Error('Could not restore Google sign-in. Try again later.')
    }
    return { access_token: result.access_token, expires_in: result.expires_in, remembered: true }
  }
  return { remember, restore, forget }
}
module.exports = { createGoogleSession }
