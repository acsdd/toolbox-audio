import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const { signIn } = require('../scripts/google-auth.cjs')

test('desktop sign-in validates state and exchanges the code with matching PKCE', async () => {
  let callbackUrl: URL
  let challenge: string | null
  const token = await signIn({
    credentials: { client_id: 'test-client', client_secret: 'test-secret' },
    openExternal: async (address: string) => {
      const auth = new URL(address)
      assert.equal(auth.origin, 'https://accounts.google.com')
      assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
      assert.equal(auth.searchParams.has('client_secret'), false)
      challenge = auth.searchParams.get('code_challenge')
      callbackUrl = new URL(auth.searchParams.get('redirect_uri')!)
      assert.equal(callbackUrl.hostname, '127.0.0.1')
      callbackUrl.search = new URLSearchParams({ state: 'incorrect', code: 'test-code' }).toString()
      const rejected = await fetch(callbackUrl)
      assert.equal(rejected.status, 400)
      await rejected.text()
      callbackUrl.searchParams.set('state', auth.searchParams.get('state')!)
      const accepted = await fetch(callbackUrl)
      assert.equal(accepted.status, 200)
      await accepted.text()
    },
    fetchToken: async (address: string, options: { body: URLSearchParams }) => {
      assert.equal(address, 'https://oauth2.googleapis.com/token')
      const params = options.body
      assert.equal(params.get('code'), 'test-code')
      assert.equal(createHash('sha256').update(params.get('code_verifier')!).digest('base64url'), challenge)
      assert.equal(params.get('redirect_uri'), callbackUrl.origin + '/callback')
      return { ok: true, json: async () => ({ access_token: 'test-token', expires_in: 3600, refresh_token: 'discard' }) }
    }
  })
  assert.deepEqual(token, { access_token: 'test-token', expires_in: 3600, refresh_token: 'discard' })
})

test('desktop sign-in releases the listener when cancelled', async () => {
  const controller = new AbortController()
  let callback = ''
  await assert.rejects(signIn({
    credentials: { client_id: 'test-client', client_secret: 'test-secret' },
    signal: controller.signal,
    openExternal: async (address: string) => {
      callback = new URL(address).searchParams.get('redirect_uri')!
      controller.abort()
    }
  }), /cancelled/)
  await assert.rejects(fetch(callback))
})

test('desktop sign-in times out and handles browser launch failures', async () => {
  await assert.rejects(signIn({
    credentials: { client_id: 'test-client', client_secret: 'test-secret' }, openExternal: async () => {}, timeoutMs: 30 }), /timed out/)
  await assert.rejects(signIn({
    credentials: { client_id: 'test-client', client_secret: 'test-secret' }, openExternal: async () => { throw new Error('unavailable') } }), /open your browser/)
})
