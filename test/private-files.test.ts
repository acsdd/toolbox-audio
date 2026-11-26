import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { findRisk } = require('../scripts/check-private-files.cjs')
test('credential guard detects private files and real-shaped token values without rejecting placeholders', () => {
  assert.ok(findRisk('config/google-oauth.json', Buffer.from('{}')))
  assert.ok(findRisk('tokens/token.json', Buffer.from('{}')))
  assert.ok(findRisk('source.txt', Buffer.from('AIza' + 'a'.repeat(35))))
  assert.ok(findRisk('source.txt', Buffer.from('GOCSPX-' + 'a'.repeat(24))))
  assert.ok(findRisk('source.txt', Buffer.from('ya29.' + 'a'.repeat(32))))
  assert.ok(findRisk('source.txt', Buffer.from('1//' + 'a'.repeat(32))))
  assert.equal(findRisk('config/google-oauth.example.json', Buffer.from('YOUR_DESKTOP_CLIENT_SECRET')), '')
  assert.equal(findRisk('.env.example', Buffer.from('EXAMPLE=value')), '')
})
