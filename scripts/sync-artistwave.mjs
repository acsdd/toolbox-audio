import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = new URL('../../ArtistWave/', import.meta.url)
const destination = new URL('../artistwave/', import.meta.url)
await mkdir(destination, { recursive: true })
const included = name => /\.(html|js|css|png|svg|webmanifest)$/.test(name) || name === 'LICENSE'
const entries = await readdir(source, { withFileTypes: true })
const names = new Set(entries.filter(entry => entry.isFile() && included(entry.name)).map(entry => entry.name))
// This directory contains only generated flat static assets. Remove stale copies.
for (const entry of await readdir(destination, { withFileTypes: true })) {
  if (entry.isFile() && included(entry.name) && !names.has(entry.name)) {
    await unlink(new URL(entry.name, destination))
  }
}
for (const entry of entries) {
  if (names.has(entry.name)) {
    await copyFile(new URL(entry.name, source), new URL(entry.name, destination))
  }
}
console.log('Updated bundled ArtistWave at ' + fileURLToPath(destination))
