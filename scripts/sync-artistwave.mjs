import { copyFile, mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { applyAudioBrand } from './audio-brand.mjs'

const source = new URL('../../ArtistWave/', import.meta.url)
const destination = new URL('../artistwave/', import.meta.url)
await mkdir(destination, { recursive: true })
const desktopAssets = new Set(['family-foundation.css', 'family-audio.css', 'audiowave-mark.svg'])
const included = name => !desktopAssets.has(name) && (/\.(html|js|css|png|svg|webmanifest)$/.test(name) || name === 'LICENSE')
const entries = await readdir(source, { withFileTypes: true })
const names = new Set(entries.filter(entry => entry.isFile() && included(entry.name)).map(entry => entry.name))
// Validate transformations before replacing any snapshot files.
const brandedPages = new Map()
for (const [name, mode] of [['index.html', 'full'], ['mini-player.html', 'mini']]) {
  brandedPages.set(name, applyAudioBrand(await readFile(new URL(name, source), 'utf8'), mode))
}
// This directory contains only generated flat static assets. Remove stale copies.
for (const entry of await readdir(destination, { withFileTypes: true })) {
  if (entry.isFile() && included(entry.name) && !names.has(entry.name)) {
    await unlink(new URL(entry.name, destination))
  }
}
for (const entry of entries) {
  if (names.has(entry.name)) {
    if (brandedPages.has(entry.name)) await writeFile(new URL(entry.name, destination), brandedPages.get(entry.name))
    else await copyFile(new URL(entry.name, source), new URL(entry.name, destination))
  }
}
console.log('Updated bundled ArtistWave at ' + fileURLToPath(destination))
