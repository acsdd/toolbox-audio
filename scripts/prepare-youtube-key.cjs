'use strict'
// The generated file is public in the packaged app; the input stays out of Git.
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
function readKey() {
  if (process.env.YOUTUBE_DATA_API_KEY) return process.env.YOUTUBE_DATA_API_KEY.trim()
  const file = path.join(root, '.env.youtube.local')
  if (!fs.existsSync(file)) return ''
  const match = fs.readFileSync(file, 'utf8').match(/^\s*YOUTUBE_DATA_API_KEY\s*=\s*([^\s#]+)\s*$/m)
  if (!match) throw new Error('Invalid YouTube key file; expected YOUTUBE_DATA_API_KEY=value')
  return match[1]
}
const key = readKey()
if (key && !/^[A-Za-z0-9_-]+$/.test(key)) throw new Error('Invalid YouTube API key format')
if (!process.argv[2]) throw new Error('Output path required')
fs.writeFileSync(process.argv[2], 'window.AudioWaveYouTubeKey = ' + JSON.stringify(key) + ';\n')
console.log(key ? 'Shared YouTube key included in package.' : 'No shared YouTube key configured; personal keys remain available.')
