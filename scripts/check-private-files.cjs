'use strict'
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function findRisk(filename, data) {
  const name = filename.replaceAll('\\', '/')
  if (/(^|\/)(?:google-oauth\.json|client_secret[^/]*\.json|credentials\.json|token\.json|google-session\.bin|\.env(?:\.[^/]*)?)$/i.test(name) && !name.endsWith('.env.example')) return 'private configuration or token file'
  if (!data || data.includes(0) || data.length > 5_000_000) return ''
  const text = data.toString('utf8')
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) return 'private key'
  if (/\bAIza[A-Za-z0-9_-]{35}\b/.test(text)) return 'Google API key'
  if (/\bGOCSPX-[A-Za-z0-9_-]{15,}\b/.test(text)) return 'Google OAuth client secret'
  if (/\bya29\.[A-Za-z0-9_-]{30,}\b/.test(text)) return 'Google access token'
  if (/\b1\/\/[A-Za-z0-9_-]{30,}\b/.test(text)) return 'Google refresh token'
  return ''
}
if (require.main === module) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const names = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8').split('\0').filter(Boolean)
  let failed = false
  for (const name of names) {
    const file = path.join(root, name)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue
    const risk = findRisk(name, fs.readFileSync(file))
    if (risk) { console.error(`${name}: ${risk}`); failed = true }
  }
  if (failed) process.exitCode = 1
  else console.log('Tracked files contain no detected private Google credentials or token files.')
}
module.exports = { findRisk }
