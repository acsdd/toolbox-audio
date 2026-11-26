import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createGoogleSession } = require('../scripts/google-session.cjs')
const storage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(value).reverse(),
  decryptString: (value: Buffer) => Buffer.from(value).reverse().toString()
}
const credentials = { client_id: 'client-a', client_secret: 'example-secret' }

test('encrypted session survives restart and refresh token never reaches the renderer', async () => {
  const home = mkdtempSync(join(tmpdir(), 'audiowave-session-')), file = join(home, 'session.bin')
  try {
    const first = createGoogleSession({ file, secureStorage: storage, credentials })
    assert.equal(first.remember('private-refresh-token'), true)
    assert.equal(readFileSync(file).includes(Buffer.from('private-refresh-token')), false)
    const next = createGoogleSession({ file, secureStorage: storage, credentials, fetchImpl: async (_url: string, options: { body: URLSearchParams }) => {
      assert.equal(options.body.get('grant_type'), 'refresh_token')
      assert.equal(options.body.get('refresh_token'), 'private-refresh-token')
      return { ok: true, json: async () => ({ access_token: 'short-lived', expires_in: 3600 }) }
    } })
    assert.deepEqual(await next.restore(), { access_token: 'short-lived', expires_in: 3600, remembered: true })
    next.forget(); assert.equal(existsSync(file), false); assert.equal(await next.restore(), null)
  } finally { rmSync(home, { recursive: true, force: true }) }
})

test('revoked sessions are removed; network failures retain them', async () => {
  const home = mkdtempSync(join(tmpdir(), 'audiowave-session-')), file = join(home, 'session.bin')
  try {
    const offline = createGoogleSession({ file, secureStorage: storage, credentials, fetchImpl: async () => { throw Error('offline') } })
    offline.remember('private-refresh-token')
    await assert.rejects(offline.restore(), /connection/); assert.equal(existsSync(file), true)
    const revoked = createGoogleSession({ file, secureStorage: storage, credentials, fetchImpl: async () => ({ ok: false, json: async () => ({ error: 'invalid_grant' }) }) })
    await assert.rejects(revoked.restore(), /expired or was revoked/); assert.equal(existsSync(file), false)
  } finally { rmSync(home, { recursive: true, force: true }) }
})

test('account changes and sign-out cannot restore an old session', async () => {
  const home = mkdtempSync(join(tmpdir(), 'audiowave-session-')), file = join(home, 'session.bin')
  try {
    let resolveFetch: (value: unknown) => void = () => {}
    const session = createGoogleSession({ file, secureStorage: storage, credentials, fetchImpl: () => new Promise(resolve => { resolveFetch = resolve }) })
    session.remember('old-account-token')
    const restoring = session.restore()
    session.forget(); resolveFetch({ ok: true, json: async () => ({ access_token: 'old-access' }) })
    assert.equal(await restoring, null)
    session.remember('old-account-token')
    const withoutEncryption = createGoogleSession({ file, secureStorage: { ...storage, isEncryptionAvailable: () => false }, credentials })
    assert.equal(withoutEncryption.remember('new-account-token'), false)
    assert.equal(existsSync(file), false)
  } finally { rmSync(home, { recursive: true, force: true }) }
})
