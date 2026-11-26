import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const context: any = {}
runInNewContext(readFileSync(new URL('../artistwave/youtube-albums.js', import.meta.url), 'utf8'), context)
const { group } = context.ArtistWaveYouTubeAlbums
test('YouTube videos group only under confidently matched artist and album metadata', () => {
  const videos = [
    {snippet:{title:'Arch Enemy - Nemesis (Official Video)'}},
    {snippet:{title:'Arch Enemy - We Will Rise (OFFICIAL VIDEO)'}},
    {snippet:{title:'Unrelated performance'}}
  ]
  const tracks = [
    {artistName:'Another Artist',trackName:'Nemesis',collectionName:'Wrong Album'},
    {artistName:'Arch Enemy',trackName:'Nemesis',collectionName:'Doomsday Machine',releaseDate:'2005-01-01'},
    {artistName:'Arch Enemy',trackName:'We Will Rise',collectionName:'Anthems of Rebellion',releaseDate:'2003-01-01'}
  ]
  const groups = group(videos, tracks, 'Arch Enemy')
  assert.equal(groups.find((g: any) => g.album === 'Doomsday Machine').items.length, 1)
  assert.equal(groups.find((g: any) => g.album === 'Anthems of Rebellion').items.length, 1)
  assert.equal(groups.find((g: any) => g.album === 'Other videos').items.length, 1)
  assert.ok(!groups.some((g: any) => g.album === 'Wrong Album'))
})

test('matched videos become official-player tracks with their album and track number', () => {
  const tracks = context.ArtistWaveYouTubeAlbums.toTracks(
    [{id:{videoId:'12345678901'},snippet:{title:'Arch Enemy - Nemesis (Official Video)'}},
     {id:{videoId:'12345678902'},snippet:{title:'Unknown song'}}],
    [{artistName:'Arch Enemy',trackName:'Nemesis',collectionName:'Doomsday Machine',trackNumber:2}],
    'Arch Enemy'
  )
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].source, 'YOUTUBE')
  assert.equal(tracks[0].collection, 'Doomsday Machine')
  assert.equal(tracks[0].trackNumber, 2)
  assert.match(tracks[0].url, /^https:\/\/www\.youtube\.com\/embed\//)
})
